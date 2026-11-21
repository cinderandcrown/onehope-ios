export const ROLES = [
  "master_admin",
  "pastor",
  "care_team",
  "finance",
  "kids_director",
  "team_leader",
  "volunteer",
  "member",
  "shop_owner",
  "shop_manager",
  "barista",
  "customer",
  "platform_operator",
] as const;

export type Role = (typeof ROLES)[number];

export const ACTIONS = [
  "view_public",
  "view_directory",
  "edit_own_profile",
  "view_household_tier3",
  "view_all_giving",
  "view_care_notes",
  "share_care_note",
  "view_kids_medical",
  "view_background_checks",
  "manage_serving",
  "manage_events",
  "manage_checkin",
  "compose_communications",
  "approve_expenses",
  "manage_integrations",
  "manage_module_flags",
  "grant_staff_roles",
  "assign_team_roles",
  "propose_master_admin",
  "view_audit_log",
  "view_people",
  "edit_people",
  "manage_tags",
] as const;

export type Action = (typeof ACTIONS)[number];

export const ROLE_ORDER: readonly Role[] = ROLES;

const MEMBER_ACTIONS: readonly Action[] = [
  "view_public",
  "view_directory",
  "edit_own_profile",
  "view_household_tier3",
];

export function actionsFor(role: Role): readonly Action[] {
  switch (role) {
    case "member":
      return MEMBER_ACTIONS;
    case "volunteer":
      return MEMBER_ACTIONS;
    case "team_leader":
      // People on teams they lead, plus people they added.
      return [...MEMBER_ACTIONS, "manage_serving", "view_people", "edit_people"];
    case "kids_director":
      // Kids households and the kids team only.
      return [
        ...MEMBER_ACTIONS,
        "manage_checkin",
        "view_kids_medical",
        "view_background_checks",
        "view_people",
        "edit_people",
      ];
    case "finance":
      return [...MEMBER_ACTIONS, "view_all_giving", "approve_expenses"];
    case "care_team":
      return [...MEMBER_ACTIONS, "view_care_notes", "share_care_note", "view_people", "edit_people", "manage_tags"];
    case "pastor":
      return [
        ...MEMBER_ACTIONS,
        "view_all_giving",
        "view_care_notes",
        "share_care_note",
        "view_kids_medical",
        "view_background_checks",
        "manage_serving",
        "manage_events",
        "manage_checkin",
        "compose_communications",
        "approve_expenses",
        "assign_team_roles",
        "view_audit_log",
        "view_people",
        "edit_people",
        "manage_tags",
      ];
    case "master_admin":
      return ACTIONS;
    case "shop_owner":
    case "shop_manager":
    case "barista":
    case "customer":
      return ["view_public", "edit_own_profile"];
    case "platform_operator":
      return ["view_public"];
    default:
      return assertNever(role);
  }
}

const PERMISSIONS: Record<Role, ReadonlySet<Action>> = {
  master_admin: new Set(actionsFor("master_admin")),
  pastor: new Set(actionsFor("pastor")),
  care_team: new Set(actionsFor("care_team")),
  finance: new Set(actionsFor("finance")),
  kids_director: new Set(actionsFor("kids_director")),
  team_leader: new Set(actionsFor("team_leader")),
  volunteer: new Set(actionsFor("volunteer")),
  member: new Set(actionsFor("member")),
  shop_owner: new Set(actionsFor("shop_owner")),
  shop_manager: new Set(actionsFor("shop_manager")),
  barista: new Set(actionsFor("barista")),
  customer: new Set(actionsFor("customer")),
  platform_operator: new Set(actionsFor("platform_operator")),
};

export function allows(role: Role, action: Action): boolean {
  return PERMISSIONS[role].has(action);
}

export function permissionMatrix(): { role: Role; grants: Record<Action, boolean> }[] {
  return ROLE_ORDER.map((role) => {
    const grants = {} as Record<Action, boolean>;
    for (const action of ACTIONS) grants[action] = allows(role, action);
    return { role, grants };
  });
}

export const STAFF_ROLES: ReadonlySet<Role> = new Set<Role>([
  "master_admin",
  "pastor",
  "care_team",
  "finance",
  "kids_director",
  "team_leader",
]);

