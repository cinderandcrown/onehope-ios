import type { AppConfig } from "./config";
import { loadConfig } from "./config";
import type { GiftView, PersonView, PickupBody, ProposalBody, PushBody, RoleChangeBody } from "./contracts";
import { decryptString, encryptString, hashPassword, newId, verifyPassword } from "./crypto";
import {
  type Actor,
  type Booking,
  type ModuleId,
  type Role,
  AccessError,
  CHURCH,
  MODULES,
  RETENTION_YEARS,
  SAMPLE_FUNNEL,
  authorize,
  autoSchedule,
  canChargeLive,
  eligibleForRetention,
  evaluatePickup,
  eventToIcs,
  findRoomConflict,
  isStaff,
  nextSundayService,
  projectDirectory,
  sameHousehold,
  transitionExpense,
  zebraLabel,
} from "./domain";
import { SAMPLE_PASSWORD, SAMPLE_PASTOR_EMAIL, SAMPLE_TOTP_BASE32 } from "./sample-accounts";
import { decodeBase32, totpCode, totpMatches } from "./totp";

type GiftRow = {
  id: string;
  householdId: string;
  personId: string;
  ciphertext: string;
  recurring: "once" | "weekly" | "monthly";
  charged: boolean;
  processor: "demo" | "stripe";
  sample: boolean;
  createdAt: number;
};

type ChildRow = {
  id: string;
  householdId: string;
  displayName: string;
  classroom: string;
  ciphertext: string;
  guardianIds: string[];
  restrictedPersonIds: string[];
  sample: boolean;
};

type Person = PersonView & {
  passwordHash: string | null;
  totpSecret: Buffer | null;
  listedInDirectory: boolean;
  deleted: boolean;
  lastIp: string | null;
  lastUserAgent: string | null;
};

type Session = {
  token: string;
  personId: string;
  createdAt: number;
  lastActivity: number;
  mfaVerified: boolean;
  stepUpUntil: number;
  ip: string;
  userAgent: string;
  sample: boolean;
};

type AuditEntry = {
  id: string;
  at: number;
  actorId: string;
  action: "read" | "write";
  resource: string;
  resourceId: string;
  tier: 0 | 1 | 2 | 3;
};

type Proposal = ProposalBody & {
  id: string;
  requestedBy: string;
  approvals: string[];
  executed: boolean;
};

type StoredPerson = Omit<Person, "totpSecret"> & { totpSecret: string | null };

export type StoreDocument = {
  version: 1;
  people: StoredPerson[];
  gifts: GiftRow[];
  children: ChildRow[];
  sessions: Session[];
  auditLog: AuditEntry[];
  alerts: { id: string; personId: string; at: number; kind: string; detail: string }[];
  proposals: Proposal[];
  secrets: { provider: string; ciphertext: string; last4: string }[];
  station: string[];
  flags: Record<ModuleId, boolean>;
  groups: { id: string; name: string; summary: string; sample: boolean; memberIds: string[] }[];
  messages: { id: string; groupId: string; authorId: string; body: string; sample: boolean }[];
  events: {
    id: string;
    title: string;
    start: number;
    end: number;
    location: string;
    description: string;
    capacity: number | null;
    sample: boolean;
  }[];
  registrations: { id: string; eventId: string; personId: string; status: "registered" | "waitlist" }[];
  announcements: { id: string; title: string; body: string; sample: boolean }[];
  prayers: {
    id: string;
    authorId: string;
    body: string;
    visibility: "public" | "private";
    approved: boolean;
    sample: boolean;
  }[];
  notes: {
    id: string;
    subjectPersonId: string;
    authorId: string;
    ciphertext: string;
    sharedWith: string[];
    sample: boolean;
  }[];
  checks: { personId: string; status: string; ciphertext: string; sample: boolean }[];
  schedule: {
    id: string;
    personId: string;
    position: string;
    status: "pending" | "accepted" | "declined";
    sample: boolean;
  }[];
  volunteers: { personId: string; positionId: string; blockouts: { start: number; end: number }[] }[];
  rooms: { id: string; name: string; campus: string }[];
  bookings: Booking[];
  expenses: {
    id: string;
    personId: string;
    memo: string;
    amountCents: number;
    state: "draft" | "submitted" | "approved" | "denied";
    sample: boolean;
  }[];
  pathways: { personId: string; steps: { id: string; title: string; status: string }[] }[];
  visitors: { id: string; name: string; state: string; sample: boolean }[];
  requests: { id: string; kind: string; personId: string; ciphertext: string; sample: boolean }[];
  drafts: { id: string; title: string; segment: string; sample: boolean }[];
};

export type StoreOptions = {
  now?: () => number;
  fetchImpl?: typeof fetch;
  passwordOverrides?: Record<string, string>;
  totpOverrides?: Record<string, string>;
  /** Explicit opt-in so tests can assert production guards against a memory store. */
  memoryForTests?: boolean;
  /** Fictional households for tests. The app boots with public church facts when this is false. */
  fixture?: boolean;
};

const FUNDS = [
  { id: "general", name: "General" },
  { id: "outreach", name: "Outreach" },
  { id: "kids", name: "Kids" },
  { id: "benevolence", name: "Benevolence" },
] as const;

const SEED_AT = Date.parse("2026-11-01T15:00:00.000Z");
const ROOM_START = Date.parse("2026-11-22T16:00:00.000Z");
const ROOM_END = Date.parse("2026-11-22T18:00:00.000Z");

/**
 * Demo runtime for one church. Private reads call `authorize`. Tier 3 fields
 * are encrypted here and in Postgres (see server/migrations). This is not a
 * second, weaker copy of the rules with the hard parts left for later.
 */
export class ChurchStore {
  readonly config: AppConfig;
  private readonly now: () => number;
  private readonly fetchImpl: typeof fetch | undefined;
  private readonly key: Buffer;
  private readonly dummyHash: string;
  private readonly people = new Map<string, Person>();
  private readonly gifts = new Map<string, GiftRow>();
  private readonly children = new Map<string, ChildRow>();
  private readonly sessions = new Map<string, Session>();
  private readonly auditLog: AuditEntry[] = [];
  private readonly alerts: { id: string; personId: string; at: number; kind: string; detail: string }[] = [];
  private readonly proposals = new Map<string, Proposal>();
  private readonly secrets = new Map<string, { ciphertext: string; last4: string }>();
  private readonly station = new Set<string>();
  private readonly flags: Record<ModuleId, boolean>;
  private readonly groups: {
    id: string;
    name: string;
    summary: string;
    sample: boolean;
    memberIds: string[];
  }[];
  private readonly messages: {
    id: string;
    groupId: string;
    authorId: string;
    body: string;
    sample: boolean;
  }[];
  private readonly events: {
    id: string;
    title: string;
    start: number;
    end: number;
    location: string;
    description: string;
    capacity: number | null;
    sample: boolean;
  }[];
  private readonly registrations: {
    id: string;
    eventId: string;
    personId: string;
    status: "registered" | "waitlist";
  }[];
  private readonly announcements: { id: string; title: string; body: string; sample: boolean }[];
  private readonly prayers: {
    id: string;
    authorId: string;
    body: string;
    visibility: "public" | "private";
    approved: boolean;
    sample: boolean;
  }[];
  private readonly notes: {
    id: string;
    subjectPersonId: string;
    authorId: string;
    ciphertext: string;
    sharedWith: string[];
    sample: boolean;
  }[];
  private readonly checks = new Map<
    string,
    { personId: string; status: string; ciphertext: string; sample: boolean }
  >();
  private readonly schedule: {
    id: string;
    personId: string;
    position: string;
    status: "pending" | "accepted" | "declined";
    sample: boolean;
  }[];
  private readonly volunteers: {
    personId: string;
    positionId: string;
    blockouts: { start: number; end: number }[];
  }[];
  private readonly rooms: { id: string; name: string; campus: string }[];
  private readonly bookings: Booking[];
  private readonly expenses: {
    id: string;
    personId: string;
    memo: string;
    amountCents: number;
    state: "draft" | "submitted" | "approved" | "denied";
    sample: boolean;
  }[];
  private readonly pathways = new Map<string, { id: string; title: string; status: string }[]>();
  private readonly visitors: { id: string; name: string; state: string; sample: boolean }[];
  private readonly requests: {
    id: string;
    kind: string;
    personId: string;
    ciphertext: string;
    sample: boolean;
  }[];
  private readonly drafts: { id: string; title: string; segment: string; sample: boolean }[] = [];

  static demo(env: NodeJS.ProcessEnv = process.env): ChurchStore {
    return new ChurchStore(loadConfig(env), { fixture: env.ONEHOPE_SAMPLE_DATA === "true" });
  }

