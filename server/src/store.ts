import { createHash, createHmac, randomBytes, randomInt } from "node:crypto";

import {
  CHURCH_EVENTS,
  CHURCH_GROUPS,
  GIVING_FUNDS,
  GIVING_WAYS,
  type GivingFrequency,
  INVITE,
  RECOVERY,
  RETIRED_GROUP_IDS,
  SUPPORT,
  SUPPORT_NEEDS,
  type SupportNeedId,
  TOOLKIT,
  VISIT,
  type PublicGroup,
} from "./church-copy";
import type { AppConfig } from "./config";
import { demoFieldKey, loadConfig } from "./config";
import type {
  FollowUpBody,
  GiftView,
  PersonView,
  PickupBody,
  ProposalBody,
  PushBody,
  RoleChangeBody,
  SupportBody,
} from "./contracts";
import { localAuthProvider } from "./auth-provider";
import { decryptString, encryptString, newId } from "./crypto";
import {
  type Actor,
  type Booking,
  type ModuleId,
  type Role,
  AccessError,
  CHURCH,
  allows,
  labelRole,
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
  KIDS_POSITION_ID,
  SERVING_SPOTS,
  isStaff,
  mayChangeRole,
  mayIssueInvite,
  nextSundayService,
  projectDirectory,
  sameHousehold,
  transitionExpense,
  zebraLabel,
} from "./domain";
import { coffeeGuide } from "./coffee";
import {
  CHANNEL_LABELS,
  DEFAULT_PLAYBOOKS,
  MAX_ATTEMPTS,
  PRAYER_ONLY_STEP,
  bucketFor,
  dueAtFor,
  fillScript,
  firstName,
  isTaskOutcome,
  pickCareSeat,
  triggerFor,
  type CareTaskRow,
  type PlaybookDefinition,
  type PlaybookRow,
  type PlaybookStep,
} from "./care-engine";
import {
  NOTE_LIMIT,
  OUTCOME_LABELS,
  TOUCH_PAGE,
  STAGE_LABELS,
  STAGES,
  TAG_KINDS,
  TOUCH_KINDS,
  TOUCH_LABELS,
  TOUCH_OUTCOMES,
  cleanTagName,
  countsAsContact,
  defaultStage,
  isChurchRole,
  isQuiet,
  isStage,
  isTagKind,
  isTouchKind,
  isTouchOutcome,
  personTagId,
  reachesOut,
  seesEveryone,
  type PersonProfileRow,
  type PersonTagRow,
  type Stage,
  type TagKind,
  type TagRow,
  type TouchKind,
  type TouchOutcome,
  type TouchRow,
} from "./people-care";
import {
  announcementIsLive,
  type AnnouncementCard,
  formatChicago,
  windowError,
} from "./staff-desk";
import {
  DEFAULT_PATHWAY,
  FOLLOW_UP_LABELS,
  FOLLOW_UP_PATHWAY,
  JOURNEY_MONTH,
  NEW_BELIEVER_JOURNEY,
  presentGospel,
  presentJourney,
  type FollowUpKind,
  type FollowUpStatus,
  currentStreak,
  dailyReading,
  greeting,
  nextStreak,
  streakEncouragement,
} from "./faith";
import { EMPTY_MEDIA, blankImages } from "./media";
import { inviteUrl } from "./public-url";
import { SITE_SOCIAL, type SocialLink, cleanSocialLinks } from "./social";
import {
  createSquareOrder,
  createSquarePayment,
  listSquareVariations,
  squareSettings,
  verifySquareSignature,
} from "./square";
import { SAMPLE_PASSWORD, SAMPLE_PASTOR_EMAIL, SAMPLE_TOTP_BASE32 } from "./sample-accounts";
import { decodeBase32, encodeBase32, totpCode, totpMatches } from "./totp";

type GiftRow = {
  id: string;
  householdId: string;
  personId: string;
  ciphertext: string;
  recurring: GivingFrequency;
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
  /** Who added this person from the desk, and when. Sample seats leave both empty. */
  addedBy?: string | null;
  addedAt?: number | null;
};

type IssuedInvite = {
  email: string;
  expires: number;
  issuerRole: Role | null;
  issuerId: string;
};

/** Undo an add only while the same person is still signed in. Staff sessions last 15 minutes. */
const UNDO_ADD_MS = 10 * 60 * 1000;

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
  /** Base32 secret while a staff member is setting up an authenticator. Never logged. */
  pendingTotp?: string | null;
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

type FollowUpRow = {
  id: string;
  kind: FollowUpKind;
  /** Null when a guest sent it without an account. */
  personId: string | null;
  /** Encrypted `{ name, email, phone }`, plus `needs` on a support request. */
  ciphertext: string;
  contactConsent: boolean;
  status: FollowUpStatus;
  createdAt: number;
  sample: boolean;
  assigneeId?: string | null;
  dueAt?: number | null;
  /** Encrypted `{ note }` written by staff. Older rows omit it. */
  noteCiphertext?: string;
};

/** Church Center fields are optional so groups staff create, and snapshots from builds 1–5, still load. */
type GroupRow = {
  id: string;
  name: string;
  summary: string;
  sample: boolean;
  memberIds: string[];
} & Partial<Omit<PublicGroup, "id" | "name" | "summary">>;

type EventRow = {
  id: string;
  title: string;
  start: number;
  end: number;
  location: string;
  description: string;
  capacity: number | null;
  sample: boolean;
  /** Registration that lives on Church Center. */
  url?: string;
  cancelled?: boolean;
  /** A person changed this row, so the catalog must not replace it. */
  staffEdited?: boolean;
};

type PrayerRow = {
  id: string;
  authorId: string;
  body: string;
  visibility: "public" | "private";
  approved: boolean;
  sample: boolean;
  /** Church Center's "How can we serve you!" answer. Added in build 6. */
  serve?: string;
  /** "Please contact me" rather than "Just pray for me". Added in build 6. */
  contactRequested?: boolean;
  /** Sent from the public neighborhood page. Still waits for staff. */
  neighborhood?: boolean;
  /** A member asked staff to look at this again. It is off the wall until a decision. */
  reported?: boolean;
};

type AmenRow = { prayerId: string; personId: string };
type TestimonyRow = {
  id: string;
  authorId: string;
  displayName: string;
  body: string;
  approved: boolean;
  consent: boolean;
  sample: boolean;
  createdAt: number;
};
type MilestoneRow = {
  id: string;
  kind: "baptism" | "salvation";
  title: string;
  detail: string;
  consent: boolean;
  published: boolean;
  sample: boolean;
  createdAt: number;
};
type OutreachRow = {
  id: string;
  title: string;
  detail: string;
  location: string;
  start: number;
  end: number;
  sample: boolean;
  cancelled?: boolean;
};
type CoffeeOrderRow = {
  id: string;
  personId: string | null;
  squareOrderId: string;
  status: string;
  totalCents: number;
  idempotencyKey: string;
  createdAt: number;
};

type StreakRow = { personId: string; lastDay: string; count: number };

/** Request times per hashed client key, kept in the snapshot so every serverless instance shares them. */
type ThrottleRow = { key: string; hits: number[] };

const HOUR_MS = 60 * 60 * 1000;
const GUEST_LIMIT_PER_CLIENT = 5;
const GUEST_LIMIT_TOTAL = 120;
const MEMBER_LIMIT = 10;

type StoredPerson = Omit<Person, "totpSecret"> & { totpSecret?: string | null };

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
  groups: GroupRow[];
  messages: { id: string; groupId: string; authorId: string; body: string; sample: boolean }[];
  events: EventRow[];
  registrations: { id: string; eventId: string; personId: string; status: "registered" | "waitlist" }[];
  announcements: AnnouncementCard[];
  prayers: PrayerRow[];
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
    /** Defined spot id, such as "kids". A free-typed name has none. */
    positionId?: string | null;
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
  drafts: { id: string; title: string; body?: string; segment: string; sample: boolean }[];
  invites?: {
    tokenHash: string;
    email: string;
    expires: number;
    issuerRole?: Role | null;
    issuerId?: string;
  }[];
  /** Added in build 6. Older snapshots do not have these and load as empty. */
  followUps?: FollowUpRow[];
  streaks?: StreakRow[];
  throttle?: ThrottleRow[];
  /** Added in build 8. Older snapshots load the defaults. */
  amens?: AmenRow[];
  myFive?: { personId: string; names: string[] }[];
  testimonies?: TestimonyRow[];
  milestones?: MilestoneRow[];
  outreach?: OutreachRow[];
  outreachRsvps?: { id: string; outreachId: string; personId: string }[];
  coffeeOrders?: CoffeeOrderRow[];
  social?: SocialLink[];
  /** Person ids on the kids team, besides the kids director role. Older snapshots load as empty. */
  kidsTeam?: string[];
  /** Phase 2a people and care rows. Older snapshots load as empty. */
  profiles?: PersonProfileRow[];
  tags?: TagRow[];
  personTags?: PersonTagRow[];
  touches?: TouchRow[];
  /** Phase 2b. Older snapshots load as empty: every playbook off, no tasks. */
  playbooks?: PlaybookRow[];
  careTasks?: CareTaskRow[];
  /** The message staff chose for Home and Watch. Older snapshots omit it. */
  featuredMessage?: {
    videoId: string;
    title: string;
    speaker: string;
    passage: string;
    link: string;
    thumbnail: string;
  } | null;
};

export type StoreOptions = {
  now?: () => number;
  fetchImpl?: typeof fetch;
  passwordOverrides?: Record<string, string>;
  totpOverrides?: Record<string, string>;
  /** Explicit opt-in so tests can assert production guards against a memory store. */
  memoryForTests?: boolean;
  /**
   * Present only when a test is pretending Apple push is connected.
   * Production has no sender, so the desk saves a draft and says nothing was sent.
   */
  pushSender?: (input: { title: string; body: string; segment: string; count: number }) => number;
  /** Fictional households for tests. The app boots with public church facts when this is false. */
  fixture?: boolean;
};

/** Names for gifts recorded against the placeholder funds of builds 1–6, so their history still reads. */
const RETIRED_FUND_NAMES: Record<string, string> = {
  outreach: "Outreach",
  kids: "Kids",
  benevolence: "Benevolence",
};