export function isStaff(role: Role): boolean {
  return STAFF_ROLES.has(role);
}

/**
 * Higher numbers outrank lower ones.
 * A Master Admin may target any role. Every other role may invite or change roles only strictly below its own
 * level (a care teammate cannot seat finance or another care teammate). Pastor and Master Admin seats are
 * Master Admin only.
 */
const ROLE_PRIVILEGE: Record<Role, number> = {
  master_admin: 70,
  pastor: 60,
  care_team: 50,
  finance: 50,
  kids_director: 50,
  team_leader: 40,
  volunteer: 30,
  member: 20,
  shop_owner: 15,
  shop_manager: 14,
  barista: 13,
  customer: 10,
  platform_operator: 5,
};

export function mayIssueInvite(issuerRole: Role, targetRole: Role): boolean {
  if (issuerRole === "master_admin") return true;
  if (targetRole === "master_admin" || targetRole === "pastor") return false;
  // Everyone else reaches only roles strictly below their own: no peer seats.
  return ROLE_PRIVILEGE[targetRole] < ROLE_PRIVILEGE[issuerRole];
}

/** Both the person's current role and the new role must be strictly below the actor (Master Admin excepted). */
export function mayChangeRole(actorRole: Role, currentRole: Role, targetRole: Role): boolean {
  return mayIssueInvite(actorRole, currentRole) && mayIssueInvite(actorRole, targetRole);
}

export const TIER3_ACTIONS: ReadonlySet<Action> = new Set<Action>([
  "view_household_tier3",
  "view_all_giving",
  "view_care_notes",
  "share_care_note",
  "view_kids_medical",
  "view_background_checks",
]);

export const SENSITIVE_STAFF_ROLES: ReadonlySet<Role> = new Set<Role>([
  "pastor",
  "care_team",
  "finance",
  "kids_director",
]);

export const TEAM_ASSIGNABLE_ROLES: ReadonlySet<Role> = new Set<Role>(["team_leader", "volunteer", "member"]);

/** The only serving spot that counts as a kids-team assignment. Matched by id, not by the spot's name. */
export const KIDS_POSITION_ID = "kids";

export const SERVING_SPOTS = [
  { id: "door", label: "Door" },
  { id: KIDS_POSITION_ID, label: "Kids" },
  { id: "coffee", label: "Coffee" },
  { id: "parking", label: "Parking" },
  { id: "welcome", label: "Welcome" },
] as const;

export class AccessError extends Error {
  readonly code:
    | "unauthenticated"
    | "mfa_required"
    | "step_up_required"
    | "forbidden"
    | "not_found"
    | "invalid"
    | "sends_disabled"
    | "seat_empty"
    | "two_person"
    | "session_expired"
    | "rate_limited";

  constructor(code: AccessError["code"], message: string) {
    super(message);
    this.name = "AccessError";
    this.code = code;
  }
}

/**
 * Next can bundle this package into more than one server chunk. The in-memory
 * store may then come from a different copy than the API route, so
 * `instanceof` alone misses errors thrown by that store.
 */
export function isAccessError(error: unknown): error is AccessError {
  return (
    error instanceof AccessError ||
    (error instanceof Error &&
      error.name === "AccessError" &&
      typeof (error as { code?: unknown }).code === "string")
  );
}

export type Actor = {
  personId: string;
  householdId: string | null;
  role: Role;
  mfaVerified: boolean;
  stepUpUntil: number;
  sample: boolean;
};

export function assertNever(value: never): never {
  throw new Error(`Unhandled variant: ${JSON.stringify(value)}`);
}

export function authorize(actor: Actor, action: Action, now: number): void {
  if (isStaff(actor.role) && !actor.mfaVerified) {
    throw new AccessError("mfa_required", "Staff must finish multi-factor authentication.");
  }
  if (!allows(actor.role, action)) {
    throw new AccessError(
      "forbidden",
      `The ${labelRole(actor.role)} role cannot ${action.replaceAll("_", " ")}.`,
    );
  }
  if (TIER3_ACTIONS.has(action) && actor.stepUpUntil < now) {
    throw new AccessError("step_up_required", "Confirm it's you again before opening sensitive records.");
  }
}