  constructor(config: AppConfig, options: StoreOptions = {}) {
    if (config.env === "production" && !options.memoryForTests) {
      throw new Error("Refusing to boot the in-memory demo store in production.");
    }
    if (config.env === "production" && (options.passwordOverrides || options.totpOverrides)) {
      throw new Error("Credential overrides are refused in production.");
    }
    this.config = config;
    this.now = options.now ?? Date.now;
    this.fetchImpl = options.fetchImpl;
    this.key = config.fieldEncryptionKey;
    this.dummyHash = hashPassword("not-a-real-password");
    this.flags = Object.fromEntries(MODULES.map((id) => [id, true])) as Record<ModuleId, boolean>;
    this.groups = [];
    this.messages = [];
    this.events = [];
    this.registrations = [];
    this.announcements = [];
    this.prayers = [];
    this.notes = [];
    this.schedule = [];
    this.volunteers = [];
    this.rooms = [];
    this.bookings = [];
    this.expenses = [];
    this.visitors = [];
    this.requests = [];
    if (options.fixture === false) this.loadPublic();
    else this.loadSample();
    this.applyOverrides(options);
    this.ensureSeat(config.masterAdminPrimaryEmail, config.masterAdminPrimaryName);
    if (config.masterAdminSecondaryEmail.trim()) {
      this.ensureSeat(config.masterAdminSecondaryEmail, config.masterAdminSecondaryName);
    }
    if (options.fixture !== false) this.ensureDemoSessions();
  }

  status(version: string) {
    const database = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
    return {
      service: "onehope" as const,
      version,
      env: this.config.env,
      fieldEncryption: this.config.fieldEncryptionMode,
      givingLive: canChargeLive(this.config),
      sendsEnabled: false as const,
      church: "One Hope" as const,
      persistence: database.length > 0 ? ("postgres" as const) : ("memory" as const),
    };
  }

  seats() {
    return {
      primary: this.seatView(this.config.masterAdminPrimaryName, this.config.masterAdminPrimaryEmail),
      secondary: this.seatView(this.config.masterAdminSecondaryName, this.config.masterAdminSecondaryEmail),
    };
  }

  login(input: { email: string; password: string; ip: string; userAgent: string }) {
    const person = this.byEmail(input.email);
    const hash = person?.passwordHash;
    const valid = hash
      ? verifyPassword(input.password, hash)
      : (verifyPassword(input.password, this.dummyHash), false);
    if (!person || person.deleted || !valid) {
      throw new AccessError("unauthenticated", "That email and password don't match.");
    }
    if (person.lastIp && person.lastIp !== input.ip) {
      this.alerts.push({
        id: newId("alert"),
        personId: person.id,
        at: this.now(),
        kind: "ip",
        detail: "Sign-in from a new IP address.",
      });
    } else if (person.lastUserAgent && person.lastUserAgent !== input.userAgent) {
      this.alerts.push({
        id: newId("alert"),
        personId: person.id,
        at: this.now(),
        kind: "device",
        detail: "Sign-in from a new device.",
      });
    }
    person.lastIp = input.ip;
    person.lastUserAgent = input.userAgent;
    const staff = isStaff(person.role);
    const token =
      this.config.env === "demo" && person.id === "person-avery" ? "session-member-demo" : newId("session");
    this.sessions.set(token, {
      token,
      personId: person.id,
      createdAt: this.now(),
      lastActivity: this.now(),
      mfaVerified: !staff,
      stepUpUntil: 0,
      ip: input.ip,
      userAgent: input.userAgent,
      sample: person.sample,
    });
    return { token, mfaRequired: staff, person: this.toPerson(person) };
  }

  signup(input: { email: string; password: string; displayName: string; ip: string; userAgent: string }) {
    const email = input.email.trim().toLowerCase();
    const displayName = input.displayName.trim();
    if (!email || !displayName) throw new AccessError("invalid", "Name and email are required.");
    if (input.password.length < 8) throw new AccessError("invalid", "Use at least 8 characters.");
    const existing = this.byEmail(email);
    if (existing?.passwordHash) throw new AccessError("invalid", "An account with that email already exists.");
    if (existing) {
      existing.passwordHash = hashPassword(input.password);
      if (!existing.displayName) existing.displayName = displayName;
      return this.login({ email, password: input.password, ip: input.ip, userAgent: input.userAgent });
    }
    const id = newId("person");
    const person = this.makePerson({
      id,
      displayName,
      email,
      role: "member",
      householdId: newId("hh"),
      sample: false,
      password: false,
      totp: false,
      listed: false,
    });
    person.passwordHash = hashPassword(input.password);
    this.people.set(id, person);
    return this.login({ email, password: input.password, ip: input.ip, userAgent: input.userAgent });
  }

  verifyMfa(token: string, code: string) {
    const session = this.session(token);
    const person = this.requirePerson(session.personId);
    if (!person.totpSecret || !totpMatches(person.totpSecret, code, this.now())) {
      throw new AccessError("unauthenticated", "That authentication code is wrong.");
    }
    session.mfaVerified = true;
    session.lastActivity = this.now();
    return { mfaVerified: true as const };
  }

  stepUp(token: string, proof: { code?: string; password?: string }) {
    const session = this.session(token);
    const person = this.requirePerson(session.personId);
    if (isStaff(person.role)) {
      if (!session.mfaVerified)
        throw new AccessError("mfa_required", "Finish multi-factor authentication first.");
      if (!proof.code || !person.totpSecret || !totpMatches(person.totpSecret, proof.code, this.now())) {
        throw new AccessError("unauthenticated", "That authentication code is wrong.");
      }
    } else if (
      !proof.password ||
      !person.passwordHash ||
      !verifyPassword(proof.password, person.passwordHash)
    ) {
      throw new AccessError("unauthenticated", "The password didn't match.");
    }
    session.stepUpUntil = this.now() + this.config.stepUpMs;
    session.lastActivity = this.now();
    return { stepUpUntil: session.stepUpUntil };
  }

  loginSampleStaff(input: { ip: string; userAgent: string }) {
    if (this.config.env === "production") {
      throw new AccessError("forbidden", "Sample sign-in is disabled in production.");
    }
    const person = this.byEmail(SAMPLE_PASTOR_EMAIL);
    if (!person?.sample || !person.totpSecret)
      throw new AccessError("forbidden", "Sample pastor is not available.");
    const signed = this.login({
      email: person.email,
      password: SAMPLE_PASSWORD,
      ip: input.ip,
      userAgent: input.userAgent,
    });
    const code = totpCode(person.totpSecret, this.now());
    this.verifyMfa(signed.token, code);
    this.stepUp(signed.token, { code });
    const session = this.sessions.get(signed.token);
    if (!session) throw new AccessError("unauthenticated", "Sign in again.");
    session.sample = true;
    return { ...signed, sample: true as const };
  }

  logout(token: string) {
    this.sessions.delete(token);
  }

  me(token: string) {
    const actor = this.actor(token);
    return this.toPerson(this.requirePerson(actor.personId));
  }

  alertsFor(token: string) {
    const actor = this.actor(token);
    return this.alerts.filter((alert) => alert.personId === actor.personId).map((alert) => ({ ...alert }));
  }

  publicHome() {
    const when = nextSundayService(new Date(this.now()));
    return {
      church: {
        name: CHURCH.name,
        address: `${CHURCH.addressLine}, ${CHURCH.city}, ${CHURCH.region} ${CHURCH.postalCode}`,
        timeZone: CHURCH.timeZone,
        leadPastors: [...CHURCH.leadPastors],
        youtubeHandle: CHURCH.youtubeHandle,
        mapsUrl: CHURCH.mapsUrl,
      },
      countdown: { preService: when.preService.toISOString(), service: when.service.toISOString() },
      announcements: this.announcements.map((item) => ({ ...item })),
      events: this.events.map((event) => this.eventView(event)),
      sampleSermon: {
        sample: false as const,
        title: "A New Season of Growth",
        speaker: "One Hope",
        passage: "Sunday message",
      },
    };
  }

  directory(token: string) {
    const actor = this.actor(token);
    authorize(actor, "view_directory", this.now());
    const listed = [...this.people.values()].filter((person) => person.listedInDirectory && !person.deleted);
    return projectDirectory(actor.personId, listed).map((person) => ({
      id: person.id,
      displayName: person.displayName,
      email: person.email,
      phone: person.phone,
      emailPublic: person.emailPublic,
      phonePublic: person.phonePublic,
    }));
  }

  updateProfile(token: string, input: { emailPublic?: boolean; phonePublic?: boolean; displayName?: string; phone?: string }) {
    const actor = this.actor(token);
    authorize(actor, "edit_own_profile", this.now());
    const person = this.requirePerson(actor.personId);
    if (typeof input.emailPublic === "boolean") person.emailPublic = input.emailPublic;
    if (typeof input.phonePublic === "boolean") person.phonePublic = input.phonePublic;
    if (input.displayName?.trim()) person.displayName = input.displayName.trim();
    if (typeof input.phone === "string") person.phone = input.phone.trim();
    return this.toPerson(person);
  }