/** Wrong security codes allowed per child each hour before pickup locks. */
const PICKUP_ATTEMPTS = 5;

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
  private readonly pushSender: StoreOptions["pushSender"];
  private readonly key: Buffer;
  private readonly fixture: boolean;
  private readonly dummyHash: string;
  private readonly people = new Map<string, Person>();
  private readonly gifts = new Map<string, GiftRow>();
  private readonly children = new Map<string, ChildRow>();
  private readonly sessions = new Map<string, Session>();
  private readonly invites = new Map<string, IssuedInvite>();
  private readonly auditLog: AuditEntry[] = [];
  private readonly alerts: { id: string; personId: string; at: number; kind: string; detail: string }[] = [];
  private readonly proposals = new Map<string, Proposal>();
  private readonly secrets = new Map<string, { ciphertext: string; last4: string }>();
  private readonly station = new Set<string>();
  private readonly flags: Record<ModuleId, boolean>;
  private readonly groups: GroupRow[];
  private readonly messages: {
    id: string;
    groupId: string;
    authorId: string;
    body: string;
    sample: boolean;
  }[];
  private readonly events: EventRow[];
  private readonly registrations: {
    id: string;
    eventId: string;
    personId: string;
    status: "registered" | "waitlist";
  }[];
  private readonly announcements: AnnouncementCard[];
  private readonly prayers: PrayerRow[];
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
    positionId?: string | null;
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
  private readonly drafts: { id: string; title: string; body?: string; segment: string; sample: boolean }[] = [];
  private readonly followUps: FollowUpRow[] = [];
  private readonly streaks = new Map<string, StreakRow>();
  private readonly throttle = new Map<string, number[]>();
  private readonly amens: AmenRow[] = [];
  private readonly myFive = new Map<string, string[]>();
  private readonly testimonies: TestimonyRow[] = [];
  private readonly milestones: MilestoneRow[] = [];
  private readonly outreach: OutreachRow[] = [];
  private readonly outreachRsvps: { id: string; outreachId: string; personId: string }[] = [];
  private readonly coffeeOrders: CoffeeOrderRow[] = [];
  private social: SocialLink[] = SITE_SOCIAL.map((link) => ({ ...link }));
  private readonly kidsTeam = new Set<string>();
  private readonly profiles = new Map<string, PersonProfileRow>();
  private readonly tags: TagRow[] = [];
  private readonly personTags: PersonTagRow[] = [];
  private readonly touches: TouchRow[] = [];
  private readonly playbookRows: PlaybookRow[] = [];
  private readonly careTasks: CareTaskRow[] = [];
  private featured: {
    videoId: string;
    title: string;
    speaker: string;
    passage: string;
    link: string;
    thumbnail: string;
  } | null = null;
  private boundTenant: { id: string; name: string; timezone: string; pickupOnly: boolean } | null = null;

  static demo(env: NodeJS.ProcessEnv = process.env): ChurchStore {
    return new ChurchStore(loadConfig(env), { fixture: env.ONEHOPE_SAMPLE_DATA === "true" });
  }

  constructor(config: AppConfig, options: StoreOptions = {}) {
    if (
      config.env === "production" &&
      config.fieldEncryptionMode !== "configured" &&
      !options.memoryForTests
    ) {
      throw new Error("Refusing to boot without a configured encryption key in production.");
    }
    if (config.env === "production" && (options.passwordOverrides || options.totpOverrides)) {
      throw new Error("Credential overrides are refused in production.");
    }
    this.config = config;
    this.now = options.now ?? Date.now;
    this.fetchImpl = options.fetchImpl;
    this.pushSender = options.pushSender;
    this.key = config.fieldEncryptionKey;
    this.fixture = options.fixture ?? true;
    this.dummyHash = localAuthProvider.hashPassword("not-a-real-password");
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
    this.applyBootPassword();
  }

  /** Church clock, so pages don't call Date.now themselves. */
  clock(): number {
    return this.now();
  }

  bindTenant(tenant: { id: string; name: string; timezone: string; pickupOnly: boolean }): void {
    this.boundTenant = tenant;
  }

  /** Photos belong to one tenant. Another tenant on the same deploy gets the brand-colored fallback. */
  private mediaApplies(): boolean {
    return !this.boundTenant || this.boundTenant.id === this.config.mediaTenant;
  }

  churchImages(): AppConfig["images"] {
    return this.mediaApplies() ? this.config.images : blankImages();
  }

  churchMedia(): AppConfig["media"] {
    return this.mediaApplies() ? this.config.media : EMPTY_MEDIA;
  }

  currentTenant(): {
    id: string;
    name: string;
    timezone: string;
    pickupOnly: boolean;
    images: AppConfig["images"];
  } {
    const tenant = this.boundTenant ?? {
      id: "onehope",
      name: "One Hope",
      timezone: "America/Chicago",
      pickupOnly: false,
    };
    return { ...tenant, images: this.churchImages() };
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

  seatsFor(token: string) {
    const actor = this.actor(token);
    if (!isStaff(actor.role)) throw new AccessError("forbidden", "That is for staff.");
    return this.seats();
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
      ? localAuthProvider.verifyPassword(input.password, hash)
      : (localAuthProvider.verifyPassword(input.password, this.dummyHash), false);
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
    // Every sign-in gets its own token. A fixed token collides with the stored session row
    // when the demo runs on a database. The published demo sessions come from ensureDemoSessions.
    const token = newId("session");
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
    if (isReservedName(displayName)) throw new AccessError("invalid", "Choose a different name.");
    if (input.password.length < 8) throw new AccessError("invalid", "Use at least 8 characters.");
    if (this.byEmail(email)) {
      throw new AccessError(
        "invalid",
        "We couldn't create that account. Check the name, email, and password.",
      );
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
    person.passwordHash = localAuthProvider.hashPassword(input.password);
    person.displayName = displayName;
    this.people.set(id, person);
    this.ensurePathway(id);
    return this.login({ email, password: input.password, ip: input.ip, userAgent: input.userAgent });
  }

  issueInvite(token: string, email: string) {
    const actor = this.requireEditor(token);
    const cleaned = email.trim().toLowerCase();
    const person = this.byEmail(cleaned);
    if (!person || person.deleted) throw new AccessError("not_found", "That person isn't here.");
    this.assertMayInvite(actor.role, person.role);
    if (person.passwordHash) throw new AccessError("invalid", "That account already has a password.");
    const expires = this.now() + 7 * 24 * 60 * 60 * 1000;
    const inviteToken = newId("invite");
    this.invites.set(hashInvite(inviteToken), {
      email: cleaned,
      expires,
      issuerRole: actor.role,
      issuerId: actor.personId,
    });
    return { email: cleaned, displayName: person.displayName, inviteToken, expires };
  }

  claimInvite(input: {
    email: string;
    inviteToken: string;
    password: string;
    ip: string;
    userAgent: string;
  }) {
    const email = input.email.trim().toLowerCase();
    const invite = this.invites.get(hashInvite(input.inviteToken));
    if (!invite || invite.email !== email || invite.expires < this.now()) {
      throw new AccessError("unauthenticated", "That invite is not valid.");
    }
    const person = this.byEmail(email);
    if (!person || person.deleted) throw new AccessError("not_found", "That person isn't here.");
    if (!invite.issuerRole || !mayIssueInvite(invite.issuerRole, person.role)) {
      throw new AccessError("unauthenticated", "That invite is not valid.");
    }
    if (person.passwordHash) throw new AccessError("invalid", "That account already has a password.");
    if (input.password.length < 8) throw new AccessError("invalid", "Use at least 8 characters.");
    person.passwordHash = localAuthProvider.hashPassword(input.password);
    this.invites.delete(hashInvite(input.inviteToken));
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

  /** Staff with no authenticator yet need the setup screen before a code will work. */
  totpStatus(token: string): "enroll" | "code" {
    const session = this.session(token);
    const person = this.requirePerson(session.personId);
    if (!isStaff(person.role) || person.totpSecret) return "code";
    return "enroll";
  }

  beginTotp(token: string) {
    const session = this.session(token);
    const person = this.requirePerson(session.personId);
    if (!isStaff(person.role)) throw new AccessError("forbidden", "Members sign in with a password.");
    if (person.totpSecret) throw new AccessError("invalid", "An authenticator is already set up.");
    if (!session.pendingTotp) session.pendingTotp = encodeBase32(randomBytes(20));
    const setupKey = session.pendingTotp;
    const otpauthUrl = `otpauth://totp/One%20Hope:${encodeURIComponent(person.email)}?secret=${setupKey}&issuer=One%20Hope&algorithm=SHA1&digits=6&period=30`;
    return { setupKey, otpauthUrl };
  }

  confirmTotp(token: string, code: string) {
    const session = this.session(token);
    const person = this.requirePerson(session.personId);
    if (!isStaff(person.role)) throw new AccessError("forbidden", "Members sign in with a password.");
    if (!session.pendingTotp) throw new AccessError("invalid", "Start authenticator setup again.");
    const secret = decodeBase32(session.pendingTotp);
    if (!totpMatches(secret, code, this.now())) {
      throw new AccessError("unauthenticated", "That code didn't match. Check the time and try again.");
    }
    person.totpSecret = secret;
    session.pendingTotp = null;
    session.mfaVerified = true;
    session.stepUpUntil = this.now() + this.config.stepUpMs;
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
      !localAuthProvider.verifyPassword(proof.password, person.passwordHash)
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
    if (this.config.env === "demo" && (token === "session-staff-demo" || token === "session-member-demo")) return;
    this.sessions.delete(token);
  }

  me(token: string) {
    const actor = this.actor(token);
    return this.toPerson(this.requirePerson(actor.personId));
  }

  /** The staff web desk. A member session is not enough. */
  staffMe(token: string) {
    const person = this.me(token);
    if (!isStaff(person.role)) {
      throw new AccessError("forbidden", "This desk is for church staff.");
    }
    return person;
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
      visit: { ...VISIT },
      giving: {
        ...GIVING_WAYS,
        seasonal: this.now() < GIVING_WAYS.seasonal.until ? GIVING_WAYS.seasonal : null,
      },
      invite: { ...INVITE, url: inviteUrl(this.config.publicBaseUrl) },
      social: this.socialLinks(),
      countdown: { preService: when.preService.toISOString(), service: when.service.toISOString() },
      announcements: this.announcements
        .filter((item) => announcementIsLive(item, this.now()))
        .map((item) => ({ ...item })),
      events: this.upcomingEvents().map((event) => this.eventView(event)),
      sampleSermon: this.featured
        ? {
            sample: false as const,
            title: this.featured.title,
            speaker: this.featured.speaker,
            passage: this.featured.passage,
            videoId: this.featured.videoId,
            link: this.featured.link,
            thumbnail: this.featured.thumbnail,
          }
        : {
            sample: false as const,
            title: "",
            speaker: "One Hope",
            passage: "",
            videoId: "",
            link: "",
            thumbnail: "",
          },
      images: this.churchImages(),
      media: this.churchMedia(),
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

  updateProfile(
    token: string,
    input: {
      emailPublic?: boolean;
      phonePublic?: boolean;
      displayName?: string;
      phone?: string;
      listedInDirectory?: boolean;
    },
  ) {
    const actor = this.actor(token);
    authorize(actor, "edit_own_profile", this.now());
    const person = this.requirePerson(actor.personId);
    if (typeof input.emailPublic === "boolean") person.emailPublic = input.emailPublic;
    if (typeof input.phonePublic === "boolean") person.phonePublic = input.phonePublic;
    if (input.displayName?.trim()) {
      const name = input.displayName.trim();
      if (isReservedName(name)) throw new AccessError("invalid", "Choose a different name.");
      person.displayName = name;
    }
    if (typeof input.phone === "string") person.phone = input.phone.trim();
    if (typeof input.listedInDirectory === "boolean") person.listedInDirectory = input.listedInDirectory;
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
    return GIVING_FUNDS.map((fund) => ({ ...fund }));
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

  /** A new code replaces any earlier one, so only the latest tag works at pickup. */
  checkIn(token: string, childId: string) {
    const actor = this.actor(token);
    const child = this.requireChild(actor, childId);
    const code = String(randomInt(1000, 10_000));
    this.writeKidFields(child, { code, checkedInAt: this.now() });
    this.record(actor, "write", "kid_checkin", child.id, 3);
    return { childId: child.id, displayName: child.displayName, code };
  }

  householdPickup(token: string, input: { childId: string; code: string }) {
    const actor = this.actor(token);
    const child = this.requireChild(actor, input.childId);
    return this.releaseChild(actor, child, input.code, actor.personId);
  }

  createAnnouncement(
    token: string,
    input: { title: string; body: string; startsAt?: number | null; endsAt?: number | null },
  ) {
    const actor = this.requireEditor(token);
    const item = this.announcementFrom(input);
    this.announcements.push(item);
    this.record(actor, "write", "announcement", item.id, 0);
    return { ...item };
  }

  updateAnnouncement(
    token: string,
    id: string,
    input: { title: string; body: string; startsAt?: number | null; endsAt?: number | null },
  ) {
    const actor = this.requireEditor(token);
    const current = this.announcements.find((item) => item.id === id);
    if (!current) throw new AccessError("not_found", "That home card isn't here.");
    const next = this.announcementFrom(input, id);
    current.title = next.title;
    current.body = next.body;
    current.startsAt = next.startsAt;
    current.endsAt = next.endsAt;
    current.staffEdited = true;
    this.record(actor, "write", "announcement", current.id, 0);
    return { ...current };
  }

  archiveAnnouncement(token: string, id: string, archived: boolean) {
    const actor = this.requireEditor(token);
    const current = this.announcements.find((item) => item.id === id);
    if (!current) throw new AccessError("not_found", "That home card isn't here.");
    current.archived = archived;
    current.staffEdited = true;
    this.record(actor, "write", "announcement", current.id, 0);
    return { id: current.id, archived: current.archived === true };
  }

  staffAnnouncements(token: string) {
    const actor = this.requireEditor(token);
    this.record(actor, "read", "announcement", "list", 0);
    return this.announcements.map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      sample: item.sample,
      startsAt: item.startsAt ?? null,
      endsAt: item.endsAt ?? null,
      archived: item.archived === true,
      staffEdited: item.staffEdited === true,
      live: announcementIsLive(item, this.now()),
    }));
  }

  createEvent(
    token: string,
    input: {
      title: string;
      location: string;
      start: number;
      end: number;
      description?: string;
      capacity?: number | null;
    },
  ) {
    const actor = this.requireEditor(token);
    const event = this.eventFrom(input);
    this.events.push(event);
    this.record(actor, "write", "event", event.id, 0);
    return { ...event };
  }

  updateEvent(
    token: string,
    id: string,
    input: {
      title: string;
      location: string;
      start: number;
      end: number;
      description?: string;
      capacity?: number | null;
    },
  ) {
    const actor = this.requireEditor(token);
    const current = this.events.find((event) => event.id === id);
    if (!current) throw new AccessError("not_found", "That event isn't here.");
    const next = this.eventFrom(input, id);
    current.title = next.title;
    current.location = next.location;
    current.start = next.start;
    current.end = next.end;
    current.description = next.description;
    current.capacity = next.capacity;
    current.staffEdited = true;
    this.record(actor, "write", "event", current.id, 0);
    return { ...current };
  }

  cancelEvent(token: string, id: string, cancelled: boolean) {
    const actor = this.requireEditor(token);
    const current = this.events.find((event) => event.id === id);
    if (!current) throw new AccessError("not_found", "That event isn't here.");
    current.cancelled = cancelled;
    current.staffEdited = true;
    this.record(actor, "write", "event", current.id, 0);
    return { id: current.id, cancelled: current.cancelled === true };
  }

  staffEvents(token: string) {
    const actor = this.requireEditor(token);
    this.record(actor, "read", "event", "list", 0);
    const now = this.now();
    return this.events
      .filter((event) => event.cancelled === true || event.end >= now - 24 * 60 * 60 * 1000)
      .sort((left, right) => left.start - right.start)
      .map((event) => ({
        ...this.eventView(event),
        cancelled: event.cancelled === true,
      }));
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
    if (!this.givingAvailability().open) throw new AccessError("invalid", "Giving isn't open.");
    if (!actor.householdId) throw new AccessError("invalid", "A household is required before giving.");
    const fund = GIVING_FUNDS.find((item) => item.id === input.fundId);
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
        "No goods or services were provided in exchange for these contributions, unless a line above says otherwise.",
        "Keep this for your records. Ask a tax adviser how your gifts apply to you.",
      ].join("\n"),
    };
  }

  quickbooksCsv(token: string) {
    const gifts = this.allGifts(token);
    const lines = gifts.map((gift) => `${gift.id},${gift.fundId},${gift.amountCents},${gift.charged}`);
    return `id,fund,amountCents,charged\n${lines.join("\n")}\n`;
  }

  /** Anyone can browse groups. Signed-in members also see which ones they joined. */
  listGroups(token: string | null) {
    const actor = this.optionalActor(token);
    return this.groups.map((group) => ({
      ...this.publicGroup(group),
      joined: actor ? group.memberIds.includes(actor.personId) : false,
    }));
  }

  joinGroup(token: string, groupId: string) {
    const actor = this.actor(token);
    const group = this.groups.find((item) => item.id === groupId);
    if (!group) throw new AccessError("not_found", "That group isn't here.");
    if (group.joinType === "request") {
      throw new AccessError("invalid", "This group's leaders approve each request on Church Center.");
    }
    if (!group.memberIds.includes(actor.personId)) group.memberIds.push(actor.personId);
    return { id: group.id, joined: true as const };
  }

  leaveGroup(token: string, groupId: string) {
    const actor = this.actor(token);
    const group = this.groups.find((item) => item.id === groupId);
    if (!group) throw new AccessError("not_found", "That group isn't here.");
    group.memberIds = group.memberIds.filter((id) => id !== actor.personId);
    return { id: group.id, joined: false as const };
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
    const message = { id: newId("msg"), groupId: group.id, authorId: actor.personId, body, sample: false };
    this.messages.push(message);
    return message;
  }

  register(token: string, eventId: string) {
    const actor = this.actor(token);
    const event = this.events.find((item) => item.id === eventId);
    if (!event) throw new AccessError("not_found", "That event isn't here.");
    if (event.url) throw new AccessError("invalid", "Sign up for this event on Church Center.");
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
    if (item.status !== "pending") throw new AccessError("invalid", "You already answered that ask.");
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
        if (prayer.visibility === "public" && !prayer.approved && this.unlocked(actor, "view_care_notes"))
          return true;
        return prayer.visibility === "private" && this.unlocked(actor, "view_care_notes");
      })
      .map((prayer) => {
        const own = actor?.personId === prayer.authorId;
        const staffReader = actor ? this.unlocked(actor, "view_care_notes") : false;
        const steppedUp = actor !== null && actor.stepUpUntil >= this.now();
        const showBody =
          (prayer.visibility === "public" && (prayer.approved || own || staffReader)) ||
          ((own || staffReader) && steppedUp);
        if (actor && !own && showBody && (prayer.visibility === "private" || !prayer.approved))
          this.record(actor, "read", "prayer", prayer.id, prayer.visibility === "private" ? 3 : 1);
        const onWall = prayer.visibility === "public" && prayer.approved;
        return {
          id: prayer.id,
          visibility: prayer.visibility,
          approved: prayer.approved,
          sample: prayer.sample,
          mine: own,
          neighborhood: prayer.neighborhood === true,
          body: showBody ? prayer.body : "",
          serve: showBody && (own || staffReader) ? (prayer.serve ?? "") : "",
          contactRequested: (own || staffReader) && prayer.contactRequested === true,
          reported: staffReader && prayer.reported === true,
          prayedCount: onWall ? this.amens.filter((amen) => amen.prayerId === prayer.id).length : 0,
          prayed: actor
            ? this.amens.some((amen) => amen.prayerId === prayer.id && amen.personId === actor.personId)
            : false,
        };
      });
  }

  submitPrayer(
    token: string,
    input: { body: string; visibility: "public" | "private"; serve?: string; contact?: boolean },
  ) {
    const actor = this.actor(token);
    if (input.visibility === "private") authorize(actor, "view_household_tier3", this.now());
    const prayer: PrayerRow = {
      id: newId("prayer"),
      authorId: actor.personId,
      body: input.body,
      visibility: input.visibility,
      approved: false,
      sample: false,
      serve: input.serve ?? "",
      contactRequested: input.contact ?? false,
    };
    if (prayer.contactRequested) {
      const person = this.requirePerson(actor.personId);
      this.followUps.push({
        id: newId("followup"),
        kind: "prayer",
        personId: actor.personId,
        ciphertext: encryptString(
          JSON.stringify({ name: person.displayName, email: person.email, phone: "" }),
          this.key,
        ),
        contactConsent: true,
        status: "new",
        createdAt: this.now(),
        sample: false,
      });
    }
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
    prayer.reported = false;
    this.record(actor, "write", "prayer", prayer.id, prayer.visibility === "private" ? 3 : 1);
    return { id: prayer.id, approved: prayer.approved };
  }

  /**
   * A member reports a prayer on the wall. It leaves the wall at once and waits for a pastor,
   * who can approve it again. Authors cannot report their own request.
   */
  reportPrayer(token: string, prayerId: string) {
    const actor = this.actor(token);
    const prayer = this.prayers.find((item) => item.id === prayerId);
    if (!prayer || prayer.visibility !== "public" || !prayer.approved || prayer.authorId === actor.personId) {
      throw new AccessError("not_found", "That prayer isn't on the wall.");
    }
    prayer.approved = false;
    prayer.reported = true;
    this.record(actor, "write", "prayer_report", prayer.id, 1);
    return { id: prayer.id, reported: true as const };
  }

  markPrayed(token: string, prayerId: string) {
    const actor = this.actor(token);
    const prayer = this.prayers.find((item) => item.id === prayerId);
    if (!prayer || prayer.visibility !== "public" || !prayer.approved) {
      throw new AccessError("not_found", "That prayer isn't on the wall.");
    }
    if (!this.amens.some((amen) => amen.prayerId === prayerId && amen.personId === actor.personId)) {
      this.amens.push({ prayerId, personId: actor.personId });
    }
    return {
      id: prayerId,
      prayed: true as const,
      prayedCount: this.amens.filter((amen) => amen.prayerId === prayerId).length,
    };
  }

  submitNeighborhoodPrayer(body: string, client: string) {
    const text = body.trim();
    if (!text) throw new AccessError("invalid", "Tell us what to pray for.");
    const now = this.now();
    this.pruneThrottle(now);
    this.hit(`client:${this.clientKey(client)}`, GUEST_LIMIT_PER_CLIENT, now);
    this.hit("guests", GUEST_LIMIT_TOTAL, now);
    const prayer: PrayerRow = {
      id: newId("prayer"),
      authorId: "neighborhood",
      body: text,
      visibility: "public",
      approved: false,
      sample: false,
      serve: "Prayer for the neighborhood",
      neighborhood: true,
    };
    this.prayers.push(prayer);
    return { id: prayer.id, approved: false as const };
  }

  socialLinks() {
    return this.social.map((link) => ({ ...link }));
  }

  featuredMessage() {
    return this.featured ? { ...this.featured } : null;
  }

  featureMessage(
    token: string,
    input: { videoId: string; title: string; speaker?: string; passage?: string; link: string; thumbnail?: string },
  ) {
    const actor = this.requireEditor(token);
    const videoId = input.videoId.trim();
    const title = input.title.trim();
    const link = input.link.trim();
    const speaker = (input.speaker ?? "").trim() || "One Hope";
    const passage = (input.passage ?? "").trim();
    if (!/^[A-Za-z0-9_-]{6,20}$/.test(videoId)) {
      throw new AccessError("invalid", "That video could not be featured.");
    }
    if (!title || title.length > 140) throw new AccessError("invalid", "Add a title for the message.");
    if (speaker.length > 80 || passage.length > 80) throw new AccessError("invalid", "Please shorten that.");
    if (!youtubeMessageLink(videoId, link)) {
      throw new AccessError("invalid", "Use the YouTube link for that message.");
    }
    this.featured = {
      videoId,
      title,
      speaker,
      passage,
      link,
      thumbnail: (input.thumbnail ?? "").startsWith("https://") ? input.thumbnail!.trim() : "",
    };
    this.record(actor, "write", "sermon", videoId, 0);
    return { ...this.featured };
  }

  clearFeaturedMessage(token: string) {
    const actor = this.requireEditor(token);
    this.featured = null;
    this.record(actor, "write", "sermon", "cleared", 0);
    return { cleared: true as const };
  }

  setSocialLinks(token: string, links: SocialLink[]) {
    const actor = this.requireEditor(token);
    let cleaned: SocialLink[];
    try {
      cleaned = cleanSocialLinks(links);
    } catch {
      throw new AccessError("invalid", "Check the link name and use an https address.");
    }
    this.social = cleaned;
    this.record(actor, "write", "social", "links", 0);
    return this.socialLinks();
  }

  myFiveNames(token: string) {
    const actor = this.actor(token);
    return { names: [...(this.myFive.get(actor.personId) ?? [])] };
  }

  saveMyFive(token: string, names: string[]) {
    const actor = this.actor(token);
    if (names.length > 5) throw new AccessError("invalid", "Keep the list to five people.");
    const cleaned = names.map((name) => name.trim()).filter((name) => name.length > 0);
    if (cleaned.some((name) => name.length > 80)) throw new AccessError("invalid", "Use a shorter name.");
    this.myFive.set(actor.personId, cleaned);
    this.record(actor, "write", "my_five", actor.personId, 2);
    return { names: cleaned };
  }

  listTestimonies(token: string | null) {
    const actor = token ? this.optionalActor(token) : null;
    const staff = actor ? this.unlocked(actor, "view_care_notes") : false;
    return this.testimonies
      .filter((row) => (row.approved && row.consent) || (actor && row.authorId === actor.personId) || staff)
      .map((row) => ({
        id: row.id,
        displayName:
          row.approved && row.consent
            ? row.displayName
            : staff || actor?.personId === row.authorId
              ? row.displayName
              : "",
        body:
          row.approved && row.consent ? row.body : staff || actor?.personId === row.authorId ? row.body : "",
        approved: row.approved,
        mine: actor?.personId === row.authorId,
      }));
  }

  submitTestimony(token: string, input: { displayName: string; body: string; consent: boolean }) {
    const actor = this.actor(token);
    if (!input.consent) throw new AccessError("invalid", "We only share a testimony with your yes.");
    const body = input.body.trim();
    const displayName = input.displayName.trim();
    if (!body || !displayName) throw new AccessError("invalid", "Add your name and what you want to share.");
    if (body.length > 2000 || displayName.length > 80)
      throw new AccessError("invalid", "Please shorten that.");
    const row: TestimonyRow = {
      id: newId("testimony"),
      authorId: actor.personId,
      displayName,
      body,
      approved: false,
      consent: true,
      sample: false,
      createdAt: this.now(),
    };
    this.testimonies.push(row);
    return { id: row.id, approved: false as const };
  }

  moderateTestimony(token: string, id: string, approved: boolean) {
    const actor = this.actor(token);
    authorize(actor, "view_care_notes", this.now());
    const row = this.testimonies.find((item) => item.id === id);
    if (!row) throw new AccessError("not_found", "That testimony isn't here.");
    if (approved && !row.consent) throw new AccessError("invalid", "They have not agreed to share this.");
    row.approved = approved;
    this.record(actor, "write", "testimony", row.id, 2);
    return { id: row.id, approved: row.approved };
  }

  listMilestones() {
    return this.milestones
      .filter((row) => row.published && row.consent)
      .map((row) => ({ id: row.id, kind: row.kind, title: row.title, detail: row.detail }));
  }

  publishMilestone(
    token: string,
    input: { kind: "baptism" | "salvation"; title: string; detail: string; consent: boolean },
  ) {
    const actor = this.requireEditor(token);
    if (!input.consent) throw new AccessError("invalid", "Publish a milestone only with the person's yes.");
    const title = input.title.trim();
    const detail = input.detail.trim();
    if (!title) throw new AccessError("invalid", "Add a short title.");
    const row: MilestoneRow = {
      id: newId("milestone"),
      kind: input.kind,
      title,
      detail,
      consent: true,
      published: true,
      sample: false,
      createdAt: this.now(),
    };
    this.milestones.push(row);
    this.record(actor, "write", "milestone", row.id, 2);
    return { id: row.id, title: row.title };
  }

  listOutreach() {
    return this.outreach
      .filter((row) => row.cancelled !== true)
      .map((row) => ({
        id: row.id,
        title: row.title,
        detail: row.detail,
        location: row.location,
        start: row.start,
        end: row.end,
        sample: row.sample,
        signedUp: this.outreachRsvps.filter((rsvp) => rsvp.outreachId === row.id).length,
      }));
  }

  createOutreach(
    token: string,
    input: { title: string; detail: string; location: string; start: number; end: number },
  ) {
    const actor = this.requireEditor(token);
    const row = this.outreachFrom(input);
    this.outreach.push(row);
    this.record(actor, "write", "outreach", row.id, 0);
    return { id: row.id, title: row.title, start: row.start, end: row.end };
  }

  updateOutreach(
    token: string,
    id: string,
    input: { title: string; detail: string; location: string; start: number; end: number },
  ) {
    const actor = this.requireEditor(token);
    const current = this.outreach.find((row) => row.id === id);
    if (!current) throw new AccessError("not_found", "That serve day isn't here.");
    const next = this.outreachFrom(input, id);
    current.title = next.title;
    current.detail = next.detail;
    current.location = next.location;
    current.start = next.start;
    current.end = next.end;
    this.record(actor, "write", "outreach", current.id, 0);
    return { id: current.id, title: current.title };
  }

  cancelOutreach(token: string, id: string, cancelled: boolean) {
    const actor = this.requireEditor(token);
    const current = this.outreach.find((row) => row.id === id);
    if (!current) throw new AccessError("not_found", "That serve day isn't here.");
    current.cancelled = cancelled;
    this.record(actor, "write", "outreach", current.id, 0);
    return { id: current.id, cancelled: current.cancelled === true };
  }

  staffServeDays(token: string) {
    const actor = this.requireEditor(token);
    this.record(actor, "read", "outreach", "list", 0);
    return this.outreach
      .slice()
      .sort((left, right) => left.start - right.start)
      .map((row) => ({
        id: row.id,
        title: row.title,
        detail: row.detail,
        location: row.location,
        start: row.start,
        end: row.end,
        sample: row.sample,
        cancelled: row.cancelled === true,
        signedUp: this.outreachRsvps.filter((rsvp) => rsvp.outreachId === row.id).length,
      }));
  }

  undoOutreach(token: string, id: string) {
    const actor = this.requireEditor(token);
    const index = this.outreach.findIndex((row) => row.id === id);
    if (index < 0) throw new AccessError("not_found", "That serve opportunity isn't here.");
    this.outreach.splice(index, 1);
    for (let i = this.outreachRsvps.length - 1; i >= 0; i -= 1) {
      if (this.outreachRsvps[i]?.outreachId === id) this.outreachRsvps.splice(i, 1);
    }
    this.record(actor, "write", "outreach", id, 0);
    return { removed: true as const };
  }

  rsvpOutreach(token: string, id: string) {
    const actor = this.actor(token);
    const row = this.outreach.find((item) => item.id === id);
    if (!row || row.cancelled) throw new AccessError("not_found", "That serve day isn't open.");
    if (!this.outreachRsvps.some((rsvp) => rsvp.outreachId === id && rsvp.personId === actor.personId)) {
      this.outreachRsvps.push({ id: newId("rsvp"), outreachId: id, personId: actor.personId });
    }
    return { id, signedUp: true as const };
  }

  community(token: string | null) {
    const mine = token ? this.optionalActor(token) : null;
    return {
      outreach: this.listOutreach().map((row) => ({
        ...row,
        mine: mine
          ? this.outreachRsvps.some((rsvp) => rsvp.outreachId === row.id && rsvp.personId === mine.personId)
          : false,
      })),
      testimonies: this.listTestimonies(token).filter((row) => row.approved && row.body.length > 0),
      milestones: this.listMilestones(),
      invitePath: "/invite",
    };
  }

  coffeePublic() {
    const settings = squareSettings(this.config);
    const images = this.churchImages();
    return {
      ...coffeeGuide({
        live: settings.orderingLive,
        applicationId: settings.orderingLive ? settings.applicationId : "",
        locationId: settings.orderingLive ? settings.locationId : "",
        environment: settings.environment,
      }),
      photos: {
        hero: images.revival,
        sign: images.revival_sign ?? "",
        menu: images.revival_menu ?? "",
        gallery: this.churchMedia().revival.gallery,
      },
    };
  }

  async coffeeCatalog() {
    const settings = squareSettings(this.config);
    if (!settings.orderingLive)
      return {
        orderingLive: false as const,
        items: [] as {
          catalogObjectId: string;
          name: string;
          variation: string;
          priceCents: number | null;
        }[],
      };
    if (!this.fetchImpl) throw new AccessError("invalid", "Order ahead isn't ready yet.");
    try {
      const items = await listSquareVariations(this.fetchImpl, settings);
      return { orderingLive: true as const, items };
    } catch {
      throw new AccessError(
        "invalid",
        "The shop's menu couldn't be loaded from Square. Nothing was charged.",
      );
    }
  }

  async placeCoffeeOrder(
    token: string | null,
    input: {
      lines: { catalogObjectId: string; quantity: number }[];
      sourceId: string;
      idempotencyKey: string;
      pickupName: string;
    },
  ) {
    const settings = squareSettings(this.config);
    if (!settings.orderingLive) throw new AccessError("invalid", "Order ahead coming soon.");
    if (!input.sourceId.startsWith("cnon:")) {
      throw new AccessError("invalid", "Card numbers stay with Square. Use the Square checkout.");
    }
    if (!input.idempotencyKey || input.lines.length === 0)
      throw new AccessError("invalid", "Add at least one item.");
    const existing = this.coffeeOrders.find((row) => row.idempotencyKey === input.idempotencyKey);
    if (existing)
      return { orderId: existing.squareOrderId, status: existing.status, totalCents: existing.totalCents };
    if (!this.fetchImpl) throw new AccessError("invalid", "Order ahead isn't ready yet.");
    const actor = token ? this.optionalActor(token) : null;
    try {
      const order = await createSquareOrder(this.fetchImpl, settings, {
        idempotencyKey: `${input.idempotencyKey}-order`,
        lines: input.lines,
      });
      const payment = await createSquarePayment(this.fetchImpl, settings, {
        sourceId: input.sourceId,
        orderId: order.orderId,
        amountCents: order.totalCents,
        idempotencyKey: `${input.idempotencyKey}-pay`,
      });
      const row: CoffeeOrderRow = {
        id: newId("coffee"),
        personId: actor?.personId ?? null,
        squareOrderId: order.orderId,
        status: payment.status,
        totalCents: order.totalCents,
        idempotencyKey: input.idempotencyKey,
        createdAt: this.now(),
      };
      this.coffeeOrders.push(row);
      return {
        orderId: row.squareOrderId,
        status: row.status,
        totalCents: row.totalCents,
        pickupName: input.pickupName.trim(),
      };
    } catch {
      throw new AccessError("invalid", "Square couldn't take that order. Nothing was charged.");
    }
  }

  recordSquareWebhook(rawBody: string, signature: string) {
    const settings = squareSettings(this.config);
    if (!settings.webhookSignatureKey || !settings.webhookNotificationUrl) {
      throw new AccessError("forbidden", "Square webhooks are not set up.");
    }
    if (
      !verifySquareSignature(
        settings.webhookSignatureKey,
        settings.webhookNotificationUrl,
        rawBody,
        signature,
      )
    ) {
      throw new AccessError("forbidden", "That Square signature doesn't match.");
    }
    let payload: { data?: { object?: { payment?: { order_id?: string; status?: string } } } } = {};
    try {
      payload = JSON.parse(rawBody) as typeof payload;
    } catch {
      throw new AccessError("invalid", "The webhook body wasn't JSON.");
    }
    const orderId = payload.data?.object?.payment?.order_id;
    const status = payload.data?.object?.payment?.status;
    if (orderId && status) {
      const row = this.coffeeOrders.find((item) => item.squareOrderId === orderId);
      if (row) row.status = status;
    }
    return { received: true as const };
  }

  staffHome(token: string) {
    const actor = this.actor(token);
    if (!isStaff(actor.role)) throw new AccessError("forbidden", "This desk is for church staff.");
    const cards: {
      id: string;
      title: string;
      count: number | null;
      detail: string;
      help: string;
      href: string;
    }[] = [];
    if (this.unlocked(actor, "manage_checkin")) {
      const here = [...this.children.values()].filter(
        (child) => textField(this.readJson(child.ciphertext), "code") !== "",
      ).length;
      cards.push({
        id: "checkins",
        title: "Kids here today",
        count: here,
        detail: here === 0 ? "No children are checked in yet." : "Two adults stay at the door for pickup.",
        help: "How do I check a child in? Open Check-in, clock in, and read the code to the family. The app does not text them. Pickup needs two adults.",
        href: "/checkin",
      });
    }
    if (allows(actor.role, "view_care_notes")) {
      const waiting = this.followUps.filter((row) => row.status === "new");
      const yes = waiting.filter((row) => row.kind === "salvation").length;
      cards.push({
        id: "followups",
        title: "People to talk with",
        count: waiting.length,
        detail:
          yes > 0
            ? `${yes} said yes to Jesus. Reach out yourself. Nothing is sent from here.`
            : "New next steps. Nothing is emailed from here.",
        help: "How do I follow up? Open Care, assign someone, add a note and a due date, then mark Contacted after you talk. Nothing is texted.",
        href: "/care",
      });
      const pending = this.prayers.filter((prayer) => prayer.visibility === "public" && !prayer.approved);
      cards.push({
        id: "prayers",
        title: "Prayers to share",
        count: pending.length,
        detail:
          pending.length === 0
            ? "No prayer requests are waiting."
            : "Read each one, then share it with the church or keep it off the wall.",
        help: "How do I share a prayer? Open Care. Share puts it on the prayer wall. Keep private leaves it off the wall.",
        href: "/care",
      });
    }
    if (this.unlocked(actor, "manage_serving")) {
      const needed = this.schedule.filter((item) => item.status === "pending");
      cards.push({
        id: "volunteers",
        title: "Help needed Sunday",
        count: needed.length,
        detail: needed.length === 0 ? "No open spots." : "These people have not answered yet.",
        help: "How do I fill a spot? Open Serving, pick a person and a spot, and tap Ask them. Undo it while it still says waiting.",
        href: "/serving",
      });
    }
    if (actor.role === "pastor" || actor.role === "master_admin" || actor.role === "team_leader") {
      const upcoming = this.upcomingEvents();
      cards.push({
        id: "events",
        title: "What's coming up",
        count: upcoming.length,
        detail: upcoming[0] ? `Next: ${upcoming[0].title}` : "Add a gathering so people can see it.",
        help: "How do I post an event? Open Events, pick the real date and time, and tap Add. Cancel takes it off the app.",
        href: "/events",
      });
      const liveCards = this.announcements.filter((item) => announcementIsLive(item, this.now()) && !item.sample);
      cards.push({
        id: "home-cards",
        title: "On the app Home",
        count: liveCards.length,
        detail: liveCards[0] ? liveCards[0].title : "Nothing is on Home yet.",
        help: "How do I post a card? Open Communications, tap a ready-made card or write your own. Times are Central.",
        href: "/communications",
      });
      cards.push({
        id: "message",
        title: "This Sunday's message",
        count: null,
        detail: this.featured?.title || "No message is featured yet.",
        help: "How do I feature a message? Open Media, pick the YouTube video, and tap Feature on Home.",
        href: "/media",
      });
    }
    if (actor.role === "finance" || actor.role === "pastor" || actor.role === "master_admin") {
      if (!this.unlocked(actor, "view_all_giving")) {
        cards.push({
          id: "giving",
          title: "Giving",
          count: null,
          detail: "Confirm it's you to see giving. Card numbers are never stored here.",
          help: "How do I see giving? Open Giving and enter your code again. Nothing in this build is charged.",
          href: "/giving",
        });
      } else {
        const gifts = [...this.gifts.values()];
        const charged = gifts.some((gift) => gift.charged);
        cards.push({
          id: "giving",
          title: "Giving",
          count: gifts.length,
          detail: charged ? "Some gifts are marked charged." : "Nothing in this build is charged.",
          help: "How do I read giving? Open Giving. Live card charges stay off until the church switches them on.",
          href: "/giving",
        });
      }
    }
    return {
      greeting: greeting(this.now(), this.requirePerson(actor.personId).displayName),
      role: actor.role,
      cards: cards.slice(0, 8),
    };
  }

  staffPeople(token: string) {
    const actor = this.requireEditor(token);
    this.record(actor, "read", "people", "list", 1);
    return [...this.people.values()]
      .filter((person) => !person.deleted)
      .map((person) => ({
        id: person.id,
        displayName: person.displayName,
        email: person.email,
        phone: person.phone,
        role: person.role,
        claimed: Boolean(person.passwordHash),
        sample: person.sample,
        canUndo: this.canUndoAdd(actor, person),
        canInvite: !person.passwordHash && mayIssueInvite(actor.role, person.role),
      }));
  }

  addPerson(token: string, input: { displayName: string; email: string; phone?: string }) {
    const actor = this.requireEditor(token);
    const email = input.email.trim().toLowerCase();
    const displayName = input.displayName.trim();
    if (!email || !displayName) throw new AccessError("invalid", "Name and email are required.");
    if (isReservedName(displayName)) throw new AccessError("invalid", "Choose a different name.");
    if (this.byEmail(email)) throw new AccessError("invalid", "That email is already here.");
    const person = this.makePerson({
      id: newId("person"),
      displayName,
      email,
      role: "member",
      householdId: newId("hh"),
      sample: false,
      password: false,
      totp: false,
      listed: false,
    });
    if (input.phone?.trim()) person.phone = input.phone.trim();
    person.addedBy = actor.personId;
    person.addedAt = this.now();
    this.people.set(person.id, person);
    this.ensurePathway(person.id);
    const expires = this.now() + 7 * 24 * 60 * 60 * 1000;
    const inviteToken = newId("invite");
    this.invites.set(hashInvite(inviteToken), {
      email,
      expires,
      issuerRole: actor.role,
      issuerId: actor.personId,
    });
    this.record(actor, "write", "person", person.id, 1);
    return {
      id: person.id,
      displayName,
      email,
      inviteToken,
      expires,
      note: "Read this code to them in person. Nothing was emailed.",
    };
  }

  editPerson(token: string, personId: string, input: { displayName?: string; phone?: string }) {
    const actor = this.requireEditor(token);
    const person = this.requirePerson(personId);
    if (person.deleted) throw new AccessError("not_found", "That person isn't here.");
    if (input.displayName?.trim()) {
      if (isReservedName(input.displayName)) throw new AccessError("invalid", "Choose a different name.");
      person.displayName = input.displayName.trim();
    }
    if (typeof input.phone === "string") person.phone = input.phone.trim();
    this.record(actor, "write", "person", person.id, 1);
    return { id: person.id, displayName: person.displayName, phone: person.phone };
  }

  undoAddPerson(token: string, personId: string) {
    const actor = this.requireEditor(token);
    const person = this.requirePerson(personId);
    if (!this.canUndoAdd(actor, person)) {
      throw new AccessError(
        "forbidden",
        "You can undo an add only for someone you added in the last 10 minutes, and never for a staff or Master Admin seat.",
      );
    }
    this.eraseOwnedData(person.id, person.householdId);
    person.deleted = true;
    person.email = "";
    person.phone = "";
    person.displayName = "Former member";
    this.record(actor, "write", "person_delete", person.id, 2);
    return { removed: true as const };
  }

  assignServing(token: string, input: { personId: string; position?: string; positionId?: string | null }) {
    const actor = this.actor(token);
    authorize(actor, "manage_serving", this.now());
    const person = this.requirePerson(input.personId);
    const position = (input.position ?? "").trim();
    const requestedId = input.positionId?.trim() ?? "";
    const known =
      SERVING_SPOTS.find((spot) => spot.id === requestedId) ??
      SERVING_SPOTS.find((spot) => spot.label.toLowerCase() === position.toLowerCase());
    const label = known?.label ?? position;
    if (!label) throw new AccessError("invalid", "Name the spot, like Door or Kids.");
    const duplicate = this.schedule.some(
      (row) =>
        row.personId === person.id &&
        row.status !== "declined" &&
        row.position.toLowerCase() === label.toLowerCase(),
    );
    if (duplicate) throw new AccessError("invalid", "That person already has this spot.");
    const row = {
      id: newId("serve"),
      personId: person.id,
      position: label,
      positionId: known?.id ?? null,
      status: "pending" as const,
      sample: false,
    };
    this.schedule.push(row);
    this.record(actor, "write", "serving", row.id, 1);
    return row;
  }

  undoServing(token: string, id: string) {
    const actor = this.actor(token);
    authorize(actor, "manage_serving", this.now());
    const index = this.schedule.findIndex((item) => item.id === id);
    const item = this.schedule[index];
    if (!item) throw new AccessError("not_found", "That spot isn't here.");
    if (item.status !== "pending")
      throw new AccessError("invalid", "They already answered. Talk with them before changing it.");
    this.schedule.splice(index, 1);
    this.record(actor, "write", "serving", id, 1);
    return { removed: true as const };
  }

  groupRoster(token: string, groupId: string) {
    const actor = this.requireEditor(token);
    const group = this.groups.find((item) => item.id === groupId);
    if (!group) throw new AccessError("not_found", "That group isn't here.");
    this.record(actor, "read", "group", group.id, 1);
    return {
      id: group.id,
      name: group.name,
      people: group.memberIds
        .map((id) => this.people.get(id))
        .filter((person): person is NonNullable<typeof person> => Boolean(person && !person.deleted))
        .map((person) => ({ id: person.id, displayName: person.displayName })),
    };
  }

  myPathway(token: string) {
    const actor = this.actor(token);
    this.ensurePathway(actor.personId);
    const view = this.pathwayView(actor.personId);
    return { sample: false as const, ...view };
  }

  kidsDuty(token: string) {
    const actor = this.actor(token);
    const person = this.requirePerson(actor.personId);
    return { canClockIn: this.onKidsTeam(person), onDuty: this.isOnDuty(person) };
  }

  kidsTeamRoster(token: string) {
    const actor = this.actor(token);
    authorize(actor, "manage_checkin", this.now());
    const members = [...this.kidsTeam]
      .map((id) => this.people.get(id))
      .filter((person): person is Person => Boolean(person && !person.deleted))
      .map((person) => ({ id: person.id, displayName: person.displayName, role: person.role }));
    const candidates = [...this.people.values()]
      .filter((person) => !person.deleted && !this.kidsTeam.has(person.id))
      .map((person) => ({ id: person.id, displayName: person.displayName, role: person.role }));
    return { members, candidates };
  }

  addKidsTeamMember(token: string, personId: string) {
    const actor = this.actor(token);
    authorize(actor, "manage_checkin", this.now());
    const person = this.requirePerson(personId);
    if (person.deleted) throw new AccessError("not_found", "That person isn't here.");
    this.kidsTeam.add(person.id);
    this.record(actor, "write", "kids_team", person.id, 1);
    return { id: person.id, displayName: person.displayName };
  }

  removeKidsTeamMember(token: string, personId: string) {
    const actor = this.actor(token);
    authorize(actor, "manage_checkin", this.now());
    this.kidsTeam.delete(personId);
    // Taking someone off the team also takes them off duty, unless their role or an
    // accepted kids spot still puts them on the team.
    const removed = this.people.get(personId);
    if (!removed || !this.onKidsTeam(removed)) this.station.delete(personId);
    this.record(actor, "write", "kids_team", personId, 1);
    return { removed: true as const };
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
        checkedIn: textField(this.readJson(child.ciphertext), "code") !== "",
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

  roster(token: string, classroom?: string | null) {
    const actor = this.actor(token);
    authorize(actor, "manage_checkin", this.now());
    const room = classroom?.trim() ?? "";
    return [...this.children.values()]
      .filter((child) => !room || child.classroom === room)
      .map((child) => ({
        id: child.id,
        displayName: child.displayName,
        classroom: child.classroom,
        sample: child.sample,
        checkedIn: textField(this.readJson(child.ciphertext), "code") !== "",
      }));
  }

  /**
   * The operator board. The security code is here so the desk can read it to the
   * family. It is not texted. Medical notes stay off this board.
   */
  stationBoard(token: string, classroom?: string | null) {
    const actor = this.actor(token);
    const person = this.requirePerson(actor.personId);
    const canOperate = allows(actor.role, "manage_checkin");
    if (!canOperate && !this.onKidsTeam(person)) {
      throw new AccessError(
        "forbidden",
        "This desk is for the kids team. Ask a kids director, a kids team leader, or a kids volunteer.",
      );
    }
    const room = classroom?.trim() ?? "";
    const children = canOperate
      ? [...this.children.values()].filter((child) => !room || child.classroom === room)
      : [];
    return {
      canOperate,
      canManageTeam: canOperate,
      adultsOnDuty: this.kidsOnDuty(),
      onDuty: this.isOnDuty(person),
      canClockIn: this.onKidsTeam(person),
      namesOnDuty: [...this.station]
        .filter((id) => {
          const person = this.people.get(id);
          return person ? this.onKidsTeam(person) : false;
        })
        .map((id) => this.people.get(id)?.displayName ?? "Staff"),
      classrooms: [...new Set([...this.children.values()].map((child) => child.classroom))].sort(),
      children: children.map((child) => {
        const code = textField(this.readJson(child.ciphertext), "code");
        return {
          id: child.id,
          displayName: child.displayName,
          classroom: child.classroom,
          checkedIn: code !== "",
          code,
          guardians: child.guardianIds.map((id) => ({
            id,
            displayName: this.people.get(id)?.displayName ?? "Adult",
            blocked: child.restrictedPersonIds.includes(id),
          })),
        };
      }),
    };
  }

  /** Checks a child in at the desk. The code is shown once on this screen and is never texted. */
  staffCheckIn(token: string, childId: string) {
    const actor = this.actor(token);
    authorize(actor, "manage_checkin", this.now());
    const child = this.children.get(childId);
    if (!child) throw new AccessError("not_found", "That child isn't here.");
    const code = String(randomInt(1000, 10_000));
    this.writeKidFields(child, { code, checkedInAt: this.now() });
    this.record(actor, "write", "kid_checkin", child.id, 3);
    return { childId: child.id, displayName: child.displayName, classroom: child.classroom, code };
  }

  stationLabel(token: string, childId: string) {
    const actor = this.actor(token);
    authorize(actor, "manage_checkin", this.now());
    const child = this.children.get(childId);
    if (!child) throw new AccessError("not_found", "That child isn't here.");
    const code = textField(this.readJson(child.ciphertext), "code");
    if (!code) throw new AccessError("invalid", "Check the child in before printing a label.");
    this.record(actor, "read", "kid_label", child.id, 1);
    return {
      displayName: child.displayName,
      classroom: child.classroom,
      code,
      zpl: zebraLabel(child.displayName, code),
      brother: `BROTHER LABEL\nOne Hope Kids\n${child.displayName}\nCode ${code}\n`,
      socketOpened: false as const,
    };
  }

  clockIn(token: string) {
    const actor = this.actor(token);
    const person = this.requirePerson(actor.personId);
    if (!this.onKidsTeam(person)) {
      throw new AccessError(
        "forbidden",
        "Only the kids team can be the second adult at pickup. Ask a kids director, a kids team leader, or a kids volunteer to clock in.",
      );
    }
    if (isStaff(actor.role) && !actor.mfaVerified) {
      throw new AccessError("mfa_required", "Staff must finish multi-factor authentication.");
    }
    this.station.add(actor.personId);
    return { adultsOnDuty: this.kidsOnDuty(), onDuty: true as const };
  }

  clockOut(token: string) {
    const actor = this.actor(token);
    const person = this.requirePerson(actor.personId);
    if (!this.onKidsTeam(person) && !this.station.has(actor.personId)) {
      throw new AccessError(
        "forbidden",
        "Only the kids team can be the second adult at pickup. Ask a kids director, a kids team leader, or a kids volunteer to clock in.",
      );
    }
    this.station.delete(actor.personId);
    return { adultsOnDuty: this.kidsOnDuty(), onDuty: false as const };
  }

  pickup(token: string, input: PickupBody) {
    const actor = this.actor(token);
    authorize(actor, "view_kids_medical", this.now());
    const child = this.children.get(input.childId);
    if (!child) throw new AccessError("not_found", "That child isn't here.");
    return this.releaseChild(actor, child, input.code, input.guardianPersonId);
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

  assignableRoles(token: string) {
    const actor = this.actor(token);
    const roles = [
      "pastor",
      "care_team",
      "finance",
      "kids_director",
      "team_leader",
      "volunteer",
      "member",
    ] as const;
    if (actor.role === "team_leader") {
      return roles
        .filter((role) => mayChangeRole(actor.role, "member", role))
        .map((role) => ({ id: role, label: labelRole(role) }));
    }
    return roles
      .filter((role) => {
        const staffMove =
          role === "pastor" || role === "care_team" || role === "finance" || role === "kids_director";
        return allows(actor.role, staffMove ? "grant_staff_roles" : "assign_team_roles");
      })
      .map((role) => ({ id: role, label: labelRole(role) }));
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
    const churchRoles = [
      "pastor",
      "care_team",
      "finance",
      "kids_director",
      "team_leader",
      "volunteer",
      "member",
    ] as const;
    if (!(churchRoles as readonly string[]).includes(input.role)) {
      throw new AccessError("forbidden", "That role is not assigned from the church Command Center.");
    }
    if (!mayChangeRole(actor.role, person.role, input.role)) {
      throw new AccessError(
        "forbidden",
        "You can only change roles below your own level, never a pastor or Master Admin seat.",
      );
    }
    if (actor.role === "team_leader") {
      person.role = input.role;
      this.refreshSessions(person);
      this.record(actor, "write", "role", person.id, 2);
      return this.toPerson(person);
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
    // Care tasks go only to care team seats; leaving the seat hands their open tasks back to the team.
    if (person.role !== "care_team") {
      for (const task of this.careTasks) if (task.status === "open" && task.assigneeId === person.id) task.assigneeId = null;
    }
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

  audit(token: string, range?: { from?: number | null; to?: number | null }) {
    const actor = this.actor(token);
    authorize(actor, "view_audit_log", this.now());
    return this.auditLog
      .filter((entry) => {
        if (range?.from != null && entry.at < range.from) return false;
        if (range?.to != null && entry.at > range.to) return false;
        return true;
      })
      .map((entry) => ({
        ...entry,
        actorName: this.people.get(entry.actorId)?.displayName ?? "Staff",
      }));
  }

  auditCsv(token: string, range?: { from?: number | null; to?: number | null }) {
    const rows = this.audit(token, range);
    const lines = ["When (Central),Who,Action,Record,Record id,Tier"];
    for (const row of rows) {
      lines.push(
        [
          formatChicago(row.at),
          row.actorName,
          row.action,
          row.resource,
          row.resourceId,
          String(row.tier),
        ]
          .map(csvCell)
          .join(","),
      );
    }
    return lines.join("\n");
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
              followUps: this.followUpViews(actor),
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

  pushDesk(token: string) {
    const actor = this.actor(token);
    authorize(actor, "compose_communications", this.now());
    return {
      live: this.apnsLive(),
      counts: {
        members: this.segmentCount("members"),
        volunteers: this.segmentCount("volunteers"),
        parents: this.segmentCount("parents"),
      },
    };
  }

  sendPush(token: string, input: PushBody & { confirm?: boolean }) {
    const actor = this.actor(token);
    authorize(actor, "compose_communications", this.now());
    const count = this.segmentCount(input.segment);
    const live = this.apnsLive();
    if (live && !input.confirm) {
      return {
        sent: false as const,
        drafted: false as const,
        live: true as const,
        needsConfirm: true as const,
        count,
        title: input.title,
        segment: input.segment,
        reason: `This would notify ${count} ${count === 1 ? "person" : "people"} (${this.segmentLabel(input.segment)}). Nothing has been sent yet.`,
      };
    }
    if (!live || !this.pushSender) {
      const draft = {
        id: newId("draft"),
        title: input.title,
        body: input.body,
        segment: input.segment,
        sample: true,
      };
      this.drafts.push(draft);
      this.record(actor, "write", "push_draft", draft.id, 2);
      return {
        sent: false as const,
        drafted: true as const,
        live,
        needsConfirm: false as const,
        count,
        title: input.title,
        segment: input.segment,
        reason: live
          ? "Nothing was sent. Apple push is marked on, but this build has no device list, so it was saved as a draft."
          : "Nothing was sent. Apple push is not turned on, so this was saved as a draft.",
      };
    }
    const delivered = this.pushSender({
      title: input.title,
      body: input.body,
      segment: input.segment,
      count,
    });
    const draft = {
      id: newId("draft"),
      title: input.title,
      body: input.body,
      segment: input.segment,
      sample: false,
    };
    this.drafts.push(draft);
    this.record(actor, "write", "push_send", draft.id, 2);
    return {
      sent: true as const,
      drafted: false as const,
      live: true as const,
      needsConfirm: false as const,
      count: delivered,
      title: input.title,
      segment: input.segment,
      reason: `Sent to ${delivered} ${delivered === 1 ? "person" : "people"}.`,
    };
  }

  private segmentLabel(segment: "members" | "volunteers" | "parents") {
    if (segment === "members") return "everyone with the app (every account with a password)";
    if (segment === "volunteers") return "volunteers";
    return "parents";
  }

  private apnsLive() {
    if (this.pushSender) return true;
    return false;
  }

  private segmentCount(segment: "members" | "volunteers" | "parents") {
    if (segment === "parents") {
      const ids = new Set<string>();
      for (const child of this.children.values()) for (const id of child.guardianIds) ids.add(id);
      return [...ids].filter((id) => {
        const person = this.people.get(id);
        return person && !person.deleted;
      }).length;
    }
    return [...this.people.values()].filter((person) => {
      if (person.deleted) return false;
      if (segment === "volunteers") return person.role === "volunteer" || person.role === "team_leader";
      return Boolean(person.passwordHash);
    }).length;
  }

  /**
   * Kids director, a kids team leader, a kids volunteer, or anyone on the kids-team list.
   * A pastor, finance teammate, or care teammate does not count unless they are on that list.
   */
  private onKidsTeam(person: Person): boolean {
    if (person.deleted) return false;
    if (person.role === "kids_director") return true;
    if (this.kidsTeam.has(person.id)) return true;
    const acceptedKidsSpot =
      (person.role === "volunteer" || person.role === "team_leader") &&
      this.schedule.some(
        (row) =>
          row.personId === person.id && row.status === "accepted" && row.positionId === KIDS_POSITION_ID,
      );
    return acceptedKidsSpot;
  }

  /** On duty only while clocked in AND still on the kids team. */
  private isOnDuty(person: Person): boolean {
    return this.station.has(person.id) && this.onKidsTeam(person);
  }

  private kidsOnDuty(): number {
    let count = 0;
    for (const personId of this.station) {
      const person = this.people.get(personId);
      if (person && this.onKidsTeam(person)) count += 1;
    }
    return count;
  }

  knowJesus() {
    return {
      gospel: presentGospel(),
      journey: presentJourney(NEW_BELIEVER_JOURNEY),
      journeyMonth: presentJourney(JOURNEY_MONTH),
      journeyEditableBy: "pastors" as const,
    };
  }

  /** Today's reading. A member also gets their synced streak; a guest keeps theirs on the device. */
  dailyWord(token: string | null) {
    const reading = dailyReading(this.now());
    const actor = this.optionalActor(token);
    const streak = actor ? currentStreak(this.streaks.get(actor.personId) ?? null, reading.day) : null;
    return { reading, streak, encouragement: streak === null ? null : streakEncouragement(streak) };
  }

  markDailyWordRead(token: string) {
    const actor = this.actor(token);
    const today = dailyReading(this.now()).day;
    const count = nextStreak(this.streaks.get(actor.personId) ?? null, today);
    this.streaks.set(actor.personId, { personId: actor.personId, lastDay: today, count });
    return { streak: count, day: today };
  }

  /**
   * A next step from the Know Jesus page or Plan a Visit. Guests give a name
   * and, only with consent, an email or phone. Members use their account.
   * Nothing is sent; the row waits in the staff follow-up queue.
   */
  submitFollowUp(token: string | null, input: FollowUpBody, client: string) {
    const actor = this.optionalActor(token);
    const row = this.queueFollowUp(actor, input.kind, input, client, {});
    const step = FOLLOW_UP_PATHWAY[input.kind];
    if (actor && step) {
      const steps = this.ensurePathway(actor.personId);
      const target = steps.find((item) => item.id === step.stepId);
      if (target && target.status !== "done") target.status = step.status;
    }
    return { id: row.id, kind: row.kind, journey: input.kind === "salvation" };
  }

  /**
   * The church's Support/Assistance Request. It promises a call back, so a
   * guest must leave an email or phone. The boxes are encrypted with the contact.
   */
  submitSupport(token: string | null, input: SupportBody, client: string) {
    const actor = this.optionalActor(token);
    if (!actor && !input.email && !input.phone)
      throw new AccessError("invalid", "Please leave an email or phone so we can reach you.");
    const row = this.queueFollowUp(actor, "support", input, client, { needs: input.needs });
    return { id: row.id, needs: input.needs.map(supportLabel) };
  }

  /** The church's Toolkit and Recovery pages, plus the Unlocking Freedom group. */
  growth() {
    const group = this.groups.find((item) => item.id === RECOVERY.groupId);
    return {
      toolkit: TOOLKIT,
      recovery: { ...RECOVERY, group: group ? this.publicGroup(group) : null },
      support: SUPPORT,
    };
  }

  followUpsFor(token: string) {
    const actor = this.actor(token);
    authorize(actor, "view_care_notes", this.now());
    return this.followUpViews(actor);
  }

  // ---- Phase 2a: People and care -------------------------------------------------------------

  /** Who this actor may see on People. Throws for roles without `view_people`. */
  private careScope(actor: Actor): (person: Person) => boolean {
    authorize(actor, "view_people", this.now());
    const church = (person: Person) => !person.deleted && isChurchRole(person.role);
    if (seesEveryone(actor.role)) return church;
    if (actor.role === "kids_director") {
      const kidsHouseholds = new Set([...this.children.values()].map((child) => child.householdId));
      return (person) =>
        church(person) &&
        (person.id === actor.personId ||
          this.kidsTeam.has(person.id) ||
          (person.householdId !== null && kidsHouseholds.has(person.householdId)));
    }
    // Team leaders: people on teams they lead, and people they added themselves.
    const led = new Set(
      this.tags
        .filter((tag) => tag.kind === "team" && !tag.archived && tag.leaderIds.includes(actor.personId))
        .map((tag) => tag.id),
    );
    const onLedTeam = new Set(this.personTags.filter((row) => led.has(row.tagId)).map((row) => row.personId));
    return (person) =>
      church(person) &&
      (person.id === actor.personId || person.addedBy === actor.personId || onLedTeam.has(person.id));
  }

  private careProfile(person: Person): PersonProfileRow {
    return (
      this.profiles.get(person.id) ?? {
        id: person.id,
        personId: person.id,
        stage: defaultStage(person.role, Boolean(person.passwordHash)),
        lastContactAt: null,
        doNotContact: false,
        updatedAt: 0,
        updatedBy: "",
      }
    );
  }

  private writableProfile(person: Person, actor: Actor): PersonProfileRow {
    const row = { ...this.careProfile(person), updatedAt: this.now(), updatedBy: actor.personId };
    this.profiles.set(person.id, row);
    return row;
  }

  /** The person, if this actor may see them. Out-of-scope people look the same as missing ones. */
  private carePerson(actor: Actor, personId: string, action: "view_people" | "edit_people"): Person {
    const visible = this.careScope(actor);
    if (action === "edit_people") authorize(actor, "edit_people", this.now());
    const person = this.people.get(personId);
    if (!person || !visible(person)) throw new AccessError("not_found", "That person isn't here.");
    return person;
  }

  /** Tags this actor may put on someone. Tag managers: any live tag. Others: teams they lead. */
  private tagsActorMayApply(actor: Actor): TagRow[] {
    const live = this.tags.filter((tag) => !tag.archived);
    if (allows(actor.role, "manage_tags")) return live;
    return live.filter((tag) => tag.kind === "team" && tag.leaderIds.includes(actor.personId));
  }

  private tagChips(personId: string) {
    const byId = new Map(this.tags.map((tag) => [tag.id, tag]));
    return this.personTags
      .filter((row) => row.personId === personId)
      .map((row) => byId.get(row.tagId))
      .filter((tag): tag is TagRow => Boolean(tag) && !tag?.archived)
      .map((tag) => ({ id: tag.id, name: tag.name, kind: tag.kind }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  /** People list with search and filters. Each page is at most `limit` rows. */
  peopleDirectory(
    token: string,
    filter: { q?: string; stage?: string; tagId?: string; quiet?: boolean; limit?: number; offset?: number } = {},
  ) {
    const actor = this.actor(token);
    const visible = this.careScope(actor);
    const now = this.now();
    const q = (filter.q ?? "").trim().toLowerCase();
    const stage = isStage(filter.stage) ? filter.stage : null;
    const tagged = filter.tagId
      ? new Set(this.personTags.filter((row) => row.tagId === filter.tagId).map((row) => row.personId))
      : null;
    const rows = [...this.people.values()]
      .filter(visible)
      .map((person) => ({ person, profile: this.careProfile(person) }))
      .filter(({ person, profile }) => {
        if (stage && profile.stage !== stage) return false;
        if (tagged && !tagged.has(person.id)) return false;
        if (filter.quiet && !isQuiet(profile.lastContactAt, now)) return false;
        if (q) {
          const hay = `${person.displayName} ${person.email} ${person.phone}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((left, right) => left.person.displayName.localeCompare(right.person.displayName));
    const limit = Math.min(Math.max(filter.limit ?? 100, 1), 500);
    const offset = Math.max(filter.offset ?? 0, 0);
    this.record(actor, "read", "people", "directory", 1);
    return {
      total: rows.length,
      offset,
      limit,
      rows: rows.slice(offset, offset + limit).map(({ person, profile }) => ({
        id: person.id,
        displayName: person.displayName,
        role: person.role,
        roleLabel: labelRole(person.role),
        stage: profile.stage,
        stageLabel: STAGE_LABELS[profile.stage],
        lastContactAt: profile.lastContactAt,
        quiet: isQuiet(profile.lastContactAt, now),
        doNotContact: profile.doNotContact,
        claimed: Boolean(person.passwordHash),
        sample: person.sample,
        tags: this.tagChips(person.id),
      })),
      stages: STAGES.map((id) => ({ id, label: STAGE_LABELS[id] })),
      tags: this.tags
        .filter((tag) => !tag.archived)
        .map((tag) => ({ id: tag.id, name: tag.name, kind: tag.kind })),
      seesEveryone: seesEveryone(actor.role),
    };
  }

  /** One person's care page: stage, tags, touches and their follow-ups. */
  personCare(token: string, personId: string, page: { before?: number | null } = {}) {
    const actor = this.actor(token);
    const person = this.carePerson(actor, personId, "view_people");
    const profile = this.careProfile(person);
    this.record(actor, "read", "person_care", person.id, 2);
    const before = typeof page.before === "number" && page.before > 0 ? page.before : null;
    // Newest first. Reversing before the stable sort keeps same-millisecond touches newest-first too.
    const matching = this.touches
      .filter((row) => row.personId === person.id && (before === null || row.at < before))
      .reverse()
      .sort((left, right) => right.at - left.at);
    const hasMoreTouches = matching.length > TOUCH_PAGE;
    const touches = matching
      .slice(0, TOUCH_PAGE)
      .map((row) => ({
        id: row.id,
        kind: row.kind,
        kindLabel: TOUCH_LABELS[row.kind],
        outcome: row.outcome,
        outcomeLabel: OUTCOME_LABELS[row.outcome],
        note: row.noteCiphertext ? textField(this.readJson(row.noteCiphertext), "note") : "",
        byName: this.people.get(row.byId)?.displayName ?? "Former staff",
        at: row.at,
      }));
    const careAllowed = allows(actor.role, "view_care_notes");
    const followUps = careAllowed
      ? this.followUps
          .filter((row) => row.personId === person.id)
          .sort((left, right) => right.createdAt - left.createdAt)
          .map((row) => ({ id: row.id, label: FOLLOW_UP_LABELS[row.kind], status: row.status, createdAt: row.createdAt }))
      : [];
    const applied = new Set(this.personTags.filter((row) => row.personId === person.id).map((row) => row.tagId));
    const mayEdit = allows(actor.role, "edit_people");
    const appliable = this.tagsActorMayApply(actor);
    return {
      id: person.id,
      displayName: person.displayName,
      email: person.email,
      phone: person.phone,
      role: person.role,
      roleLabel: labelRole(person.role),
      claimed: Boolean(person.passwordHash),
      sample: person.sample,
      stage: profile.stage,
      stageLabel: STAGE_LABELS[profile.stage],
      lastContactAt: profile.lastContactAt,
      doNotContact: profile.doNotContact,
      tags: this.tagChips(person.id),
      touches,
      olderTouchesBefore: hasMoreTouches ? (touches[touches.length - 1]?.at ?? null) : null,
      newerPage: before !== null,
      followUps,
      openTasks: allows(actor.role, "work_care_tasks")
        ? this.careTasks
            .filter((task) => task.personId === person.id && task.status === "open")
            .sort((left, right) => left.dueAt - right.dueAt)
            .map((task) => this.taskView(actor, task))
        : [],
      mayEdit,
      mayRemove: allows(actor.role, "remove_people") && !isStaff(person.role) && person.id !== actor.personId,
      removableTagIds: mayEdit ? appliable.filter((tag) => applied.has(tag.id)).map((tag) => tag.id) : [],
      addableTags: mayEdit
        ? appliable.filter((tag) => !applied.has(tag.id)).map((tag) => ({ id: tag.id, name: tag.name, kind: tag.kind }))
        : [],
      stages: STAGES.map((id) => ({ id, label: STAGE_LABELS[id] })),
      touchKinds: TOUCH_KINDS.map((id) => ({ id, label: TOUCH_LABELS[id] })),
      outcomes: TOUCH_OUTCOMES.map((id) => ({ id, label: OUTCOME_LABELS[id] })),
    };
  }

  setPersonStage(token: string, personId: string, stage: string) {
    const actor = this.actor(token);
    const person = this.carePerson(actor, personId, "edit_people");
    if (!isStage(stage)) throw new AccessError("invalid", "Choose a stage from the list.");
    const row = this.writableProfile(person, actor);
    row.stage = stage satisfies Stage;
    this.record(actor, "write", "person_care", person.id, 2);
    return { id: person.id, stage: row.stage };
  }

  /** Logs a call, text, visit, email, prayer or private note. */
  logTouch(token: string, personId: string, input: { kind: string; outcome: string; note?: string }) {
    const actor = this.actor(token);
    const person = this.carePerson(actor, personId, "edit_people");
    if (!isTouchKind(input.kind)) throw new AccessError("invalid", "Choose what you did.");
    if (!isTouchOutcome(input.outcome)) throw new AccessError("invalid", "Choose how it went.");
    const kind: TouchKind = input.kind;
    const outcome: TouchOutcome = input.outcome;
    const note = (input.note ?? "").trim();
    if (note.length > NOTE_LIMIT) throw new AccessError("invalid", `Keep the note under ${NOTE_LIMIT} characters.`);
    const profile = this.writableProfile(person, actor);
    if (profile.doNotContact && reachesOut(kind) && outcome !== "asked_not_to_contact") {
      throw new AccessError("invalid", "They asked us not to contact them. You can still pray or add a note.");
    }
    const row: TouchRow = {
      id: newId("touch"),
      personId: person.id,
      kind,
      outcome,
      noteCiphertext: note ? encryptString(JSON.stringify({ note }), this.key) : "",
      byId: actor.personId,
      at: this.now(),
    };
    this.touches.push(row);
    if (countsAsContact(kind)) profile.lastContactAt = row.at;
    if (outcome === "asked_not_to_contact") profile.doNotContact = true;
    this.record(actor, "write", "touch", row.id, 2);
    return { id: row.id, lastContactAt: profile.lastContactAt, doNotContact: profile.doNotContact };
  }

  /** Clears "asked not to contact" after they say it is okay again. Pastor, care team, Master Admin. */
  allowContactAgain(token: string, personId: string) {
    const actor = this.actor(token);
    authorize(actor, "manage_tags", this.now());
    const person = this.carePerson(actor, personId, "edit_people");
    const row = this.writableProfile(person, actor);
    row.doNotContact = false;
    this.record(actor, "write", "person_care", person.id, 2);
    return { id: person.id, doNotContact: false };
  }

  careTags(token: string) {
    const actor = this.actor(token);
    authorize(actor, "view_people", this.now());
    const counts = new Map<string, number>();
    for (const row of this.personTags) counts.set(row.tagId, (counts.get(row.tagId) ?? 0) + 1);
    return {
      mayManage: allows(actor.role, "manage_tags"),
      kinds: TAG_KINDS,
      leaders: allows(actor.role, "manage_tags")
        ? [...this.people.values()]
            .filter((person) => !person.deleted && allows(person.role, "edit_people"))
            .map((person) => ({ id: person.id, displayName: person.displayName, roleLabel: labelRole(person.role) }))
            .sort((left, right) => left.displayName.localeCompare(right.displayName))
        : [],
      tags: this.tags
        .filter((tag) => !tag.archived)
        .map((tag) => ({
          id: tag.id,
          name: tag.name,
          kind: tag.kind,
          people: counts.get(tag.id) ?? 0,
          leaders: tag.leaderIds.map((id) => this.people.get(id)?.displayName ?? "").filter(Boolean),
        }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    };
  }

  createTag(token: string, input: { name: string; kind?: string; leaderIds?: string[] }) {
    const actor = this.actor(token);
    authorize(actor, "manage_tags", this.now());
    const name = cleanTagName(input.name ?? "");
    if (!name) throw new AccessError("invalid", "Give the tag a name.");
    if (isReservedName(name)) throw new AccessError("invalid", "Choose a different name.");
    const kind: TagKind = isTagKind(input.kind) ? input.kind : "custom";
    if (this.tags.some((tag) => !tag.archived && tag.name.toLowerCase() === name.toLowerCase())) {
      throw new AccessError("invalid", "There is already a tag with that name.");
    }
    const leaderIds = kind === "team" ? this.validLeaders(input.leaderIds ?? []) : [];
    const row: TagRow = {
      id: newId("tag"),
      name,
      kind,
      leaderIds,
      archived: false,
      createdAt: this.now(),
      createdBy: actor.personId,
    };
    this.tags.push(row);
    this.record(actor, "write", "tag", row.id, 1);
    return { id: row.id, name: row.name, kind: row.kind, leaderIds: [...row.leaderIds] };
  }

  setTagLeaders(token: string, tagId: string, leaderIds: string[]) {
    const actor = this.actor(token);
    authorize(actor, "manage_tags", this.now());
    const tag = this.tags.find((row) => row.id === tagId && !row.archived);
    if (!tag) throw new AccessError("not_found", "That tag isn't here.");
    if (tag.kind !== "team") throw new AccessError("invalid", "Only team tags have leaders.");
    tag.leaderIds = this.validLeaders(leaderIds);
    this.record(actor, "write", "tag", tag.id, 1);
    return { id: tag.id, leaderIds: [...tag.leaderIds] };
  }

  /** Archived tags drop off every list. The links stay so an undo can bring them back later. */
  archiveTag(token: string, tagId: string) {
    const actor = this.actor(token);
    authorize(actor, "manage_tags", this.now());
    const tag = this.tags.find((row) => row.id === tagId && !row.archived);
    if (!tag) throw new AccessError("not_found", "That tag isn't here.");
    tag.archived = true;
    this.record(actor, "write", "tag", tag.id, 1);
    return { id: tag.id, archived: true as const };
  }

  tagPerson(token: string, personId: string, tagId: string) {
    const actor = this.actor(token);
    const person = this.carePerson(actor, personId, "edit_people");
    const tag = this.tagsActorMayApply(actor).find((row) => row.id === tagId);
    if (!tag) throw new AccessError("forbidden", "That tag is not yours to use.");
    const id = personTagId(person.id, tag.id);
    if (!this.personTags.some((row) => row.id === id)) {
      this.personTags.push({ id, personId: person.id, tagId: tag.id, addedBy: actor.personId, addedAt: this.now() });
      this.record(actor, "write", "person_tag", id, 1);
    }
    return { personId: person.id, tagId: tag.id };
  }

  untagPerson(token: string, personId: string, tagId: string) {
    const actor = this.actor(token);
    const person = this.carePerson(actor, personId, "edit_people");
    const tag = this.tagsActorMayApply(actor).find((row) => row.id === tagId);
    if (!tag) throw new AccessError("forbidden", "That tag is not yours to use.");
    const id = personTagId(person.id, tag.id);
    const index = this.personTags.findIndex((row) => row.id === id);
    if (index >= 0) {
      this.personTags.splice(index, 1);
      this.record(actor, "write", "person_tag", id, 1);
    }
    return { personId: person.id, tagId: tag.id, removed: index >= 0 };
  }

  private validLeaders(ids: readonly string[]): string[] {
    const unique = [...new Set(ids.filter(Boolean))];
    for (const id of unique) {
      const person = this.people.get(id);
      if (!person || person.deleted || !allows(person.role, "edit_people")) {
        throw new AccessError("invalid", "Team leaders must be staff who can open People.");
      }
    }
    return unique;
  }

  // ---- Phase 2b: care engine -----------------------------------------------------------------

  private careSeatIds(): string[] {
    return [...this.people.values()]
      .filter((person) => !person.deleted && person.role === "care_team")
      .map((person) => person.id);
  }

  private playbookActive(definition: PlaybookDefinition): boolean {
    return this.playbookRows.find((row) => row.id === definition.id)?.active ?? false;
  }

  /** Called when a next step comes in. Does nothing unless a pastor or Master Admin turned the matching playbook on. */
  private startPlaybook(row: FollowUpRow) {
    const trigger = triggerFor(row.kind);
    if (!trigger) return;
    const definition = DEFAULT_PLAYBOOKS.find((item) => item.trigger === trigger);
    if (!definition || !this.playbookActive(definition)) return;
    const person = row.personId ? this.people.get(row.personId) : undefined;
    const doNotContact = person ? (this.profiles.get(person.id)?.doNotContact ?? false) : false;
    const steps = row.contactConsent && !doNotContact ? definition.steps : [PRAYER_ONLY_STEP];
    const seats = this.careSeatIds();
    const open = new Map<string, number>();
    for (const task of this.careTasks) {
      if (task.status === "open" && task.assigneeId) open.set(task.assigneeId, (open.get(task.assigneeId) ?? 0) + 1);
    }
    // One seat owns the whole playbook for this person, so they hear from one friendly voice.
    const assigneeId = pickCareSeat(seats, open);
    steps.forEach((step, index) => {
      this.careTasks.push({
        id: newId("task"),
        personId: row.personId,
        followUpId: row.id,
        playbookId: definition.id,
        step: index,
        title: step.title,
        channel: step.channel,
        assigneeId,
        dueAt: dueAtFor(row.createdAt, step),
        status: "open",
        attempts: 0,
        createdAt: row.createdAt,
        completedAt: null,
        completedBy: null,
        noteCiphertext: "",
      });
    });
  }

  private playbookStep(task: CareTaskRow): PlaybookStep | null {
    const definition = DEFAULT_PLAYBOOKS.find((item) => item.id === task.playbookId);
    if (!definition) return null;
    if (task.channel === "prayer" && task.title === PRAYER_ONLY_STEP.title) return PRAYER_ONLY_STEP;
    return definition.steps[task.step] ?? null;
  }

  private taskView(actor: Actor, task: CareTaskRow) {
    const now = this.now();
    const followUp = task.followUpId ? this.followUps.find((row) => row.id === task.followUpId) : undefined;
    const person = task.personId ? this.people.get(task.personId) : undefined;
    const contact = followUp ? this.readJson(followUp.ciphertext) : null;
    const name = person && !person.deleted ? person.displayName : textField(contact, "name") || "Guest";
    const definition = DEFAULT_PLAYBOOKS.find((item) => item.id === task.playbookId);
    const step = this.playbookStep(task);
    const me = this.people.get(actor.personId);
    this.record(actor, "read", "care_task", task.id, 3);
    return {
      id: task.id,
      name,
      personId: person && !person.deleted ? person.id : null,
      why: definition ? `${definition.name}, ${step?.withinHours ? "within 24 hours" : `day ${step?.day ?? 0}`}` : "Care",
      title: task.title,
      channel: task.channel,
      channelLabel: CHANNEL_LABELS[task.channel],
      script: step
        ? fillScript(step.script, { firstName: firstName(name), yourName: firstName(me?.displayName ?? "") })
        : "",
      consent: followUp?.contactConsent ?? Boolean(person),
      // Contact details are care records: they open only after "confirm it's you", like the Care desk.
      contactLocked: !this.unlocked(actor, "view_care_notes"),
      email: followUp?.contactConsent && this.unlocked(actor, "view_care_notes") ? textField(contact, "email") : "",
      phone: followUp?.contactConsent && this.unlocked(actor, "view_care_notes") ? textField(contact, "phone") : "",
      dueAt: task.dueAt,
      // The first salvation call is always a today job until it is late.
      bucket: step?.withinHours && task.dueAt >= now ? ("today" as const) : bucketFor(task.dueAt, now),
      overdue: task.status === "open" && task.dueAt < now,
      status: task.status,
      attempts: task.attempts,
      assigneeId: task.assigneeId,
      assigneeName: task.assigneeId ? (this.people.get(task.assigneeId)?.displayName ?? "") : "Nobody yet",
      salvation: definition?.trigger === "salvation",
    };
  }

  private mayWorkTask(actor: Actor, task: CareTaskRow): boolean {
    if (actor.role === "pastor" || actor.role === "master_admin") return true;
    return task.assigneeId === actor.personId;
  }

  /** Playbooks with their on/off state. Pastors and Master Admin can see them and turn one on or off. */
  playbooks(token: string) {
    const actor = this.actor(token);
    authorize(actor, "manage_playbooks", this.now());
    return {
      mayToggle: actor.role === "pastor" || actor.role === "master_admin",
      careSeats: this.careSeatIds().length,
      playbooks: DEFAULT_PLAYBOOKS.map((definition) => {
        const row = this.playbookRows.find((item) => item.id === definition.id);
        return {
          id: definition.id,
          name: definition.name,
          summary: definition.summary,
          active: row?.active ?? false,
          updatedAt: row?.updatedAt ?? null,
          updatedBy: row ? (this.people.get(row.updatedBy)?.displayName ?? "") : "",
          steps: definition.steps.map((step) => ({
            when: step.withinHours ? `Within ${step.withinHours} hours` : step.day === 0 ? "Same day" : `Day ${step.day}`,
            title: step.title,
            channel: CHANNEL_LABELS[step.channel],
            script: step.script,
          })),
        };
      }),
    };
  }

  setPlaybookActive(token: string, playbookId: string, active: boolean) {
    const actor = this.actor(token);
    authorize(actor, "manage_playbooks", this.now());
    if (actor.role !== "pastor" && actor.role !== "master_admin") {
      throw new AccessError("forbidden", "Only a pastor or Master Admin turns playbooks on or off.");
    }
    const definition = DEFAULT_PLAYBOOKS.find((item) => item.id === playbookId);
    if (!definition) throw new AccessError("not_found", "That playbook isn't here.");
    const existing = this.playbookRows.find((row) => row.id === definition.id);
    if (existing) {
      existing.active = active;
      existing.updatedBy = actor.personId;
      existing.updatedAt = this.now();
    } else {
      this.playbookRows.push({
        id: definition.id,
        trigger: definition.trigger,
        active,
        updatedBy: actor.personId,
        updatedAt: this.now(),
      });
    }
    this.record(actor, "write", "playbook", definition.id, 1);
    return { id: definition.id, active };
  }

  /** My tasks, or the whole team for pastors and Master Admin. Open tasks only, soonest first. */
  careTasksFor(token: string, options: { team?: boolean } = {}) {
    const actor = this.actor(token);
    authorize(actor, "work_care_tasks", this.now());
    const seesTeam = actor.role === "pastor" || actor.role === "master_admin";
    const team = Boolean(options.team) && seesTeam;
    const rows = this.careTasks
      .filter((task) => task.status === "open" && (team || task.assigneeId === actor.personId))
      .sort((left, right) => left.dueAt - right.dueAt);
    return {
      team,
      mayViewTeam: seesTeam,
      careSeats: this.careSeatIds().map((id) => ({ id, displayName: this.people.get(id)?.displayName ?? "" })),
      tasks: rows.map((task) => this.taskView(actor, task)),
    };
  }

  /** Numbers for the Overview "Today" card. */
  careToday(token: string) {
    const actor = this.actor(token);
    authorize(actor, "work_care_tasks", this.now());
    const now = this.now();
    const seesTeam = actor.role === "pastor" || actor.role === "master_admin";
    const mine = this.careTasks.filter((task) => task.status === "open" && task.assigneeId === actor.personId);
    const team = this.careTasks.filter((task) => task.status === "open");
    const count = (rows: CareTaskRow[], bucket: "overdue" | "today") =>
      rows.filter((task) => bucketFor(task.dueAt, now) === bucket).length;
    const weekStart = now - 7 * 24 * 60 * 60 * 1000;
    const decisions = this.followUps.filter((row) => row.kind === "salvation" && row.createdAt >= weekStart);
    const salvationTasks = this.careTasks.filter(
      (task) => task.playbookId === "playbook-salvation" && task.step === 0 && task.channel !== "prayer",
    );
    const reachedIn24 = salvationTasks.filter(
      (task) =>
        task.status === "done" &&
        task.completedAt !== null &&
        task.completedAt <= task.dueAt &&
        task.createdAt >= weekStart,
    ).length;
    this.record(actor, "read", "care_tasks", "today", 1);
    return {
      overdue: count(mine, "overdue"),
      today: count(mine, "today"),
      teamOverdue: seesTeam ? count(team, "overdue") : null,
      teamOpen: seesTeam ? team.length : null,
      unassigned: seesTeam ? team.filter((task) => !task.assigneeId).length : null,
      decisionsThisWeek: decisions.length,
      decisionsWaiting: decisions.filter((row) => row.status === "new").length,
      reachedIn24,
      salvationLate: team.filter(
        (task) => task.playbookId === "playbook-salvation" && task.step === 0 && task.dueAt < now,
      ).length,
      activePlaybooks: DEFAULT_PLAYBOOKS.filter((item) => this.playbookActive(item)).map((item) => item.name),
    };
  }

  /** Done, Couldn't reach (try again tomorrow, up to 3 tries), or Skip. Done on a person's task logs a touch. */
  completeTask(token: string, taskId: string, input: { outcome: string; note?: string }) {
    const actor = this.actor(token);
    authorize(actor, "work_care_tasks", this.now());
    const task = this.careTasks.find((row) => row.id === taskId);
    if (!task || task.status !== "open") throw new AccessError("not_found", "That task isn't open.");
    if (!this.mayWorkTask(actor, task)) throw new AccessError("forbidden", "That task belongs to someone else.");
    if (!isTaskOutcome(input.outcome)) throw new AccessError("invalid", "Choose Done, Couldn't reach, or Skip.");
    const note = (input.note ?? "").trim();
    if (note.length > NOTE_LIMIT) throw new AccessError("invalid", `Keep the note under ${NOTE_LIMIT} characters.`);
    const now = this.now();
    if (note) task.noteCiphertext = encryptString(JSON.stringify({ note }), this.key);
    if (input.outcome === "unreached") {
      task.attempts += 1;
      if (task.attempts >= MAX_ATTEMPTS) {
        task.status = "unreached";
        task.completedAt = now;
        task.completedBy = actor.personId;
      } else {
        task.dueAt = now + 24 * 60 * 60 * 1000;
      }
    } else {
      task.status = input.outcome;
      task.completedAt = now;
      task.completedBy = actor.personId;
    }
    const followUp = task.followUpId ? this.followUps.find((row) => row.id === task.followUpId) : undefined;
    if (followUp && followUp.status === "new" && input.outcome === "done" && task.channel !== "prayer") {
      followUp.status = "contacted";
    }
    // The person's timeline gets the touch too, so People and My tasks agree.
    const person = task.personId ? this.people.get(task.personId) : undefined;
    if (person && !person.deleted && input.outcome !== "skipped") {
      const kind: TouchKind = task.channel === "prayer" ? "prayer" : task.channel;
      const outcome: TouchOutcome =
        input.outcome === "unreached" ? "no_answer" : task.channel === "prayer" ? "prayed" : "reached";
      const profile = this.writableProfile(person, actor);
      const touch: TouchRow = {
        id: newId("touch"),
        personId: person.id,
        kind,
        outcome,
        noteCiphertext: note ? encryptString(JSON.stringify({ note }), this.key) : "",
        byId: actor.personId,
        at: now,
      };
      this.touches.push(touch);
      if (countsAsContact(kind) && outcome !== "no_answer") profile.lastContactAt = now;
    }
    this.record(actor, "write", "care_task", task.id, 2);
    return { id: task.id, status: task.status, attempts: task.attempts, dueAt: task.dueAt };
  }

  /**
   * A pastor or Master Admin removes someone who is not on staff (a duplicate, a test entry, someone who asked).
   * Needs "confirm it's you". Their care records, touches and tasks are erased; the audit log keeps the removal.
   */
  removePerson(token: string, personId: string) {
    const actor = this.actor(token);
    authorize(actor, "remove_people", this.now());
    const person = this.people.get(personId);
    if (!person || person.deleted) throw new AccessError("not_found", "That person isn't here.");
    if (person.id === actor.personId) throw new AccessError("invalid", "Use Delete my account in the app for yourself.");
    if (isStaff(person.role) || !isChurchRole(person.role)) {
      throw new AccessError("forbidden", "Staff seats are changed on Roles first. Only members and volunteers are removed here.");
    }
    this.eraseOwnedData(person.id, person.householdId);
    person.deleted = true;
    person.email = "";
    person.phone = "";
    person.passwordHash = null;
    person.totpSecret = null;
    person.displayName = "Former member";
    person.listedInDirectory = false;
    for (const [tokenKey, session] of this.sessions) if (session.personId === person.id) this.sessions.delete(tokenKey);
    this.record(actor, "write", "person_delete", person.id, 3);
    return { id: person.id, removed: true as const };
  }

  /** Pastors and Master Admin move a task to another care team seat. */
  reassignTask(token: string, taskId: string, assigneeId: string) {
    const actor = this.actor(token);
    authorize(actor, "work_care_tasks", this.now());
    if (actor.role !== "pastor" && actor.role !== "master_admin") {
      throw new AccessError("forbidden", "Ask a pastor to move this task.");
    }
    const task = this.careTasks.find((row) => row.id === taskId && row.status === "open");
    if (!task) throw new AccessError("not_found", "That task isn't open.");
    if (!this.careSeatIds().includes(assigneeId)) {
      throw new AccessError("invalid", "Tasks go only to care team seats.");
    }
    task.assigneeId = assigneeId;
    this.record(actor, "write", "care_task", task.id, 2);
    return { id: task.id, assigneeId };
  }

  updateFollowUp(
    token: string,
    id: string,
    input:
      | FollowUpStatus
      | {
          status?: FollowUpStatus;
          assigneeId?: string | null;
          dueAt?: number | null;
          staffNote?: string;
        },
  ) {
    const actor = this.actor(token);
    authorize(actor, "view_care_notes", this.now());
    const row = this.followUps.find((item) => item.id === id);
    if (!row) throw new AccessError("not_found", "That follow-up isn't here.");
    const patch = typeof input === "string" ? { status: input } : input;
    if (patch.status) row.status = patch.status;
    if (patch.assigneeId !== undefined) {
      if (patch.assigneeId === null || patch.assigneeId === "") row.assigneeId = null;
      else {
        const person = this.requirePerson(patch.assigneeId);
        if (person.deleted || !allows(person.role, "view_care_notes")) {
          throw new AccessError("invalid", "Choose someone who can open Care.");
        }
        row.assigneeId = person.id;
      }
    }
    if (patch.dueAt !== undefined) row.dueAt = patch.dueAt;
    if (typeof patch.staffNote === "string") {
      row.noteCiphertext = encryptString(JSON.stringify({ note: patch.staffNote.trim() }), this.key);
    }
    this.record(actor, "write", "follow_up", row.id, 3);
    return {
      id: row.id,
      status: row.status,
      assigneeId: row.assigneeId ?? null,
      dueAt: row.dueAt ?? null,
    };
  }

  careAssignees(token: string) {
    const actor = this.actor(token);
    authorize(actor, "view_care_notes", this.now());
    return [...this.people.values()]
      .filter((person) => !person.deleted && allows(person.role, "view_care_notes"))
      .map((person) => ({ id: person.id, displayName: person.displayName, role: person.role }));
  }

  pendingTestimonies(token: string) {
    const actor = this.actor(token);
    authorize(actor, "view_care_notes", this.now());
    return this.testimonies
      .filter((row) => !row.approved)
      .map((row) => {
        this.record(actor, "read", "testimony", row.id, 2);
        return { id: row.id, displayName: row.displayName, body: row.body, approved: false as const };
      });
  }

  reportedPrayers(token: string) {
    const actor = this.actor(token);
    authorize(actor, "view_care_notes", this.now());
    return this.prayers
      .filter((prayer) => prayer.reported === true && !prayer.approved)
      .map((prayer) => {
        this.record(actor, "read", "prayer", prayer.id, 1);
        return { id: prayer.id, body: prayer.body, sample: prayer.sample };
      });
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
    this.eraseOwnedData(person.id, person.householdId);
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

  listEvents(token: string) {
    const actor = this.actor(token);
    return this.upcomingEvents().map((event) => ({
      ...this.eventView(event),
      registered: this.registrations.some(
        (row) => row.eventId === event.id && row.personId === actor.personId,
      ),
    }));
  }

  storedGiftCiphertext(id: string) {
    return this.gifts.get(id)?.ciphertext ?? "";
  }

  private followUpViews(actor: Actor) {
    return [...this.followUps]
      .sort((left, right) => right.createdAt - left.createdAt)
      .map((row) => {
        this.record(actor, "read", "follow_up", row.id, 3);
        const contact = this.readJson(row.ciphertext);
        return {
          id: row.id,
          kind: row.kind,
          label: FOLLOW_UP_LABELS[row.kind],
          name: textField(contact, "name"),
          email: textField(contact, "email"),
          phone: textField(contact, "phone"),
          needs: supportNeeds(contact).map(supportLabel),
          contactConsent: row.contactConsent,
          member: row.personId !== null,
          status: row.status,
          createdAt: row.createdAt,
          sample: row.sample,
          assigneeId: row.assigneeId ?? null,
          assigneeName: row.assigneeId
            ? (this.people.get(row.assigneeId)?.displayName ?? "")
            : "",
          dueAt: row.dueAt ?? null,
          staffNote: row.noteCiphertext ? textField(this.readJson(row.noteCiphertext), "note") : "",
        };
      });
  }

  /** Rate-limits, then queues a follow-up with only the contact the person consented to share. */
  private queueFollowUp(
    actor: Actor | null,
    kind: FollowUpKind,
    input: { name?: string; email?: string; phone?: string; consent: boolean },
    client: string,
    extra: Record<string, unknown>,
  ): FollowUpRow {
    const now = this.now();
    this.pruneThrottle(now);
    if (actor) {
      this.hit(`person:${actor.personId}`, MEMBER_LIMIT, now);
    } else {
      this.hit(`client:${this.clientKey(client)}`, GUEST_LIMIT_PER_CLIENT, now);
      this.hit("guests", GUEST_LIMIT_TOTAL, now);
    }
    const person = actor ? this.requirePerson(actor.personId) : null;
    const name = (person?.displayName ?? input.name ?? "").trim();
    if (!name) throw new AccessError("invalid", "Please tell us your name.");
    const consent = input.consent;
    const contact = {
      ...extra,
      name,
      email: consent ? (input.email || person?.email || "").trim().toLowerCase() : "",
      phone: consent ? (input.phone ?? "").trim() : "",
    };
    const row: FollowUpRow = {
      id: newId("followup"),
      kind,
      personId: actor?.personId ?? null,
      ciphertext: encryptString(JSON.stringify(contact), this.key),
      contactConsent: consent,
      status: "new",
      createdAt: now,
      sample: false,
    };
    this.followUps.push(row);
    this.startPlaybook(row);
    return row;
  }

  private ensurePathway(personId: string) {
    const existing = this.pathways.get(personId);
    if (existing && existing.length > 0) return existing;
    const steps = DEFAULT_PATHWAY.map((step) => ({ id: step.id, title: step.title, status: "not-started" }));
    this.pathways.set(personId, steps);
    return steps;
  }

  /** A signed-out caller, or one whose saved session ended, is treated as a guest. */
  private optionalActor(token: string | null): Actor | null {
    if (!token) return null;
    try {
      return this.actor(token);
    } catch (error) {
      if (error instanceof AccessError) return null;
      throw error;
    }
  }

  /** The raw IP never reaches the snapshot. */
  private clientKey(client: string): string {
    return createHmac("sha256", this.key)
      .update(client || "unknown")
      .digest("hex")
      .slice(0, 32);
  }

  private pruneThrottle(now: number) {
    for (const [key, hits] of this.throttle) {
      const recent = hits.filter((at) => now - at < HOUR_MS);
      if (recent.length === 0) this.throttle.delete(key);
      else this.throttle.set(key, recent);
    }
  }

  private hit(key: string, limit: number, now: number) {
    const hits = this.throttle.get(key) ?? [];
    if (hits.length >= limit) {
      throw new AccessError(
        "rate_limited",
        "We received several requests already. Please try again in an hour.",
      );
    }
    this.throttle.set(key, [...hits, now]);
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
      if (person) person.passwordHash = localAuthProvider.hashPassword(password);
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
    const now = this.now();
    const refreshAfter = 60_000;
    const sampleSession =
      this.config.env === "demo" &&
      (session.userAgent === "staff-demo" || session.userAgent === "member-demo");
    if (
      sampleSession &&
      session.userAgent === "staff-demo" &&
      session.stepUpUntil < now + this.config.stepUpMs / 2
    ) {
      session.stepUpUntil = now + this.config.stepUpMs;
    }
    const idle = isStaff(person.role) ? this.config.sessionIdleStaffMs : this.config.sessionIdleMemberMs;
    if (!sampleSession && now - session.lastActivity > idle) {
      this.sessions.delete(token);
      throw new AccessError("session_expired", "Your session timed out.");
    }
    if (now - session.lastActivity >= refreshAfter) session.lastActivity = now;
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
    if (
      this.config.env === "demo" &&
      (token === "session-staff-demo" || token === "session-member-demo") &&
      !this.sessions.has(token)
    ) {
      this.ensureDemoSession(token);
    }
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
      fundName: GIVING_FUNDS.find((fund) => fund.id === fundId)?.name ?? RETIRED_FUND_NAMES[fundId] ?? fundId,
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
      url: event.url ?? null,
    };
  }

  /** Events that have not ended and were not canceled, soonest first. */
  private upcomingEvents() {
    const now = this.now();
    return this.events
      .filter((event) => event.cancelled !== true && event.end >= now)
      .sort((left, right) => left.start - right.start);
  }

  private eventFrom(
    input: {
      title: string;
      location: string;
      start: number;
      end: number;
      description?: string;
      capacity?: number | null;
    },
    id = newId("event"),
  ): EventRow {
    const title = input.title.trim();
    const location = input.location.trim();
    if (!title || !location) throw new AccessError("invalid", "Add a name and a place.");
    if (!Number.isFinite(input.start) || !Number.isFinite(input.end) || input.end <= input.start) {
      throw new AccessError("invalid", "The end has to be after the start.");
    }
    const capacity = input.capacity ?? null;
    if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) {
      throw new AccessError("invalid", "Capacity has to be a whole number, or leave it open.");
    }
    return {
      id,
      title,
      start: input.start,
      end: input.end,
      location,
      description: (input.description ?? "").trim(),
      capacity,
      sample: false,
      cancelled: false,
      staffEdited: true,
    };
  }

  private outreachFrom(
    input: { title: string; detail: string; location: string; start: number; end: number },
    id = newId("outreach"),
  ): OutreachRow {
    const title = input.title.trim();
    const location = input.location.trim();
    if (!title || !location) throw new AccessError("invalid", "Add a name and a place.");
    if (!Number.isFinite(input.start) || !Number.isFinite(input.end) || input.end <= input.start) {
      throw new AccessError("invalid", "The end has to be after the start.");
    }
    return {
      id,
      title,
      detail: input.detail.trim(),
      location,
      start: input.start,
      end: input.end,
      sample: false,
      cancelled: false,
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

  private publicGroup(group: GroupRow) {
    return {
      id: group.id,
      name: group.name,
      summary: group.summary,
      sample: group.sample,
      category: group.category ?? null,
      schedule: group.schedule ?? "",
      area: group.area ?? "",
      leaders: [...(group.leaders ?? [])],
      joinType: group.joinType ?? ("open" as const),
      url: group.url ?? null,
    };
  }

  /** Merges fields into the child's encrypted record. Undefined fields are removed. */
  private writeKidFields(child: ChildRow, fields: Record<string, unknown>) {
    const prior = this.readJson(child.ciphertext);
    const base = prior && typeof prior === "object" ? (prior as Record<string, unknown>) : {};
    child.ciphertext = encryptString(JSON.stringify({ ...base, ...fields }), this.key);
  }

  /**
   * Releases a checked-in child to a verified guardian with the matching code.
   * The code works once. Only a wrong security code counts toward the hourly
   * lockout; a station that is short two adults does not lock the family out.
   */
  private releaseChild(actor: Actor, child: ChildRow, code: string, guardianPersonId: string) {
    const now = this.now();
    this.pruneThrottle(now);
    const key = `pickup:${child.id}`;
    const misses = this.throttle.get(key) ?? [];
    if (misses.length >= PICKUP_ATTEMPTS) {
      throw new AccessError(
        "rate_limited",
        "Pickup is locked after several wrong tries. Please see a check-in leader.",
      );
    }
    this.record(actor, "read", "kid_pickup", child.id, 3);
    const verdict = evaluatePickup({
      code,
      expectedCode: textField(this.readJson(child.ciphertext), "code"),
      guardianAuthorized: child.guardianIds.includes(guardianPersonId),
      custodyRestricted: child.restrictedPersonIds.includes(guardianPersonId),
      adultsOnDuty: this.kidsOnDuty(),
    });
    if (verdict.allowed) {
      this.writeKidFields(child, { code: undefined, checkedInAt: undefined });
      this.throttle.delete(key);
      this.record(actor, "write", "kid_checkout", child.id, 3);
    } else if (verdict.countsTowardLockout) {
      this.throttle.set(key, [...misses, now]);
    }
    return { allowed: verdict.allowed, reason: verdict.reason };
  }

  private announcementFrom(
    input: { title: string; body: string; startsAt?: number | null; endsAt?: number | null },
    id = newId("ann"),
  ): AnnouncementCard {
    const title = input.title.trim();
    const body = input.body.trim();
    if (!title || !body) throw new AccessError("invalid", "Add a title and a short note.");
    if (title.length > 80 || body.length > 500) throw new AccessError("invalid", "Please shorten that card.");
    const startsAt = input.startsAt ?? null;
    const endsAt = input.endsAt ?? null;
    const problem = windowError(startsAt, endsAt);
    if (problem) throw new AccessError("invalid", problem);
    return {
      id,
      title,
      body,
      sample: false,
      startsAt,
      endsAt,
      archived: false,
      staffEdited: true,
    };
  }

  /** Built-in Home cards are added once. An existing row, edited or not, is left alone. */
  private placeDefaultAnnouncement(row: AnnouncementCard) {
    if (this.announcements.some((item) => item.id === row.id)) return;
    this.announcements.push(row);
  }

  private assertMayInvite(issuerRole: Role, targetRole: Role) {
    if (mayIssueInvite(issuerRole, targetRole)) return;
    throw new AccessError(
      "forbidden",
      targetRole === "master_admin"
        ? "Only a Master Admin can make a code for a Master Admin seat."
        : targetRole === "pastor"
          ? "Only a Master Admin can make a code for a pastor seat."
          : "You can only make a code for a role below your own level.",
    );
  }

  private canUndoAdd(actor: Actor, person: Person): boolean {
    if (person.deleted || person.passwordHash || person.sample) return false;
    if (isStaff(person.role)) return false;
    if (!person.addedBy || person.addedBy !== actor.personId || person.addedAt == null) return false;
    return this.now() - person.addedAt <= UNDO_ADD_MS;
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
      listedInDirectory: person.listedInDirectory,
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
    if (!g.__onehopeSampleHash) g.__onehopeSampleHash = localAuthProvider.hashPassword(SAMPLE_PASSWORD);
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
    this.syncPublicCatalog();
  }

  /**
   * Public church content from weareonehope.com and Church Center, upserted by
   * id on every load so a saved snapshot picks up corrections without losing
   * memberships or registrations. Placeholder groups from builds 1–5 are retired.
   */
  private syncPublicCatalog() {
    const upsert = <T extends { id: string }>(rows: T[], row: T) => {
      const index = rows.findIndex((item) => item.id === row.id);
      if (index === -1) rows.push(row);
      else rows[index] = row;
    };
    // Insert the built-in cards only when the church does not already have them.
    // A saved edit, archive, or schedule must survive the next boot.
    this.placeDefaultAnnouncement({
      id: "ann-sunday",
      title: "Sunday gathering",
      body: "10:30 a.m. Come early for donuts and coffee.",
      sample: false,
      startsAt: null,
      endsAt: null,
      archived: false,
      staffEdited: false,
    });
    this.placeDefaultAnnouncement({
      id: "ann-kids",
      title: "One Hope Kids",
      body: "Kids ministry is open during the Sunday gathering, from 3 months through 5th grade.",
      sample: false,
      startsAt: null,
      endsAt: null,
      archived: false,
      staffEdited: false,
    });
    const sunday = this.events.find((event) => event.id === "event-sunday");
    if (!sunday?.cancelled && (!sunday || sunday.end < this.now())) {
      const service = nextSundayService(new Date(this.now())).service.getTime();
      if (sunday?.staffEdited) {
        const length = Math.max(sunday.end - sunday.start, 60 * 60 * 1000);
        sunday.start = service;
        sunday.end = service + length;
      } else {
        upsert(this.events, {
          id: "event-sunday",
          title: "Sunday gathering",
          start: service,
          end: service + 90 * 60 * 1000,
          location: `${CHURCH.addressLine}, ${CHURCH.city}, ${CHURCH.region} ${CHURCH.postalCode}`,
          description: "Worship at 10:30 a.m. Come early for donuts and coffee.",
          capacity: null,
          sample: false,
          cancelled: false,
          staffEdited: false,
        });
      }
    }
    for (const event of CHURCH_EVENTS) {
      const existing = this.events.find((item) => item.id === event.id);
      if (existing?.staffEdited || existing?.cancelled) continue;
      upsert(this.events, { ...event, capacity: null, sample: false, cancelled: false, staffEdited: false });
    }
    const retired = new Set(RETIRED_GROUP_IDS);
    this.groups.splice(0, this.groups.length, ...this.groups.filter((group) => !retired.has(group.id)));
    this.messages.splice(
      0,
      this.messages.length,
      ...this.messages.filter((message) => !retired.has(message.groupId)),
    );
    for (const group of CHURCH_GROUPS) {
      const memberIds = this.groups.find((item) => item.id === group.id)?.memberIds ?? [];
      upsert(this.groups, { ...group, leaders: [...group.leaders], sample: false, memberIds });
    }
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
    this.kidsTeam.add("person-frankie");
    this.kidsTeam.add("person-gray");
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

    // Phase 2a sample care rows. Labelled samples like every other seeded row.
    this.tags.push(
      {
        id: "tag-greeters",
        name: "Greeters (sample)",
        kind: "team",
        leaderIds: ["person-gray"],
        archived: false,
        createdAt: SEED_AT,
        createdBy: "person-reese",
      },
      {
        id: "tag-new-here",
        name: "New here (sample)",
        kind: "custom",
        leaderIds: [],
        archived: false,
        createdAt: SEED_AT,
        createdBy: "person-reese",
      },
    );
    for (const [personId, tagId] of [
      ["person-blake", "tag-greeters"],
      ["person-casey", "tag-new-here"],
    ] as const) {
      this.personTags.push({ id: personTagId(personId, tagId), personId, tagId, addedBy: "person-reese", addedAt: SEED_AT });
    }

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
      people: [...this.people.values()].map((person) => {
        const { totpSecret, ...rest } = person;
        return totpSecret ? { ...rest, totpSecret: totpSecret.toString("base64") } : rest;
      }),
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
      invites: [...this.invites.entries()].map(([tokenHash, invite]) => ({ tokenHash, ...invite })),
      followUps: this.followUps.map((row) => ({ ...row })),
      streaks: [...this.streaks.values()].map((row) => ({ ...row })),
      throttle: [...this.throttle.entries()].map(([key, hits]) => ({ key, hits: [...hits] })),
      amens: this.amens.map((row) => ({ ...row })),
      myFive: [...this.myFive.entries()].map(([personId, names]) => ({ personId, names: [...names] })),
      testimonies: this.testimonies.map((row) => ({ ...row })),
      milestones: this.milestones.map((row) => ({ ...row })),
      outreach: this.outreach.map((row) => ({ ...row })),
      outreachRsvps: this.outreachRsvps.map((row) => ({ ...row })),
      coffeeOrders: this.coffeeOrders.map((row) => ({ ...row })),
      social: this.social.map((link) => ({ ...link })),
      featuredMessage: this.featured ? { ...this.featured } : null,
      kidsTeam: [...this.kidsTeam],
      profiles: [...this.profiles.values()].map((row) => ({ ...row })),
      tags: this.tags.map((row) => ({ ...row, leaderIds: [...row.leaderIds] })),
      personTags: this.personTags.map((row) => ({ ...row })),
      touches: this.touches.map((row) => ({ ...row })),
      playbooks: this.playbookRows.map((row) => ({ ...row })),
      careTasks: this.careTasks.map((row) => ({ ...row })),
    };
  }

  /**
   * Replaces in-memory rows and does not reseed church content.
   * Used when a non-church tenant is loaded so One Hope's catalog cannot leak into it.
   */
  replaceDocument(document: StoreDocument): void {
    if (document.version !== 1) throw new Error("This snapshot version is not supported.");
    this.people.clear();
    for (const person of document.people) {
      const { totpSecret, ...rest } = person;
      this.people.set(person.id, {
        ...rest,
        totpSecret: totpSecret ? Buffer.from(totpSecret, "base64") : null,
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
    this.invites.clear();
    for (const invite of document.invites ?? []) {
      this.invites.set(invite.tokenHash, {
        email: invite.email,
        expires: invite.expires,
        issuerRole: invite.issuerRole ?? null,
        issuerId: invite.issuerId ?? "",
      });
    }
    this.followUps.splice(0, this.followUps.length, ...(document.followUps ?? []));
    this.streaks.clear();
    for (const row of document.streaks ?? []) this.streaks.set(row.personId, row);
    this.throttle.clear();
    for (const row of document.throttle ?? []) this.throttle.set(row.key, row.hits);
    this.amens.splice(0, this.amens.length, ...(document.amens ?? []));
    this.myFive.clear();
    for (const row of document.myFive ?? []) this.myFive.set(row.personId, [...row.names]);
    this.testimonies.splice(0, this.testimonies.length, ...(document.testimonies ?? []));
    this.milestones.splice(0, this.milestones.length, ...(document.milestones ?? []));
    this.outreach.splice(0, this.outreach.length, ...(document.outreach ?? []));
    this.outreachRsvps.splice(0, this.outreachRsvps.length, ...(document.outreachRsvps ?? []));
    this.coffeeOrders.splice(0, this.coffeeOrders.length, ...(document.coffeeOrders ?? []));
    this.social = document.social
      ? document.social.map((link) => ({ ...link }))
      : SITE_SOCIAL.map((link) => ({ ...link }));
    this.featured = document.featuredMessage ? { ...document.featuredMessage } : null;
    this.kidsTeam.clear();
    for (const personId of document.kidsTeam ?? []) this.kidsTeam.add(personId);
    this.profiles.clear();
    for (const row of document.profiles ?? []) this.profiles.set(row.personId, { ...row });
    this.tags.splice(0, this.tags.length, ...(document.tags ?? []).map((row) => ({ ...row, leaderIds: [...(row.leaderIds ?? [])] })));
    this.personTags.splice(0, this.personTags.length, ...(document.personTags ?? []).map((row) => ({ ...row })));
    this.touches.splice(0, this.touches.length, ...(document.touches ?? []).map((row) => ({ ...row })));
    this.playbookRows.splice(0, this.playbookRows.length, ...(document.playbooks ?? []).map((row) => ({ ...row })));
    this.careTasks.splice(0, this.careTasks.length, ...(document.careTasks ?? []).map((row) => ({ ...row })));
  }

  installDocument(document: StoreDocument): void {
    this.replaceDocument(document);
    this.rekeyStoredSecrets();
    this.scrubFormerMembers();
    if (this.fixture) this.ensureDemoSessions();
    else this.dropFixtureContent();
    this.applyBootPassword();
  }

  private rekeyStoredSecrets() {
    const current = this.key;
    const previous = demoFieldKey();
    const rotate = (value: string) => reencrypt(value, current, previous);
    for (const gift of this.gifts.values()) gift.ciphertext = rotate(gift.ciphertext);
    for (const child of this.children.values()) child.ciphertext = rotate(child.ciphertext);
    for (const note of this.notes) note.ciphertext = rotate(note.ciphertext);
    for (const check of this.checks.values()) check.ciphertext = rotate(check.ciphertext);
    for (const secret of this.secrets.values()) secret.ciphertext = rotate(secret.ciphertext);
    for (const request of this.requests) request.ciphertext = rotate(request.ciphertext);
    for (const row of this.followUps) {
      row.ciphertext = rotate(row.ciphertext);
      if (row.noteCiphertext) row.noteCiphertext = rotate(row.noteCiphertext);
    }
  }

  private scrubFormerMembers() {
    for (const person of [...this.people.values()]) {
      if (!person.deleted) continue;
      this.eraseOwnedData(person.id, person.householdId);
    }
  }

  private eraseOwnedData(personId: string, householdId: string | null) {
    const others = [...this.people.values()].filter(
      (item) =>
        item.id !== personId && householdId !== null && item.householdId === householdId && !item.deleted,
    );
    this.prayers.splice(0, this.prayers.length, ...this.prayers.filter((row) => row.authorId !== personId));
    this.registrations.splice(
      0,
      this.registrations.length,
      ...this.registrations.filter((row) => row.personId !== personId),
    );
    this.messages.splice(
      0,
      this.messages.length,
      ...this.messages.filter((row) => row.authorId !== personId),
    );
    this.notes.splice(
      0,
      this.notes.length,
      ...this.notes.filter((row) => row.authorId !== personId && row.subjectPersonId !== personId),
    );
    this.schedule.splice(
      0,
      this.schedule.length,
      ...this.schedule.filter((row) => row.personId !== personId),
    );
    this.volunteers.splice(
      0,
      this.volunteers.length,
      ...this.volunteers.filter((row) => row.personId !== personId),
    );
    this.requests.splice(
      0,
      this.requests.length,
      ...this.requests.filter((row) => row.personId !== personId),
    );
    this.followUps.splice(
      0,
      this.followUps.length,
      ...this.followUps.filter((row) => row.personId !== personId),
    );
    this.streaks.delete(personId);
    this.myFive.delete(personId);
    this.profiles.delete(personId);
    for (let i = this.personTags.length - 1; i >= 0; i -= 1)
      if (this.personTags[i]?.personId === personId) this.personTags.splice(i, 1);
    for (let i = this.touches.length - 1; i >= 0; i -= 1)
      if (this.touches[i]?.personId === personId) this.touches.splice(i, 1);
    for (const tag of this.tags) tag.leaderIds = tag.leaderIds.filter((id) => id !== personId);
    const liveFollowUps = new Set(this.followUps.map((row) => row.id));
    for (let i = this.careTasks.length - 1; i >= 0; i -= 1) {
      const task = this.careTasks[i];
      if (!task) continue;
      if (task.personId === personId || (task.followUpId !== null && !liveFollowUps.has(task.followUpId))) {
        this.careTasks.splice(i, 1);
      } else if (task.assigneeId === personId) {
        task.assigneeId = null;
      }
    }
    for (let i = this.amens.length - 1; i >= 0; i -= 1)
      if (this.amens[i]?.personId === personId) this.amens.splice(i, 1);
    for (let i = this.testimonies.length - 1; i >= 0; i -= 1)
      if (this.testimonies[i]?.authorId === personId) this.testimonies.splice(i, 1);
    for (let i = this.outreachRsvps.length - 1; i >= 0; i -= 1)
      if (this.outreachRsvps[i]?.personId === personId) this.outreachRsvps.splice(i, 1);
    for (const order of this.coffeeOrders) if (order.personId === personId) order.personId = null;
    this.checks.delete(personId);
    this.pathways.delete(personId);
    for (const group of this.groups) group.memberIds = group.memberIds.filter((id) => id !== personId);
    const last = others.length === 0 && Boolean(householdId);
    for (const [id, child] of [...this.children.entries()]) {
      if (householdId && child.householdId === householdId && last) {
        this.children.delete(id);
        continue;
      }
      if (!child.guardianIds.includes(personId)) continue;
      const remaining = child.guardianIds.filter((id) => id !== personId);
      if (remaining.length === 0) this.children.delete(id);
      else child.guardianIds = remaining;
    }
    if (last && householdId) {
      for (const [id, gift] of [...this.gifts.entries()]) {
        if (gift.householdId === householdId) this.gifts.delete(id);
      }
    }
  }

  private applyBootPassword() {
    const boot = process.env.MASTER_ADMIN_BOOT_PASSWORD ?? "";
    if (boot.length < 8) return;
    const person = this.byEmail(this.config.masterAdminPrimaryEmail);
    if (person && !person.passwordHash && !person.deleted) person.passwordHash = localAuthProvider.hashPassword(boot);
  }

  private dropFixtureContent() {
    for (const person of [...this.people.values()]) {
      if (person.sample || person.email.endsWith("@sample.onehope")) this.people.delete(person.id);
    }
    const keep = <T extends { sample: boolean }>(rows: T[]) => rows.filter((row) => !row.sample);
    this.announcements.splice(0, this.announcements.length, ...keep(this.announcements));
    this.events.splice(0, this.events.length, ...keep(this.events));
    this.groups.splice(0, this.groups.length, ...keep(this.groups));
    this.prayers.splice(0, this.prayers.length, ...keep(this.prayers));
    for (const [id, gift] of [...this.gifts.entries()]) {
      if (gift.sample) this.gifts.delete(id);
    }
    for (const [id, child] of [...this.children.entries()]) {
      if (child.sample) this.children.delete(id);
    }
    if (this.people.has("person-nicholas")) this.syncPublicCatalog();
    else this.loadPublic();
  }

  private ensureDemoSessions() {
    this.ensureDemoSession("session-member-demo");
    this.ensureDemoSession("session-staff-demo");
  }

  private ensureDemoSession(token: string) {
    if (this.config.env !== "demo" || this.sessions.has(token)) return;
    if (token === "session-member-demo") {
      this.sessions.set(token, {
        token,
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
    if (token === "session-staff-demo") {
      this.sessions.set(token, {
        token,
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

function isReservedName(name: string): boolean {
  return name.trim().toLowerCase() === "former member";
}

function hashInvite(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function reencrypt(value: string, current: Buffer, previous: Buffer): string {
  if (!value || current.equals(previous)) return value;
  try {
    decryptString(value, current);
    return value;
  } catch {
    try {
      return encryptString(decryptString(value, previous), current);
    } catch {
      return value;
    }
  }
}

function replaceMap<T extends { id: string }>(target: Map<string, T>, rows: T[]) {
  target.clear();
  for (const row of rows) target.set(row.id, row);
}

function supportLabel(id: SupportNeedId): string {
  return SUPPORT_NEEDS.find((need) => need.id === id)?.label ?? id;
}

function supportNeeds(value: unknown): SupportNeedId[] {
  if (!value || typeof value !== "object" || !("needs" in value)) return [];
  const needs = (value as { needs: unknown }).needs;
  if (!Array.isArray(needs)) return [];
  return needs.filter((need): need is SupportNeedId => SUPPORT_NEEDS.some((item) => item.id === need));
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

function youtubeMessageLink(videoId: string, link: string): boolean {
  try {
    const url = new URL(link);
    if (url.protocol !== "https:") return false;
    if (url.hostname === "youtu.be") return url.pathname.replace(/^\//, "") === videoId;
    if (url.hostname !== "www.youtube.com" && url.hostname !== "youtube.com") return false;
    return (
      url.searchParams.get("v") === videoId ||
      url.pathname === `/shorts/${videoId}` ||
      url.pathname === `/embed/${videoId}`
    );
  } catch {
    return false;
  }
}

function textField(value: unknown, key: string): string {
  if (!value || typeof value !== "object" || !(key in value)) return "";
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" ? field : "";
}