export function labelRole(role: Role): string {
  switch (role) {
    case "master_admin":
      return "Master Admin";
    case "pastor":
      return "Pastor";
    case "care_team":
      return "Care team";
    case "finance":
      return "Finance";
    case "kids_director":
      return "Kids director";
    case "team_leader":
      return "Team leader";
    case "volunteer":
      return "Volunteer";
    case "member":
      return "Member";
    case "shop_owner":
      return "Shop owner";
    case "shop_manager":
      return "Shop manager";
    case "barista":
      return "Barista";
    case "customer":
      return "Customer";
    case "platform_operator":
      return "Platform operator";
    default:
      return assertNever(role);
  }
}

export const CHURCH = {
  name: "One Hope",
  legalNote: "One Hope Church, Richardson, Texas",
  addressLine: "1251 S. Sherman St., Ste. 112",
  city: "Richardson",
  region: "TX",
  postalCode: "75081",
  timeZone: "America/Chicago",
  serviceHour: 10,
  serviceMinute: 30,
  preServiceHour: 10,
  preServiceMinute: 0,
  youtubeHandle: "@Weareonehope",
  youtubeChannelId: "UCq2WteT5jNlWmXNofRMvQfw",
  facebook: "iamonehope",
  instagram: "iamonehope",
  leadPastors: ["Derek Miller", "Jen Miller"],
  mapsUrl:
    "https://maps.apple.com/?address=1251%20S.%20Sherman%20St.%20Ste.%20112%2C%20Richardson%2C%20TX%2075081",
} as const;

export const MODULES = [
  "discipleship",
  "serving",
  "worship",
  "kids",
  "communications",
  "facilities",
  "finance",
  "missions",
  "admin",
  "media",
  "groups",
  "events",
  "giving",
  "checkin",
  "prayer",
] as const;

export type ModuleId = (typeof MODULES)[number];

export function sameHousehold(actor: Actor, householdId: string | null): boolean {
  return actor.householdId !== null && actor.householdId === householdId;
}

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: string;
};

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const bag: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) bag[part.type] = part.value;
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour: Number(bag.hour),
    minute: Number(bag.minute),
    second: Number(bag.second),
    weekday: bag.weekday ?? "Sun",
  };
}

function offsetMinutes(instant: Date, timeZone: string): number {
  const parts = zonedParts(instant, timeZone);
  const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return Math.round((localAsUtc - instant.getTime()) / 60000);
}

export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  let utc = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 3; i += 1) {
    const off = offsetMinutes(new Date(utc), timeZone);
    utc = Date.UTC(year, month - 1, day, hour, minute, 0) - off * 60000;
  }
  return new Date(utc);
}

export function nextSundayService(
  now: Date,
  timeZone = CHURCH.timeZone,
): { preService: Date; service: Date } {
  const parts = zonedParts(now, timeZone);
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const idx = weekdays.indexOf(parts.weekday);
  let add = (7 - (idx < 0 ? 0 : idx)) % 7;
  const todayService = zonedTimeToUtc(
    parts.year,
    parts.month,
    parts.day,
    CHURCH.serviceHour,
    CHURCH.serviceMinute,
    timeZone,
  );
  if (add === 0 && now.getTime() > todayService.getTime()) add = 7;
  const civil = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + add));
  const year = civil.getUTCFullYear();
  const month = civil.getUTCMonth() + 1;
  const day = civil.getUTCDate();
  return {
    preService: zonedTimeToUtc(year, month, day, CHURCH.preServiceHour, CHURCH.preServiceMinute, timeZone),
    service: zonedTimeToUtc(year, month, day, CHURCH.serviceHour, CHURCH.serviceMinute, timeZone),
  };
}

export type PickupInput = {
  code: string;
  expectedCode: string;
  guardianAuthorized: boolean;
  custodyRestricted: boolean;
  adultsOnDuty: number;
};

export type PickupDecision = { allowed: boolean; reason: string };

