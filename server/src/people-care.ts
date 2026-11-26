/**
 * Phase 2a: the people and care foundation. Plain types and rules only; ChurchStore holds the rows.
 *
 * A "stage" is where someone is on the path (guest to leading). A "touch" is one call, text, visit,
 * prayer or note. Tags group people; a team tag also names the leaders who can see that team.
 */
import type { Role } from "./domain";

export const STAGES = ["guest", "returning", "connected", "member", "serving", "leading"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  guest: "Guest",
  returning: "Coming back",
  connected: "Connected",
  member: "Member",
  serving: "Serving",
  leading: "Leading",
};

export const TOUCH_KINDS = ["call", "text", "visit", "email", "card", "prayer", "note"] as const;
export type TouchKind = (typeof TOUCH_KINDS)[number];

export const TOUCH_LABELS: Record<TouchKind, string> = {
  call: "Called",
  text: "Texted",
  visit: "Visited",
  email: "Emailed",
  card: "Sent a card",
  prayer: "Prayed with",
  note: "Note",
};

export const TOUCH_OUTCOMES = [
  "reached",
  "left_message",
  "no_answer",
  "prayed",
  "needs_follow_up",
  "asked_not_to_contact",
] as const;
export type TouchOutcome = (typeof TOUCH_OUTCOMES)[number];

export const OUTCOME_LABELS: Record<TouchOutcome, string> = {
  reached: "Talked with them",
  left_message: "Left a message",
  no_answer: "No answer",
  prayed: "Prayed together",
  needs_follow_up: "Needs a follow-up",
  asked_not_to_contact: "Asked us not to contact them",
};

export const TAG_KINDS = ["team", "ministry", "custom"] as const;
export type TagKind = (typeof TAG_KINDS)[number];

/** Days without a touch before someone shows as "quiet" on the People list. */
export const QUIET_AFTER_DAYS = 30;
export const NOTE_LIMIT = 2000;
export const TAG_NAME_LIMIT = 40;
/** Touches shown per page on a person's timeline. */
export const TOUCH_PAGE = 50;

export type PersonProfileRow = {
  /** Same as personId: one profile per person. */
  id: string;
  personId: string;
  stage: Stage;
  lastContactAt: number | null;
  doNotContact: boolean;
  updatedAt: number;
  updatedBy: string;
};

export type TagRow = {
  id: string;
  name: string;
  kind: TagKind;
  /** People who lead this team. Only meaningful on team tags. */
  leaderIds: string[];
  archived: boolean;
  createdAt: number;
  createdBy: string;
};

export type PersonTagRow = {
  /** `${personId}:${tagId}` so the pair is unique. */
  id: string;
  personId: string;
  tagId: string;
  addedBy: string;
  addedAt: number;
};

export type TouchRow = {
  id: string;
  personId: string;
  kind: TouchKind;
  outcome: TouchOutcome;
  /** Encrypted `{ note }`; empty string when there is no note. */
  noteCiphertext: string;
  byId: string;
  at: number;
};

export function isStage(value: unknown): value is Stage {
  return typeof value === "string" && (STAGES as readonly string[]).includes(value);
}

export function isTouchKind(value: unknown): value is TouchKind {
  return typeof value === "string" && (TOUCH_KINDS as readonly string[]).includes(value);
}

export function isTouchOutcome(value: unknown): value is TouchOutcome {
  return typeof value === "string" && (TOUCH_OUTCOMES as readonly string[]).includes(value);
}

export function isTagKind(value: unknown): value is TagKind {
  return typeof value === "string" && (TAG_KINDS as readonly string[]).includes(value);
}

/** Roles that belong to the church, so they show up on People. Shop and platform seats do not. */
const CHURCH_ROLES: ReadonlySet<Role> = new Set([
  "master_admin",
  "pastor",
  "care_team",
  "finance",
  "kids_director",
  "team_leader",
  "volunteer",
  "member",
]);

export function isChurchRole(role: Role): boolean {
  return CHURCH_ROLES.has(role);
}

/** Who sees every person on People. Kids directors and team leaders see a slice. */
export function seesEveryone(role: Role): boolean {
  return role === "master_admin" || role === "pastor" || role === "care_team";
}

/** A sensible starting stage before anyone sets one. */
export function defaultStage(role: Role, claimed: boolean): Stage {
  if (role === "volunteer") return "serving";
  if (role === "team_leader" || role === "care_team" || role === "kids_director" || role === "finance")
    return "leading";
  if (role === "pastor" || role === "master_admin") return "leading";
  return claimed ? "connected" : "guest";
}

/** A touch that reaches the person (not a private note) counts as contact. */
export function countsAsContact(kind: TouchKind): boolean {
  return kind !== "note";
}

/** Reaching out is blocked after someone asks us to stop; praying and private notes are not. */
export function reachesOut(kind: TouchKind): boolean {
  return kind === "call" || kind === "text" || kind === "visit" || kind === "email" || kind === "card";
}

export function isQuiet(lastContactAt: number | null, now: number): boolean {
  if (lastContactAt === null) return true;
  return now - lastContactAt > QUIET_AFTER_DAYS * 24 * 60 * 60 * 1000;
}

export function cleanTagName(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, TAG_NAME_LIMIT);
}

export function personTagId(personId: string, tagId: string): string {
  return `${personId}:${tagId}`;
}