  household(token: string) {
    const actor = this.actor(token);
    const people = [...this.people.values()].filter(
      (person) => sameHousehold(actor, person.householdId) && !person.deleted,
    );
    return people.map((person) => ({ id: person.id, displayName: person.displayName, role: person.role }));
  }

  funds() {
    return FUNDS.map((fund) => ({ ...fund }));
  }

  givingAvailability() {
    const secret = this.config.stripeSecretKey;
    const publishable = this.config.stripePublishableKey;
    const testMode = secret.startsWith("sk_test_") && publishable.startsWith("pk_test_");
    const open = canChargeLive(this.config) || testMode;
    return { open, publishableKey: open ? publishable : "" };
  }

  addChild(token: string, input: { displayName: string; classroom: string }) {
    const actor = this.actor(token);
    if (!actor.householdId) throw new AccessError("invalid", "Create your account before adding a child.");
    const child: ChildRow = {
      id: newId("child"),
      householdId: actor.householdId,
      displayName: input.displayName.trim(),
      classroom: input.classroom.trim(),
      ciphertext: encryptString(JSON.stringify({ allergy: "", medical: "", code: "" }), this.key),
      guardianIds: [actor.personId],
      restrictedPersonIds: [],
      sample: false,
    };
    this.children.set(child.id, child);
    this.record(actor, "write", "kid", child.id, 3);
    return { id: child.id, displayName: child.displayName, classroom: child.classroom, sample: false };
  }

  checkIn(token: string, childId: string) {
    const actor = this.actor(token);
    const child = this.requireChild(actor, childId);
    const prior = this.readJson(child.ciphertext);
    const code = String(1000 + Math.floor(Math.random() * 9000));
    const body = prior && typeof prior === "object" ? { ...(prior as Record<string, unknown>), code } : { code };
    child.ciphertext = encryptString(JSON.stringify(body), this.key);
    this.record(actor, "write", "kid_checkin", child.id, 3);
    return { childId: child.id, displayName: child.displayName, code };
  }

  householdPickup(token: string, input: { childId: string; code: string }) {
    const actor = this.actor(token);
    const child = this.requireChild(actor, input.childId);
    const medical = this.readJson(child.ciphertext);
    const expected = textField(medical, "code");
    this.record(actor, "read", "kid_pickup", child.id, 3);
    return evaluatePickup({
      code: input.code,
      expectedCode: expected,
      guardianAuthorized: child.guardianIds.includes(actor.personId),
      custodyRestricted: child.restrictedPersonIds.includes(actor.personId),
      adultsOnDuty: this.station.size,
    });
  }

  createAnnouncement(token: string, input: { title: string; body: string }) {
    const actor = this.requireEditor(token);
    const item = { id: newId("ann"), title: input.title.trim(), body: input.body.trim(), sample: false };
    this.announcements.push(item);
    this.record(actor, "write", "announcement", item.id, 0);
    return item;
  }

  createEvent(token: string, input: { title: string; location: string; start: number; end: number }) {
    const actor = this.requireEditor(token);
    const event = {
      id: newId("event"),
      title: input.title.trim(),
      start: input.start,
      end: input.end,
      location: input.location.trim(),
      description: "",
      capacity: null,
      sample: false,
    };
    this.events.push(event);
    this.record(actor, "write", "event", event.id, 0);
    return event;
  }

  createGroup(token: string, input: { name: string; summary: string }) {
    const actor = this.requireEditor(token);
    const group = {
      id: newId("group"),
      name: input.name.trim(),
      summary: input.summary.trim(),
      sample: false,
      memberIds: [] as string[],
    };
    this.groups.push(group);
    this.record(actor, "write", "group", group.id, 1);
    return group;
  }