/**
 * `countsTowardLockout` is true only when the security code was presented and
 * did not match. A short-staffed station, a custody block, or an unauthorized
 * adult is a refusal, not a wrong try.
 */
export type PickupVerdict = PickupDecision & { countsTowardLockout: boolean };

function codesMatch(left: string, right: string): boolean {
  const a = left.trim();
  const b = right.trim();
  const length = Math.max(a.length, b.length);
  let mismatch = a.length === b.length ? 0 : 1;
  for (let index = 0; index < length; index += 1) {
    mismatch |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}

function pickupRefusal(reason: string, countsTowardLockout = false): PickupVerdict {
  return { allowed: false, reason, countsTowardLockout };
}

export function evaluatePickup(input: PickupInput): PickupVerdict {
  if (input.adultsOnDuty < 2) {
    return pickupRefusal("Two adults from the kids team must be on duty at the station.");
  }
  if (!input.guardianAuthorized) return pickupRefusal("This adult is not an authorized guardian.");
  if (input.custodyRestricted) return pickupRefusal("A custody restriction blocks this pickup.");
  if (!input.expectedCode) return pickupRefusal("This child is not checked in.");
  if (!codesMatch(input.code, input.expectedCode)) {
    return pickupRefusal("Security code does not match.", true);
  }
  return {
    allowed: true,
    reason: "Guardian verified and the security code matches.",
    countsTowardLockout: false,
  };
}

export type Booking = { id: string; roomId: string; start: number; end: number };

export function findRoomConflict(
  existing: readonly Booking[],
  candidate: { roomId: string; start: number; end: number; ignoreId?: string },
): Booking | null {
  if (candidate.end <= candidate.start)
    throw new AccessError("invalid", "The booking end must be after the start.");
  return (
    existing.find(
      (booking) =>
        booking.roomId === candidate.roomId &&
        booking.id !== candidate.ignoreId &&
        booking.start < candidate.end &&
        candidate.start < booking.end,
    ) ?? null
  );
}

export type SchedulePerson = {
  personId: string;
  positionId: string;
  blockouts: { start: number; end: number }[];
};
export type ScheduleNeed = { positionId: string; count: number };

export function autoSchedule(
  needs: readonly ScheduleNeed[],
  people: readonly SchedulePerson[],
  serviceStart: number,
  serviceEnd: number,
): { positionId: string; personId: string }[] {
  const used = new Set<string>();
  const assigned: { positionId: string; personId: string }[] = [];
  for (const need of needs) {
    let filled = 0;
    for (const person of people) {
      if (filled >= need.count) break;
      if (person.positionId !== need.positionId) continue;
      const key = `${person.personId}:${need.positionId}`;
      if (used.has(key)) continue;
      const blocked = person.blockouts.some((block) => block.start < serviceEnd && serviceStart < block.end);
      if (blocked) continue;
      used.add(key);
      assigned.push({ positionId: need.positionId, personId: person.personId });
      filled += 1;
    }
  }
  return assigned;
}

const CARD_KEYS = new Set(["cardnumber", "pan", "cvc", "cvv", "card", "number"]);

function looksLikePan(value: string): boolean {
  const digits = value.replace(/[\s-]/g, "");
  return /^\d{13,19}$/.test(digits);
}

export function assertNoCardData(input: unknown): void {
  if (!input || typeof input !== "object") return;
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (CARD_KEYS.has(key.toLowerCase())) {
      throw new AccessError("invalid", "Card numbers stay at Stripe. This server does not accept them.");
    }
    if (typeof value === "string" && looksLikePan(value)) {
      throw new AccessError("invalid", "Card numbers stay at Stripe. This server does not accept them.");
    }
    if (value && typeof value === "object") assertNoCardData(value);
  }
}

export function canChargeLive(flags: {
  stripeSecretKey: string;
  givingLive: boolean;
  applePayNonprofitApproved: boolean;
}): boolean {
  return flags.stripeSecretKey.length > 0 && flags.givingLive && flags.applePayNonprofitApproved;
}

export type DirectoryPerson = {
  id: string;
  displayName: string;
  email: string;
  emailPublic: boolean;
  phone: string;
  phonePublic: boolean;
};

export function projectDirectory(viewerId: string, people: readonly DirectoryPerson[]): DirectoryPerson[] {
  return people.map((person) => {
    const self = person.id === viewerId;
    return {
      ...person,
      email: self || person.emailPublic ? person.email : "",
      phone: self || person.phonePublic ? person.phone : "",
    };
  });
}

export type ExpenseState = "draft" | "submitted" | "approved" | "denied";
export type ExpenseAction = "submit" | "approve" | "deny" | "reset";

export function transitionExpense(state: ExpenseState, action: ExpenseAction): ExpenseState {
  switch (state) {
    case "draft":
      if (action === "submit") return "submitted";
      break;
    case "submitted":
      if (action === "approve") return "approved";
      if (action === "deny") return "denied";
      break;
    case "approved":
    case "denied":
      if (action === "reset") return "draft";
      break;
    default:
      return assertNever(state);
  }
  throw new AccessError("invalid", `Cannot ${action} an expense that is ${state}.`);
}

export function eventToIcs(event: {
  id: string;
  title: string;
  start: Date;
  end: Date;
  location: string;
  description: string;
}): string {
  const stamp = (date: Date) =>
    date
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");
  const clean = (value: string) => value.replace(/[\r\n]+/g, " ");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//One Hope//Church//EN",
    "BEGIN:VEVENT",
    `UID:${event.id}@onehope.local`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(event.start)}`,
    `DTEND:${stamp(event.end)}`,
    `SUMMARY:${clean(event.title)}`,
    `LOCATION:${clean(event.location)}`,
    `DESCRIPTION:${clean(event.description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export type YoutubeVideo = {
  id: string;
  title: string;
  published: string;
  link: string;
  thumbnail: string | null;
  /** 1280x720 poster for the latest message. YouTube has none for some old videos, so clients fall back to `thumbnail`. */
  thumbnailHd: string;
  /** Full Sunday messages and clips are listed apart. */
  kind: "message" | "short";
};

function firstMatch(source: string, pattern: RegExp): string {
  return source.match(pattern)?.[1] ?? "";
}

export function parseYoutubeRss(xml: string): YoutubeVideo[] {
  return xml
    .split("<entry>")
    .slice(1)
    .map((entry) => {
      const id =
        firstMatch(entry, /<yt:videoId>([^<]+)<\/yt:videoId>/) ||
        firstMatch(entry, /<id>yt:video:([^<]+)<\/id>/);
      const rawTitle = decodeXml(firstMatch(entry, /<title>([^<]*)<\/title>/));
      const published = firstMatch(entry, /<published>([^<]+)<\/published>/);
      const link =
        firstMatch(entry, /<link[^>]*href="([^"]+)"/) || (id ? `https://www.youtube.com/watch?v=${id}` : "");
      const thumbnail = firstMatch(entry, /<media:thumbnail[^>]*url="([^"]+)"/) || null;
      const short = link.includes("/shorts/") || /#shorts\b/i.test(rawTitle);
      const title = rawTitle.replace(/\s*#shorts\b/gi, "").trim();
      const kind: YoutubeVideo["kind"] = short ? "short" : "message";
      return { id, title, published, link, thumbnail, thumbnailHd: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`, kind };
    })
    .filter((video) => video.id.length > 0);
}

function decodeXml(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

export function zebraLabel(childName: string, securityCode: string): string {
  const name = childName.replace(/[\^~]/g, "");
  const code = securityCode.replace(/\D/g, "").slice(0, 4);
  return [
    "^XA",
    "^FO30,30^A0N,28,28^FDOne Hope Kids^FS",
    `^FO30,70^A0N,42,42^FD${name}^FS`,
    `^FO30,130^A0N,32,32^FDCode ${code}^FS`,
    "^XZ",
  ].join("");
}

export function eligibleForRetention(createdAt: number, now: number, years: number): boolean {
  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - years);
  return createdAt < cutoff.getTime();
}

export const SAMPLE_FUNNEL = {
  sample: true as const,
  visitors: 40,
  members: 22,
  givers: 14,
  servers: 9,
};

export const RETENTION_YEARS = { audit: 7, giving: 7, care: 7, kids: 7 } as const;