  async createGift(
    token: string,
    input: { amountCents: number; fundId: string; recurring: GiftRow["recurring"] },
  ) {
    const actor = this.actor(token);
    authorize(actor, "view_household_tier3", this.now());
    if (!this.flags.giving) throw new AccessError("invalid", "Giving is turned off.");
    if (!actor.householdId) throw new AccessError("invalid", "A household is required before giving.");
    const fund = FUNDS.find((item) => item.id === input.fundId);
    if (!fund) throw new AccessError("invalid", "Unknown fund.");
    let processor: GiftRow["processor"] = "demo";
    if (canChargeLive(this.config)) {
      if (!this.fetchImpl) throw new Error("Stripe is marked live but no HTTP client is configured.");
      const body = new URLSearchParams({
        amount: String(input.amountCents),
        currency: "usd",
        "payment_method_types[]": "card",
        "metadata[church]": "one-hope",
        "metadata[fund]": fund.id,
      });
      await this.fetchImpl("https://api.stripe.com/v1/payment_intents", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });
      processor = "stripe";
    }
    const row: GiftRow = {
      id: newId("gift"),
      householdId: actor.householdId,
      personId: actor.personId,
      ciphertext: encryptString(
        JSON.stringify({ amountCents: input.amountCents, fundId: fund.id }),
        this.key,
      ),
      recurring: input.recurring,
      charged: false,
      processor,
      sample: processor === "demo",
      createdAt: this.now(),
    };
    this.gifts.set(row.id, row);
    this.record(actor, "write", "gift", row.id, 3);
    return this.giftView(actor, row);
  }

  myGifts(token: string): GiftView[] {
    const actor = this.actor(token);
    authorize(actor, "view_household_tier3", this.now());
    return [...this.gifts.values()]
      .filter((gift) => gift.householdId === actor.householdId)
      .map((gift) => this.giftView(actor, gift));
  }

  allGifts(token: string): GiftView[] {
    const actor = this.actor(token);
    authorize(actor, "view_all_giving", this.now());
    return [...this.gifts.values()].map((gift) => this.giftView(actor, gift));
  }

  statement(token: string, year: number) {
    const gifts = this.myGifts(token);
    const lines = gifts
      .filter((gift) => new Date(gift.createdAt).getUTCFullYear() === year)
      .map((gift) => `${gift.fundName},${(gift.amountCents / 100).toFixed(2)},charged=${gift.charged}`);
    return {
      sample: true as const,
      year,
      text: [
        "SAMPLE STATEMENT — not a filed tax receipt",
        `${CHURCH.name}, ${CHURCH.addressLine}, ${CHURCH.city}, ${CHURCH.region} ${CHURCH.postalCode}`,
        `Year ${year}`,
        ...lines,
      ].join("\n"),
    };
  }

  quickbooksCsv(token: string) {
    const gifts = this.allGifts(token);
    const lines = gifts.map((gift) => `${gift.id},${gift.fundId},${gift.amountCents},${gift.charged}`);
    return `id,fund,amountCents,charged\n${lines.join("\n")}\n`;
  }

  listGroups(token: string) {
    const actor = this.actor(token);
    return this.groups.map((group) => ({
      id: group.id,
      name: group.name,
      summary: group.summary,
      sample: group.sample,
      joined: group.memberIds.includes(actor.personId),
    }));
  }

  joinGroup(token: string, groupId: string) {
    const actor = this.actor(token);
    const group = this.groups.find((item) => item.id === groupId);
    if (!group) throw new AccessError("not_found", "That group isn't here.");
    if (!group.memberIds.includes(actor.personId)) group.memberIds.push(actor.personId);
    return { id: group.id, joined: true as const };
  }

  listMessages(token: string, groupId: string) {
    const actor = this.actor(token);
    const group = this.requireGroup(groupId, actor.personId);
    return this.messages
      .filter((message) => message.groupId === group.id)
      .map((message) => ({ ...message, authorName: this.requirePerson(message.authorId).displayName }));
  }

  postMessage(token: string, groupId: string, body: string) {
    const actor = this.actor(token);
    const group = this.requireGroup(groupId, actor.personId);
    const message = { id: newId("msg"), groupId: group.id, authorId: actor.personId, body, sample: true };
    this.messages.push(message);
    return message;
  }

  register(token: string, eventId: string) {
    const actor = this.actor(token);
    const event = this.events.find((item) => item.id === eventId);
    if (!event) throw new AccessError("not_found", "That event isn't here.");
    const existing = this.registrations.find(
      (item) => item.eventId === eventId && item.personId === actor.personId,
    );
    if (existing) return { ...existing };
    const taken = this.registrations.filter(
      (item) => item.eventId === eventId && item.status === "registered",
    ).length;
    const status = event.capacity !== null && taken >= event.capacity ? "waitlist" : "registered";
    const registration = { id: newId("reg"), eventId, personId: actor.personId, status } as const;
    this.registrations.push(registration);
    return { ...registration };
  }

  ics(eventId: string) {
    const event = this.events.find((item) => item.id === eventId);
    if (!event) throw new AccessError("not_found", "That event isn't here.");
    return eventToIcs({
      id: event.id,
      title: event.title,
      start: new Date(event.start),
      end: new Date(event.end),
      location: event.location,
      description: event.description,
    });
  }

  serving(token: string) {
    const actor = this.actor(token);
    return this.schedule
      .filter((item) => item.personId === actor.personId || this.unlocked(actor, "manage_serving"))
      .filter((item) => item.personId === actor.personId || actor.role !== "member")
      .map((item) => ({ ...item, displayName: this.requirePerson(item.personId).displayName }));
  }

  respond(token: string, scheduleId: string, accept: boolean) {
    const actor = this.actor(token);
    const item = this.schedule.find((row) => row.id === scheduleId);
    if (!item) throw new AccessError("not_found", "That assignment isn't here.");
    if (item.personId !== actor.personId)
      throw new AccessError("forbidden", "You can answer your own assignment.");
    item.status = accept ? "accepted" : "declined";
    return { ...item };
  }

  suggestSchedule() {
    const start = ROOM_START;
    const end = ROOM_END;
    return {
      sample: true as const,
      assignments: autoSchedule([{ positionId: "greeter", count: 1 }], this.volunteers, start, end),
    };
  }

  listPrayers(token: string | null) {
    const actor = token ? this.actor(token) : null;
    return this.prayers
      .filter((prayer) => {
        if (prayer.visibility === "public" && prayer.approved) return true;
        if (!actor) return false;
        if (prayer.authorId === actor.personId) return true;
        return prayer.visibility === "private" && this.unlocked(actor, "view_care_notes");
      })
      .map((prayer) => {
        const own = actor?.personId === prayer.authorId;
        const staffReader = actor ? this.unlocked(actor, "view_care_notes") : false;
        const steppedUp = actor !== null && actor.stepUpUntil >= this.now();
        const showBody = prayer.visibility === "public" || ((own || staffReader) && steppedUp);
        if (prayer.visibility === "private" && showBody && actor)
          this.record(actor, "read", "prayer", prayer.id, 3);
        return {
          id: prayer.id,
          visibility: prayer.visibility,
          approved: prayer.approved,
          sample: prayer.sample,
          mine: own,
          body: showBody ? prayer.body : "",
        };
      });
  }

  submitPrayer(token: string, input: { body: string; visibility: "public" | "private" }) {
    const actor = this.actor(token);
    if (input.visibility === "private") authorize(actor, "view_household_tier3", this.now());
    const prayer = {
      id: newId("prayer"),
      authorId: actor.personId,
      body: input.body,
      visibility: input.visibility,
      approved: false,
      sample: true,
    };
    this.prayers.push(prayer);
    if (input.visibility === "private") this.record(actor, "write", "prayer", prayer.id, 3);
    return { id: prayer.id, approved: false as const };
  }

  moderatePrayer(token: string, prayerId: string, approved: boolean) {
    const actor = this.actor(token);
    authorize(actor, "view_care_notes", this.now());
    const prayer = this.prayers.find((item) => item.id === prayerId);
    if (!prayer) throw new AccessError("not_found", "That prayer isn't here.");
    prayer.approved = approved;
    return { id: prayer.id, approved: prayer.approved };
  }

  myPathway(token: string) {
    const actor = this.actor(token);
    return { sample: true as const, ...this.pathwayView(actor.personId) };
  }

  myKids(token: string) {
    const actor = this.actor(token);
    return [...this.children.values()]
      .filter((child) => sameHousehold(actor, child.householdId))
      .map((child) => ({
        id: child.id,
        displayName: child.displayName,
        classroom: child.classroom,
        sample: child.sample,
      }));
  }

  kidSensitive(token: string, childId: string) {
    const actor = this.actor(token);
    const child = this.children.get(childId);
    if (!child) throw new AccessError("not_found", "That child isn't here.");
    const household = sameHousehold(actor, child.householdId);
    if (household) authorize(actor, "view_household_tier3", this.now());
    else authorize(actor, "view_kids_medical", this.now());
    this.record(actor, "read", "kid", child.id, 3);
    const medical = this.readJson(child.ciphertext);
    return {
      id: child.id,
      displayName: child.displayName,
      classroom: child.classroom,
      sample: child.sample,
      allergy: textField(medical, "allergy"),
      medical: textField(medical, "medical"),
      code: textField(medical, "code"),
      restrictedPersonIds: child.restrictedPersonIds,
    };
  }

  roster(token: string) {
    const actor = this.actor(token);
    authorize(actor, "manage_checkin", this.now());
    return [...this.children.values()].map((child) => ({
      id: child.id,
      displayName: child.displayName,
      classroom: child.classroom,
      sample: child.sample,
    }));
  }

  clockIn(token: string) {
    const actor = this.actor(token);
    if (!isStaff(actor.role))
      throw new AccessError("forbidden", "Only staff can clock into a check-in station.");
    if (!actor.mfaVerified)
      throw new AccessError("mfa_required", "Staff must finish multi-factor authentication.");
    this.station.add(actor.personId);
    return { adultsOnDuty: this.station.size };
  }

  pickup(token: string, input: PickupBody) {
    const actor = this.actor(token);
    authorize(actor, "view_kids_medical", this.now());
    const child = this.children.get(input.childId);
    if (!child) throw new AccessError("not_found", "That child isn't here.");
    const medical = this.readJson(child.ciphertext);
    this.record(actor, "read", "kid_pickup", child.id, 3);
    return evaluatePickup({
      code: input.code,
      expectedCode: textField(medical, "code"),
      guardianAuthorized: child.guardianIds.includes(input.guardianPersonId),
      custodyRestricted: child.restrictedPersonIds.includes(input.guardianPersonId),
      adultsOnDuty: this.station.size,
    });
  }

  label(token: string, childId: string) {
    const sensitive = this.kidSensitive(token, childId);
    const zpl = zebraLabel(sensitive.displayName, sensitive.code);
    return {
      sample: true as const,
      zpl,
      brother: `BROTHER LABEL\nOne Hope Kids\n${sensitive.displayName}\nCode ${sensitive.code}\n`,
      socketOpened: false as const,
    };
  }

  modules() {
    return MODULES.map((id) => ({ id, enabled: this.flags[id] }));
  }

  setModule(token: string, moduleId: ModuleId, enabled: boolean) {
    const actor = this.actor(token);
    authorize(actor, "manage_module_flags", this.now());
    this.flags[moduleId] = enabled;
    this.record(actor, "write", "module", moduleId, 2);
    return { id: moduleId, enabled };
  }

  changeRole(token: string, input: RoleChangeBody) {
    const actor = this.actor(token);
    const person = this.requirePerson(input.personId);
    if (input.role === "master_admin" || person.role === "master_admin") {
      throw new AccessError(
        "two_person",
        "Master Admin changes use the two-person proposal, not a direct edit.",
      );
    }
    const staffMove =
      input.role === "pastor" ||
      input.role === "care_team" ||
      input.role === "finance" ||
      input.role === "kids_director" ||
      person.role === "pastor" ||
      person.role === "care_team" ||
      person.role === "finance" ||
      person.role === "kids_director";
    authorize(actor, staffMove ? "grant_staff_roles" : "assign_team_roles", this.now());
    person.role = input.role;
    this.refreshSessions(person);
    this.record(actor, "write", "role", person.id, 2);
    return this.toPerson(person);
  }

  proposeMasterAdmin(token: string, input: ProposalBody) {
    const actor = this.actor(token);
    authorize(actor, "propose_master_admin", this.now());
    const masters = this.masters();
    if (masters.length < 2) {
      throw new AccessError(
        "seat_empty",
        "Both Master Admin seats have to be filled before this role can change. The Lead Pastor email is still open.",
      );
    }
    if (input.action === "grant") {
      throw new AccessError(
        "two_person",
        "There are already two Master Admins. Revoke one, with both approvals, before granting another.",
      );
    }
    const target = this.requirePerson(input.targetPersonId);
    if (target.role !== "master_admin")
      throw new AccessError("invalid", "That person is not a Master Admin.");
    const proposal: Proposal = {
      id: newId("proposal"),
      action: input.action,
      targetPersonId: target.id,
      requestedBy: actor.personId,
      approvals: [actor.personId],
      executed: false,
    };
    this.proposals.set(proposal.id, proposal);
    this.record(actor, "write", "master_admin_proposal", proposal.id, 2);
    return this.finishProposal(proposal, actor);
  }

  approveMasterAdmin(token: string, proposalId: string) {
    const actor = this.actor(token);
    authorize(actor, "propose_master_admin", this.now());
    const proposal = this.proposals.get(proposalId);
    if (!proposal || proposal.executed) throw new AccessError("not_found", "That proposal isn't open.");
    if (!this.masters().some((person) => person.id === actor.personId)) {
      throw new AccessError("forbidden", "Only a current Master Admin can approve this.");
    }
    if (!proposal.approvals.includes(actor.personId)) proposal.approvals.push(actor.personId);
    this.record(actor, "write", "master_admin_proposal", proposal.id, 2);
    return this.finishProposal(proposal, actor);
  }

  audit(token: string) {
    const actor = this.actor(token);
    authorize(actor, "view_audit_log", this.now());
    return this.auditLog.map((entry) => ({ ...entry }));
  }

  integrations(token: string) {
    const actor = this.actor(token);
    if (!isStaff(actor.role)) throw new AccessError("forbidden", "Integrations are a staff view.");
    if (!actor.mfaVerified)
      throw new AccessError("mfa_required", "Staff must finish multi-factor authentication.");
    const reveal = actor.role === "master_admin";
    return [...this.secrets.entries()].map(([provider, value]) => ({
      provider,
      configured: true,
      last4: reveal ? value.last4 : "",
    }));
  }

  setIntegration(token: string, provider: string, secret: string) {
    const actor = this.actor(token);
    authorize(actor, "manage_integrations", this.now());
    this.secrets.set(provider, { ciphertext: encryptString(secret, this.key), last4: secret.slice(-4) });
    this.record(actor, "write", "integration", provider, 2);
    return { provider, configured: true as const, last4: secret.slice(-4) };
  }

  secretMaterial(): string {
    return [...this.secrets.values()].map((value) => value.ciphertext).join("");
  }

  ministry(token: string) {
    const actor = this.actor(token);
    const careOpen = this.unlocked(actor, "view_care_notes");
    const financeOpen = this.unlocked(actor, "view_all_giving");
    const rosterOpen = actor.role === "pastor" || actor.role === "master_admin";
    for (const note of this.notes) {
      if (this.canReadNote(actor, note)) this.record(actor, "read", "care_note", note.id, 3);
    }
    if (careOpen) {
      for (const request of this.requests) this.record(actor, "read", "care_request", request.id, 3);
    }
    return {
      sample: true as const,
      pathways: this.pathwayView(actor.personId),
      pathwayRoster: rosterOpen
        ? [...this.pathways.keys()].map((personId) => this.pathwayView(personId))
        : [],
      care: {
        notes: this.notes.filter((note) => this.canReadNote(actor, note)).map((note) => this.noteView(note)),
        queue: careOpen
          ? {
              locked: false as const,
              visitors: this.visitors.map((visitor) => ({ ...visitor })),
              requests: this.requests.map((request) => ({
                id: request.id,
                kind: request.kind,
                sample: request.sample,
                detail: textField(this.readJson(request.ciphertext), "detail"),
              })),
            }
          : { locked: true as const },
      },
      worship: {
        sample: true as const,
        plans: [
          {
            id: "plan-sunday",
            title: "Sunday gathering",
            sample: true,
            items: ["Gathering", "Scripture", "Message", "Response"],
            songs: [{ title: "Sample song", ccliNumber: null as null, sample: true }],
          },
        ],
      },
      curriculum: [{ id: "lesson-1", title: "Sample: God loves you", ages: "Preschool", sample: true }],
      facilities: {
        rooms: this.rooms.map((room) => ({ ...room })),
        bookings: this.bookings.map((booking) => ({ ...booking })),
      },
      finance: financeOpen
        ? {
            locked: false as const,
            budgets: [
              {
                id: "budget-general",
                name: "General",
                budgetCents: 1000000,
                actualCents: 2500,
                sample: true,
              },
            ],
            expenses: this.expenses.map((expense) => ({ ...expense })),
            funnel: SAMPLE_FUNNEL,
          }
        : { locked: true as const },
      missions: {
        partners: [
          {
            id: "oak-cliff",
            name: "Oak Cliff outreach center",
            sample: false,
            summary: "Food distribution and the clothing closet, from the public One Hope site.",
          },
        ],
        trips: [
          {
            id: "trip-sample",
            name: "Sample local Saturday",
            sample: true,
            raisedCents: 0,
            goalCents: 50000,
          },
        ],
      },
      media: {
        series: [{ id: "series-sample", title: "Sample series", sample: true }],
        chat: [{ id: "chat-1", body: "Sample: glad you're here.", sample: true }],
      },
      communications: this.unlocked(actor, "compose_communications")
        ? { locked: false as const, drafts: this.drafts.map((draft) => ({ ...draft })) }
        : { locked: true as const },
      attendance: rosterOpen
        ? {
            locked: false as const,
            headcounts: [{ id: "count-1", label: "Sample Sunday", count: 180, sample: true }],
          }
        : { locked: true as const },
      retention: RETENTION_YEARS,
      background: this.backgroundView(actor),
    };
  }

  book(token: string, input: { roomId: string; start: number; end: number }) {
    const actor = this.actor(token);
    if (!this.rooms.some((room) => room.id === input.roomId))
      throw new AccessError("not_found", "That room isn't here.");
    const conflict = findRoomConflict(this.bookings, input);
    if (conflict) throw new AccessError("invalid", "That room is already booked then.");
    const booking = { id: newId("book"), roomId: input.roomId, start: input.start, end: input.end };
    this.bookings.push(booking);
    this.record(actor, "write", "booking", booking.id, 2);
    return booking;
  }

  submitExpense(token: string, input: { memo: string; amountCents: number }) {
    const actor = this.actor(token);
    const expense = {
      id: newId("expense"),
      personId: actor.personId,
      memo: input.memo,
      amountCents: input.amountCents,
      state: "submitted" as const,
      sample: true,
    };
    this.expenses.push(expense);
    return { ...expense };
  }

  decideExpense(token: string, expenseId: string, action: "approve" | "deny") {
    const actor = this.actor(token);
    authorize(actor, "approve_expenses", this.now());
    const expense = this.expenses.find((item) => item.id === expenseId);
    if (!expense) throw new AccessError("not_found", "That expense isn't here.");
    expense.state = transitionExpense(expense.state, action);
    return { ...expense };
  }

  updatePathway(token: string, input: { personId: string; stepId: string; status: string }) {
    const actor = this.actor(token);
    if (input.personId !== actor.personId && actor.role !== "pastor" && actor.role !== "master_admin") {
      throw new AccessError("forbidden", "You can update your own next steps.");
    }
    const steps = this.pathways.get(input.personId);
    const step = steps?.find((item) => item.id === input.stepId);
    if (!step) throw new AccessError("not_found", "That step isn't here.");
    step.status = input.status;
    return this.pathwayView(input.personId);
  }

  sendPush(token: string, input: PushBody) {
    const actor = this.actor(token);
    authorize(actor, "compose_communications", this.now());
    const draft = { id: newId("draft"), title: input.title, segment: input.segment, sample: true };
    this.drafts.push(draft);
    this.record(actor, "write", "push_draft", draft.id, 2);
    return {
      sent: false as const,
      reason: "Sends are disabled in this build.",
      title: input.title,
      segment: input.segment,
    };
  }

  exportSelf(token: string) {
    const actor = this.actor(token);
    const person = this.requirePerson(actor.personId);
    const stepped = actor.stepUpUntil >= this.now();
    const gifts = stepped ? this.myGifts(token) : [];
    const kids = stepped
      ? [...this.children.values()]
          .filter((child) => sameHousehold(actor, child.householdId))
          .map((child) => this.kidSensitive(token, child.id))
      : this.myKids(token);
    const notes = stepped
      ? this.notes
          .filter((note) => note.subjectPersonId === actor.personId)
          .map((note) => this.noteView(note))
      : [];
    const prayers = this.prayers
      .filter((prayer) => prayer.authorId === actor.personId)
      .map((prayer) => ({
        id: prayer.id,
        visibility: prayer.visibility,
        body: stepped || prayer.visibility === "public" ? prayer.body : "",
      }));
    return {
      person: this.toPerson(person),
      household: this.household(token),
      tier3Included: stepped,
      gifts,
      kids,
      notes,
      prayers,
      retention: RETENTION_YEARS,
      retentionDue: eligibleForRetention(SEED_AT, this.now(), RETENTION_YEARS.giving),
    };
  }

  deleteSelf(token: string) {
    const actor = this.actor(token);
    authorize(actor, "view_household_tier3", this.now());
    const person = this.requirePerson(actor.personId);
    const others = [...this.people.values()].filter(
      (item) => item.id !== person.id && sameHousehold(actor, item.householdId) && !item.deleted,
    );
    if (others.length === 0 && actor.householdId) {
      for (const [id, gift] of this.gifts) if (gift.householdId === actor.householdId) this.gifts.delete(id);
      for (const [id, child] of this.children)
        if (child.householdId === actor.householdId) this.children.delete(id);
    }
    this.prayers.splice(
      0,
      this.prayers.length,
      ...this.prayers.filter((prayer) => prayer.authorId !== person.id),
    );
    person.deleted = true;
    person.email = "";
    person.phone = "";
    person.passwordHash = null;
    person.totpSecret = null;
    person.displayName = "Former member";
    person.listedInDirectory = false;
    for (const [tokenKey, session] of this.sessions)
      if (session.personId === person.id) this.sessions.delete(tokenKey);
    this.record(actor, "write", "person_delete", person.id, 3);
    return { deleted: true as const };
  }

  storedGiftCiphertext(id: string) {
    return this.gifts.get(id)?.ciphertext ?? "";
  }

  private finishProposal(proposal: Proposal, actor: Actor) {
    const masters = this.masters();
    const ready = masters.length >= 2 && masters.every((person) => proposal.approvals.includes(person.id));
    if (ready && proposal.action === "revoke") {
      const target = this.requirePerson(proposal.targetPersonId);
      target.role = "member";
      this.refreshSessions(target);
      proposal.executed = true;
      this.record(actor, "write", "master_admin", target.id, 2);
    }
    return {
      id: proposal.id,
      action: proposal.action,
      targetPersonId: proposal.targetPersonId,
      approvals: [...proposal.approvals],
      executed: proposal.executed,
      seated: this.masters().map((person) => person.id),
    };
  }

  private refreshSessions(person: Person) {
    for (const session of this.sessions.values()) {
      if (session.personId !== person.id) continue;
      session.mfaVerified = !isStaff(person.role);
      session.stepUpUntil = 0;
    }
  }

  private applyOverrides(options: StoreOptions) {
    for (const [email, password] of Object.entries(options.passwordOverrides ?? {})) {
      const person = this.byEmail(email);
      if (person) person.passwordHash = hashPassword(password);
    }
    for (const [email, secret] of Object.entries(options.totpOverrides ?? {})) {
      const person = this.byEmail(email);
      if (person) person.totpSecret = decodeBase32(secret);
    }
  }

  private ensureSeat(email: string, name: string) {
    const cleaned = email.trim().toLowerCase();
    if (!cleaned) return;
    const existing = this.byEmail(cleaned);
    if (existing) {
      existing.role = "master_admin";
      existing.listedInDirectory = false;
      return;
    }
    const person = this.makePerson({
      id: newId("person"),
      displayName: name,
      email: cleaned,
      role: "master_admin",
      householdId: null,
      sample: false,
      password: false,
      totp: false,
      listed: false,
    });
    this.people.set(person.id, person);
  }

  private seatView(name: string, email: string) {
    const person = email.trim() ? this.byEmail(email) : undefined;
    return {
      name,
      email,
      filled: Boolean(person && person.role === "master_admin" && !person.deleted),
    };
  }

  private masters() {
    return [...this.people.values()].filter((person) => person.role === "master_admin" && !person.deleted);
  }

  private actor(token: string): Actor {
    const session = this.session(token);
    const person = this.requirePerson(session.personId);
    if (person.deleted) throw new AccessError("unauthenticated", "Sign in again.");
    if (isStaff(person.role) && !session.mfaVerified) {
      throw new AccessError("mfa_required", "Staff must finish multi-factor authentication.");
    }
    if (
      this.config.env === "demo" &&
      (session.userAgent === "member-demo" || session.userAgent === "staff-demo")
    ) {
      session.lastActivity = this.now();
      if (session.userAgent === "staff-demo") session.stepUpUntil = this.now() + this.config.stepUpMs;
    }
    const idle = isStaff(person.role) ? this.config.sessionIdleStaffMs : this.config.sessionIdleMemberMs;
    if (this.now() - session.lastActivity > idle) {
      this.sessions.delete(token);
      throw new AccessError("session_expired", "Your session timed out.");
    }
    session.lastActivity = this.now();
    return {
      personId: person.id,
      householdId: person.householdId,
      role: person.role,
      mfaVerified: session.mfaVerified,
      stepUpUntil: session.stepUpUntil,
      sample: person.sample,
    };
  }

  private session(token: string) {
    const session = this.sessions.get(token);
    if (!session) throw new AccessError("unauthenticated", "Sign in again.");
    return session;
  }

  private unlocked(actor: Actor, action: Parameters<typeof authorize>[1]) {
    try {
      authorize(actor, action, this.now());
      return true;
    } catch (error) {
      if (error instanceof AccessError) return false;
      throw error;
    }
  }

  private record(
    actor: Actor,
    action: AuditEntry["action"],
    resource: string,
    resourceId: string,
    tier: AuditEntry["tier"],
  ) {
    this.auditLog.push({
      id: newId("audit"),
      at: this.now(),
      actorId: actor.personId,
      action,
      resource,
      resourceId,
      tier,
    });
  }

  private giftView(actor: Actor, row: GiftRow): GiftView {
    this.record(actor, "read", "gift", row.id, 3);
    const payload = this.readJson(row.ciphertext);
    const fundId = textField(payload, "fundId");
    const amount =
      payload && typeof payload === "object" && "amountCents" in payload ? payload.amountCents : 0;
    return {
      id: row.id,
      householdId: row.householdId,
      fundId,
      fundName: FUNDS.find((fund) => fund.id === fundId)?.name ?? fundId,
      amountCents: typeof amount === "number" ? amount : 0,
      recurring: row.recurring,
      charged: row.charged,
      processor: row.processor,
      sample: row.sample,
      createdAt: row.createdAt,
    };
  }

  private canReadNote(actor: Actor, note: { subjectPersonId: string; sharedWith: string[] }) {
    if (!(actor.stepUpUntil >= this.now())) return false;
    if (note.subjectPersonId === actor.personId || note.sharedWith.includes(actor.personId)) return true;
    return this.unlocked(actor, "view_care_notes");
  }

  private noteView(note: { id: string; subjectPersonId: string; ciphertext: string; sample: boolean }) {
    return {
      id: note.id,
      subjectPersonId: note.subjectPersonId,
      sample: note.sample,
      body: textField(this.readJson(note.ciphertext), "body"),
    };
  }

  private backgroundView(actor: Actor) {
    const rows = [...this.checks.values()].filter((check) => {
      if (check.personId === actor.personId && actor.stepUpUntil >= this.now()) return true;
      return this.unlocked(actor, "view_background_checks");
    });
    for (const check of rows) this.record(actor, "read", "background_check", check.personId, 3);
    return rows.map((check) => ({
      personId: check.personId,
      status: check.status,
      sample: check.sample,
      notes: textField(this.readJson(check.ciphertext), "notes"),
    }));
  }

  private pathwayView(personId: string) {
    const person = this.people.get(personId);
    return {
      personId,
      displayName: person?.displayName ?? "",
      steps: (this.pathways.get(personId) ?? []).map((step) => ({ ...step })),
    };
  }

  private eventView(event: (typeof this.events)[number]) {
    return {
      id: event.id,
      title: event.title,
      start: event.start,
      end: event.end,
      location: event.location,
      description: event.description,
      capacity: event.capacity,
      sample: event.sample,
    };
  }

  private requireGroup(groupId: string, personId: string) {
    const group = this.groups.find((item) => item.id === groupId);
    if (!group || !group.memberIds.includes(personId))
      throw new AccessError("not_found", "That group isn't on your list.");
    return group;
  }

  private requireChild(actor: Actor, childId: string): ChildRow {
    const child = this.children.get(childId);
    if (!child || !sameHousehold(actor, child.householdId)) {
      throw new AccessError("not_found", "That child isn't in your household.");
    }
    return child;
  }

  private requireEditor(token: string): Actor {
    const actor = this.actor(token);
    if (actor.role !== "master_admin" && actor.role !== "pastor" && actor.role !== "team_leader") {
      throw new AccessError("forbidden", "Only pastors and leaders can publish this.");
    }
    return actor;
  }

  private requirePerson(id: string) {
    const person = this.people.get(id);
    if (!person) throw new AccessError("not_found", "That person isn't here.");
    return person;
  }

  private byEmail(email: string) {
    const cleaned = email.trim().toLowerCase();
    return [...this.people.values()].find((person) => person.email.toLowerCase() === cleaned);
  }

  private toPerson(person: Person): PersonView {
    return {
      id: person.id,
      displayName: person.displayName,
      email: person.email,
      phone: person.phone,
      role: person.role,
      householdId: person.householdId,
      sample: person.sample,
      emailPublic: person.emailPublic,
      phonePublic: person.phonePublic,
    };
  }

  private readJson(ciphertext: string): unknown {
    try {
      return JSON.parse(decryptString(ciphertext, this.key)) as unknown;
    } catch {
      throw new Error("Stored field could not be decrypted.");
    }
  }

  private makePerson(input: {
    id: string;
    displayName: string;
    email: string;
    role: Role;
    householdId: string | null;
    sample: boolean;
    password: boolean;
    totp: boolean;
    listed: boolean;
    emailPublic?: boolean;
    phone?: string;
    phonePublic?: boolean;
  }): Person {
    return {
      id: input.id,
      displayName: input.displayName,
      email: input.email,
      phone: input.phone ?? "",
      role: input.role,
      householdId: input.householdId,
      sample: input.sample,
      emailPublic: input.emailPublic ?? false,
      phonePublic: input.phonePublic ?? false,
      passwordHash: input.password ? this.sampleHash() : null,
      totpSecret: input.totp ? decodeBase32(SAMPLE_TOTP_BASE32) : null,
      listedInDirectory: input.listed,
      deleted: false,
      lastIp: null,
      lastUserAgent: null,
    };
  }

  private sampleHash() {
    return this.sharedSampleHash();
  }

  private sharedSampleHash(): string {
    const g = globalThis as typeof globalThis & { __onehopeSampleHash?: string };
    if (!g.__onehopeSampleHash) g.__onehopeSampleHash = hashPassword(SAMPLE_PASSWORD);
    return g.__onehopeSampleHash;
  }

  private loadPublic() {
    this.people.set(
      "person-nicholas",
      this.makePerson({
        id: "person-nicholas",
        displayName: this.config.masterAdminPrimaryName,
        email: this.config.masterAdminPrimaryEmail,
        role: "master_admin",
        householdId: null,
        sample: false,
        password: false,
        totp: false,
        listed: false,
      }),
    );
    const service = nextSundayService(new Date(this.now()));
    this.announcements.push(
      {
        id: "ann-sunday",
        title: "Sunday gathering",
        body: "10:30 a.m. Come early for donuts and coffee.",
        sample: false,
      },
      {
        id: "ann-kids",
        title: "One Hope Kids",
        body: "Kids ministry is open during the Sunday gathering, from 3 months through 5th grade.",
        sample: false,
      },
    );
    this.events.push({
      id: "event-sunday",
      title: "Sunday gathering",
      start: service.service.getTime(),
      end: service.service.getTime() + 90 * 60 * 1000,
      location: `${CHURCH.addressLine}, ${CHURCH.city}, ${CHURCH.region} ${CHURCH.postalCode}`,
      description: "Worship at 10:30 a.m. Come early for donuts and coffee.",
      capacity: null,
      sample: false,
    });
    this.groups.push(
      {
        id: "group-kids",
        name: "One Hope Kids",
        summary: "During Sunday for ages 3 months through 5th grade. Kids meet friends and learn about God.",
        sample: false,
        memberIds: [],
      },
      {
        id: "group-small",
        name: "Small Groups",
        summary: "Grow your faith and build friendships through the week.",
        sample: false,
        memberIds: [],
      },
      {
        id: "group-growth",
        name: "Growth Track",
        summary: "Hear the vision of One Hope, discover your purpose, and find a place to serve.",
        sample: false,
        memberIds: [],
      },
    );
  }

  private loadSample() {
    const add = (person: Person) => this.people.set(person.id, person);
    add(
      this.makePerson({
        id: "person-nicholas",
        displayName: this.config.masterAdminPrimaryName,
        email: this.config.masterAdminPrimaryEmail,
        role: "master_admin",
        householdId: null,
        sample: false,
        password: false,
        totp: false,
        listed: false,
      }),
    );
    add(
      this.makePerson({
        id: "person-reese",
        displayName: "Reese Sample",
        email: SAMPLE_PASTOR_EMAIL,
        role: "pastor",
        householdId: "hh-staff",
        sample: true,
        password: true,
        totp: true,
        listed: true,
        emailPublic: true,
      }),
    );
    add(
      this.makePerson({
        id: "person-eden",
        displayName: "Eden Sample",
        email: "eden@sample.onehope",
        role: "care_team",
        householdId: "hh-staff",
        sample: true,
        password: true,
        totp: true,
        listed: true,
      }),
    );
    add(
      this.makePerson({
        id: "person-dana",
        displayName: "Dana Sample",
        email: "dana@sample.onehope",
        role: "finance",
        householdId: "hh-staff",
        sample: true,
        password: true,
        totp: true,
        listed: true,
      }),
    );
    add(
      this.makePerson({
        id: "person-frankie",
        displayName: "Frankie Sample",
        email: "frankie@sample.onehope",
        role: "kids_director",
        householdId: "hh-staff",
        sample: true,
        password: true,
        totp: true,
        listed: true,
      }),
    );
    add(
      this.makePerson({
        id: "person-gray",
        displayName: "Gray Sample",
        email: "gray@sample.onehope",
        role: "team_leader",
        householdId: "hh-vol",
        sample: true,
        password: true,
        totp: true,
        listed: true,
      }),
    );
    add(
      this.makePerson({
        id: "person-harper",
        displayName: "Harper Sample",
        email: "harper@sample.onehope",
        role: "volunteer",
        householdId: "hh-vol",
        sample: true,
        password: true,
        totp: false,
        listed: true,
        phone: "214-555-0100",
        phonePublic: true,
      }),
    );
    add(
      this.makePerson({
        id: "person-avery",
        displayName: "Avery Sample",
        email: "avery@sample.onehope",
        role: "member",
        householdId: "hh-avery",
        sample: true,
        password: true,
        totp: false,
        listed: true,
        emailPublic: true,
        phone: "214-555-0142",
        phonePublic: false,
      }),
    );
    add(
      this.makePerson({
        id: "person-blake",
        displayName: "Blake Sample",
        email: "blake@sample.onehope",
        role: "member",
        householdId: "hh-avery",
        sample: true,
        password: true,
        totp: false,
        listed: true,
      }),
    );
    add(
      this.makePerson({
        id: "person-casey",
        displayName: "Casey Sample",
        email: "casey@sample.onehope",
        role: "member",
        householdId: "hh-casey",
        sample: true,
        password: true,
        totp: false,
        listed: true,
        phone: "214-555-0199",
        phonePublic: false,
      }),
    );

    const gift = (id: string, householdId: string, personId: string, amountCents: number, fundId: string) => {
      this.gifts.set(id, {
        id,
        householdId,
        personId,
        ciphertext: encryptString(JSON.stringify({ amountCents, fundId }), this.key),
        recurring: "once",
        charged: false,
        processor: "demo",
        sample: true,
        createdAt: SEED_AT,
      });
    };
    gift("gift-avery", "hh-avery", "person-avery", 2500, "general");
    gift("gift-casey", "hh-casey", "person-casey", 4100, "outreach");

    const child = (
      row: Omit<ChildRow, "ciphertext"> & { allergy: string; medical: string; code: string },
    ) => {
      this.children.set(row.id, {
        id: row.id,
        householdId: row.householdId,
        displayName: row.displayName,
        classroom: row.classroom,
        guardianIds: row.guardianIds,
        restrictedPersonIds: row.restrictedPersonIds,
        sample: row.sample,
        ciphertext: encryptString(
          JSON.stringify({ allergy: row.allergy, medical: row.medical, code: row.code }),
          this.key,
        ),
      });
    };
    child({
      id: "child-remy",
      householdId: "hh-avery",
      displayName: "Remy Sample",
      classroom: "Preschool",
      guardianIds: ["person-avery", "person-blake"],
      restrictedPersonIds: ["person-blake"],
      sample: true,
      allergy: "Sample: peanut allergy",
      medical: "Sample: no other notes",
      code: "4821",
    });
    child({
      id: "child-quinn",
      householdId: "hh-casey",
      displayName: "Quinn Sample",
      classroom: "Elementary",
      guardianIds: ["person-casey"],
      restrictedPersonIds: ["person-avery"],
      sample: true,
      allergy: "Sample: none",
      medical: "Sample: none",
      code: "9090",
    });

    this.notes.push({
      id: "note-avery",
      subjectPersonId: "person-avery",
      authorId: "person-eden",
      ciphertext: encryptString(JSON.stringify({ body: "Sample care note for Avery." }), this.key),
      sharedWith: [],
      sample: true,
    });
    this.notes.push({
      id: "note-casey",
      subjectPersonId: "person-casey",
      authorId: "person-eden",
      ciphertext: encryptString(JSON.stringify({ body: "Sample care note for Casey." }), this.key),
      sharedWith: ["person-harper"],
      sample: true,
    });
    this.checks.set("person-harper", {
      personId: "person-harper",
      status: "cleared",
      ciphertext: encryptString(JSON.stringify({ notes: "Sample: cleared for kids ministry." }), this.key),
      sample: true,
    });
    this.announcements.push(
      {
        id: "ann-service",
        title: "Sunday",
        body: "Pre-service coffee at 10:00 a.m. Gathering at 10:30 a.m.",
        sample: false,
      },
      {
        id: "ann-sample",
        title: "Sample: Growth Track",
        body: "Sample class dates, not a live registration.",
        sample: true,
      },
    );
    this.events.push(
      {
        id: "event-sunday",
        title: "Sunday gathering",
        start: ROOM_START,
        end: ROOM_END,
        location: `${CHURCH.addressLine}, ${CHURCH.city}`,
        description: "Weekly gathering. Pre-service at 10:00 a.m.",
        capacity: null,
        sample: false,
      },
      {
        id: "event-workshop",
        title: "Sample workshop",
        start: ROOM_START,
        end: ROOM_END,
        location: "Lobby",
        description: "Sample event used to show the waitlist.",
        capacity: 1,
        sample: true,
      },
    );
    this.registrations.push({
      id: "reg-harper",
      eventId: "event-workshop",
      personId: "person-harper",
      status: "registered",
    });
    this.groups.push({
      id: "group-weekday",
      name: "Sample weekday group",
      summary: "A sample group you can join.",
      sample: true,
      memberIds: ["person-harper"],
    });
    this.messages.push({
      id: "msg-1",
      groupId: "group-weekday",
      authorId: "person-harper",
      body: "Sample: see you Thursday.",
      sample: true,
    });
    this.prayers.push(
      {
        id: "prayer-public",
        authorId: "person-harper",
        body: "Sample: pray for our city.",
        visibility: "public",
        approved: true,
        sample: true,
      },
      {
        id: "prayer-avery",
        authorId: "person-avery",
        body: "Sample private: Avery's unspoken request.",
        visibility: "private",
        approved: false,
        sample: true,
      },
      {
        id: "prayer-casey",
        authorId: "person-casey",
        body: "Sample private: Casey's family request.",
        visibility: "private",
        approved: false,
        sample: true,
      },
      {
        id: "prayer-pending",
        authorId: "person-blake",
        body: "Sample: waiting for a moderator.",
        visibility: "public",
        approved: false,
        sample: true,
      },
    );
    this.schedule.push({
      id: "sched-gray",
      personId: "person-gray",
      position: "Greeter",
      status: "pending",
      sample: true,
    });
    this.volunteers.push(
      { personId: "person-harper", positionId: "greeter", blockouts: [{ start: ROOM_START, end: ROOM_END }] },
      { personId: "person-gray", positionId: "greeter", blockouts: [] },
    );
    this.rooms.push(
      { id: "room-auditorium", name: "Auditorium", campus: "Richardson" },
      { id: "room-lobby", name: "Lobby", campus: "Richardson" },
    );
    this.bookings.push({ id: "book-sunday", roomId: "room-auditorium", start: ROOM_START, end: ROOM_END });
    this.expenses.push({
      id: "expense-1",
      personId: "person-gray",
      memo: "Sample supplies",
      amountCents: 4200,
      state: "submitted",
      sample: true,
    });
    this.pathways.set("person-avery", [
      { id: "salvation", title: "Salvation", status: "complete" },
      { id: "baptism", title: "Baptism", status: "in-progress" },
      { id: "membership", title: "Membership", status: "not-started" },
      { id: "growth-track", title: "Growth Track", status: "not-started" },
    ]);
    this.pathways.set("person-casey", [
      { id: "salvation", title: "Salvation", status: "not-started" },
      { id: "baptism", title: "Baptism", status: "not-started" },
      { id: "membership", title: "Membership", status: "not-started" },
      { id: "growth-track", title: "Growth Track", status: "not-started" },
    ]);
    this.visitors.push({ id: "visitor-1", name: "Jordan Sample", state: "assigned", sample: true });
    this.requests.push({
      id: "request-1",
      kind: "benevolence",
      personId: "person-avery",
      ciphertext: encryptString(JSON.stringify({ detail: "Sample benevolence request." }), this.key),
      sample: true,
    });
  }

  toDocument(): StoreDocument {
    return {
      version: 1,
      people: [...this.people.values()].map((person) => ({
        ...person,
        totpSecret: person.totpSecret ? person.totpSecret.toString("base64") : null,
      })),
      gifts: [...this.gifts.values()],
      children: [...this.children.values()],
      sessions: [...this.sessions.values()],
      auditLog: this.auditLog.map((entry) => ({ ...entry })),
      alerts: this.alerts.map((alert) => ({ ...alert })),
      proposals: [...this.proposals.values()].map((proposal) => ({
        ...proposal,
        approvals: [...proposal.approvals],
      })),
      secrets: [...this.secrets.entries()].map(([provider, secret]) => ({ provider, ...secret })),
      station: [...this.station],
      flags: { ...this.flags },
      groups: this.groups.map((group) => ({ ...group, memberIds: [...group.memberIds] })),
      messages: this.messages.map((message) => ({ ...message })),
      events: this.events.map((event) => ({ ...event })),
      registrations: this.registrations.map((registration) => ({ ...registration })),
      announcements: this.announcements.map((item) => ({ ...item })),
      prayers: this.prayers.map((prayer) => ({ ...prayer })),
      notes: this.notes.map((note) => ({ ...note, sharedWith: [...note.sharedWith] })),
      checks: [...this.checks.values()].map((check) => ({ ...check })),
      schedule: this.schedule.map((item) => ({ ...item })),
      volunteers: this.volunteers.map((volunteer) => ({
        ...volunteer,
        blockouts: volunteer.blockouts.map((block) => ({ ...block })),
      })),
      rooms: this.rooms.map((room) => ({ ...room })),
      bookings: this.bookings.map((booking) => ({ ...booking })),
      expenses: this.expenses.map((expense) => ({ ...expense })),
      pathways: [...this.pathways.entries()].map(([personId, steps]) => ({
        personId,
        steps: steps.map((step) => ({ ...step })),
      })),
      visitors: this.visitors.map((visitor) => ({ ...visitor })),
      requests: this.requests.map((request) => ({ ...request })),
      drafts: this.drafts.map((draft) => ({ ...draft })),
    };
  }

  installDocument(document: StoreDocument): void {
    if (document.version !== 1) throw new Error("This demo snapshot version is not supported.");
    this.people.clear();
    for (const person of document.people) {
      this.people.set(person.id, {
        ...person,
        totpSecret: person.totpSecret ? Buffer.from(person.totpSecret, "base64") : null,
      });
    }
    replaceMap(this.gifts, document.gifts);
    replaceMap(this.children, document.children);
    this.sessions.clear();
    for (const session of document.sessions) this.sessions.set(session.token, session);
    this.auditLog.splice(0, this.auditLog.length, ...document.auditLog);
    this.alerts.splice(0, this.alerts.length, ...document.alerts);
    this.proposals.clear();
    for (const proposal of document.proposals) this.proposals.set(proposal.id, proposal);
    this.secrets.clear();
    for (const secret of document.secrets) {
      this.secrets.set(secret.provider, { ciphertext: secret.ciphertext, last4: secret.last4 });
    }
    this.station.clear();
    for (const personId of document.station) this.station.add(personId);
    for (const id of MODULES) this.flags[id] = document.flags[id] ?? true;
    this.groups.splice(0, this.groups.length, ...document.groups);
    this.messages.splice(0, this.messages.length, ...document.messages);
    this.events.splice(0, this.events.length, ...document.events);
    this.registrations.splice(0, this.registrations.length, ...document.registrations);
    this.announcements.splice(0, this.announcements.length, ...document.announcements);
    this.prayers.splice(0, this.prayers.length, ...document.prayers);
    this.notes.splice(0, this.notes.length, ...document.notes);
    this.checks.clear();
    for (const check of document.checks) this.checks.set(check.personId, check);
    this.schedule.splice(0, this.schedule.length, ...document.schedule);
    this.volunteers.splice(0, this.volunteers.length, ...document.volunteers);
    this.rooms.splice(0, this.rooms.length, ...document.rooms);
    this.bookings.splice(0, this.bookings.length, ...document.bookings);
    this.expenses.splice(0, this.expenses.length, ...document.expenses);
    this.pathways.clear();
    for (const pathway of document.pathways) this.pathways.set(pathway.personId, pathway.steps);
    this.visitors.splice(0, this.visitors.length, ...document.visitors);
    this.requests.splice(0, this.requests.length, ...document.requests);
    this.drafts.splice(0, this.drafts.length, ...document.drafts);
    this.ensureDemoSessions();
  }

  private ensureDemoSessions() {
    if (this.config.env !== "demo") return;
    if (!this.sessions.has("session-member-demo")) {
      this.sessions.set("session-member-demo", {
        token: "session-member-demo",
        personId: "person-avery",
        createdAt: this.now(),
        lastActivity: this.now(),
        mfaVerified: true,
        stepUpUntil: 0,
        ip: "demo",
        userAgent: "member-demo",
        sample: true,
      });
    }
    if (!this.sessions.has("session-staff-demo")) {
      this.sessions.set("session-staff-demo", {
        token: "session-staff-demo",
        personId: "person-reese",
        createdAt: this.now(),
        lastActivity: this.now(),
        mfaVerified: true,
        stepUpUntil: this.now() + this.config.stepUpMs,
        ip: "demo",
        userAgent: "staff-demo",
        sample: true,
      });
    }
  }
}

function replaceMap<T extends { id: string }>(target: Map<string, T>, rows: T[]) {
  target.clear();
  for (const row of rows) target.set(row.id, row);
}

function textField(value: unknown, key: string): string {
  if (!value || typeof value !== "object" || !(key in value)) return "";
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" ? field : "";
}
