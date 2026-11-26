/**
 * Phase 2c: one-time spreadsheet import, duplicate pairs, and saved lists.
 * Pure rules only. ChurchStore applies them. Nothing here talks to Planning Center.
 */
import { createHash } from "node:crypto";

import { AccessError, isStaff, type Role } from "./domain";
import { isStage, type Stage } from "./people-care";

export const IMPORT_FIELDS = [
  "ignore",
  "first_name",
  "last_name",
  "full_name",
  "email",
  "phone",
  "stage",
  "tags",
  "source",
  "faith_steps",
  "owner",
  "last_seen",
  "last_contact",
  "note",
  "address",
  "birthday",
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

export const FIELD_LABELS: Record<ImportField, string> = {
  ignore: "Skip this column",
  first_name: "First name",
  last_name: "Last name",
  full_name: "Full name",
  email: "Email",
  phone: "Phone",
  stage: "Stage",
  tags: "Tags",
  source: "How they found us",
  faith_steps: "Faith steps",
  owner: "Who looks after them",
  last_seen: "Last seen",
  last_contact: "Last contact",
  note: "Note",
  address: "Address",
  birthday: "Birthday",
};

/** One of these can be chosen for only one column. Skip this column can repeat. */
const ONCE: ReadonlySet<ImportField> = new Set(
  IMPORT_FIELDS.filter((field) => field !== "ignore"),
);

export const SOURCES = [
  "plan_a_visit",
  "know_jesus",
  "connect_card",
  "staff_added",
  "import",
  "app_signup",
] as const;
export type ProfileSource = (typeof SOURCES)[number];

export const SOURCE_LABELS: Record<ProfileSource, string> = {
  plan_a_visit: "Plan a Visit",
  know_jesus: "Know Jesus",
  connect_card: "Connect card",
  staff_added: "Added by staff",
  import: "Imported",
  app_signup: "Signed up in the app",
};

export const FAITH_STEPS = ["salvation", "baptized", "growth_track", "serving"] as const;
export type FaithStep = (typeof FAITH_STEPS)[number];

export const FAITH_LABELS: Record<FaithStep, string> = {
  salvation: "Said yes to Jesus",
  baptized: "Baptized",
  growth_track: "Growth Track",
  serving: "Serving",
};

/** Windows for "last seen" and "last contact". Empty means any time. */
export const CONTACT_WINDOWS = ["", "within7", "within30", "older30", "older60"] as const;
export type ContactWindow = (typeof CONTACT_WINDOWS)[number];

export const WINDOW_LABELS: Record<ContactWindow, string> = {
  "": "Any time",
  within7: "In the last 7 days",
  within30: "In the last 30 days",
  older30: "Not in 30 days",
  older60: "Not in 60 days",
};

export const BATCH_ROWS = 200;
export const MAX_IMPORT_ROWS = 20_000;
export const IMPORT_UNDO_MS = 24 * 60 * 60 * 1000;
export const MERGE_UNDO_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_COLUMNS = 40;

export type MappedRow = {
  line: number;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  stage: Stage | null;
  tags: string[];
  source: ProfileSource | null;
  faithSteps: FaithStep[];
  ownerEmail: string;
  lastSeenAt: number | null;
  lastContactAt: number | null;
  note: string;
  address: string;
  birthday: string;
};

export type KnownPerson = {
  id: string;
  displayName: string;
  email: string;
  phone: string;
  role: Role;
  deleted: boolean;
};

export type PlanAdd = {
  kind: "add";
  line: number;
  key: string;
  name: string;
  flag: string;
  row: MappedRow;
};

export type PlanUpdate = {
  kind: "update";
  line: number;
  key: string;
  /** Set when the match is someone already in the church. Empty when the match was added earlier in this file. */
  personId: string;
  name: string;
  flag: string;
  row: MappedRow;
};

export type PlanSkip = { kind: "skip"; line: number; why: string };

export type PlanItem = PlanAdd | PlanUpdate | PlanSkip;

export type ListFilters = {
  stage: string;
  tagIds: string[];
  faithSteps: string[];
  seen: string;
  contact: string;
  source: string;
  ownerId: string;
  /** "" any, "open" has a task, "none" has no open task. */
  task: string;
  quiet: boolean;
};

export function emptyFilters(): ListFilters {
  return {
    stage: "",
    tagIds: [],
    faithSteps: [],
    seen: "",
    contact: "",
    source: "",
    ownerId: "",
    task: "",
    quiet: false,
  };
}

export function isImportField(value: string): value is ImportField {
  return (IMPORT_FIELDS as readonly string[]).includes(value);
}

export function isProfileSource(value: string): value is ProfileSource {
  return (SOURCES as readonly string[]).includes(value);
}

export function isFaithStep(value: string): value is FaithStep {
  return (FAITH_STEPS as readonly string[]).includes(value);
}

export function isContactWindow(value: string): value is ContactWindow {
  return (CONTACT_WINDOWS as readonly string[]).includes(value);
}

export function headerKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_./]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** A Planning Center People export, recognized by its column names. This is a file, not a connection. */
export function looksLikePlanningCenter(headers: readonly string[]): boolean {
  const keys = new Set(headers.map(headerKey));
  return (
    keys.has("person id") ||
    keys.has("remote id") ||
    keys.has("primary email") ||
    keys.has("primary phone number")
  );
}

function fieldForHeader(key: string): ImportField {
  if (!key) return "ignore";
  if (key === "person id" || key === "remote id" || key === "household id" || key === "household") return "ignore";
  if (key === "first name" || key === "given name" || key === "firstname") return "first_name";
  if (key === "last name" || key === "surname" || key === "family name" || key === "lastname") return "last_name";
  if (key === "full name" || key === "display name" || key === "name") return "full_name";
  if (key.includes("email")) return "email";
  if (key.includes("phone") || key.includes("mobile") || key === "cell" || key.includes("cell phone")) return "phone";
  if (key.includes("membership") || key === "stage") return "stage";
  if (key === "status") return "stage";
  if (key === "tags" || key === "tag" || key === "labels" || key === "label") return "tags";
  if (key.includes("faith") || key === "baptized" || key === "baptism" || key === "salvation") return "faith_steps";
  if (key === "source" || key.includes("how they heard") || key.includes("how heard")) return "source";
  if (key === "owner" || key.includes("assigned")) return "owner";
  if (key.includes("last seen") || key.includes("last attended") || key.includes("last visit")) return "last_seen";
  if (key.includes("last contact")) return "last_contact";
  if (key === "note" || key === "notes" || key === "comments" || key === "comment") return "note";
  if (key === "address" || key.includes("street")) return "address";
  if (key === "birthday" || key === "birthdate" || key === "date of birth") return "birthday";
  return "ignore";
}

/** Best guess for each column, in plain words. The same fact is used only once; later copies are skipped. */
export function suggestMapping(headers: readonly string[]): ImportField[] {
  const used = new Set<ImportField>();
  return headers.map((header) => {
    const field = fieldForHeader(headerKey(header));
    if (field !== "ignore" && used.has(field)) return "ignore";
    if (ONCE.has(field)) used.add(field);
    return field;
  });
}

export function cleanMapping(headers: readonly string[], chosen: readonly string[]): ImportField[] {
  if (chosen.length !== headers.length) {
    throw new AccessError("invalid", "Match every column, including the ones you want to skip.");
  }
  const mapping: ImportField[] = [];
  const used = new Set<ImportField>();
  for (const value of chosen) {
    if (!isImportField(value)) throw new AccessError("invalid", "Pick each column from the list.");
    if (value !== "ignore" && used.has(value)) {
      throw new AccessError("invalid", `Use ${FIELD_LABELS[value].toLowerCase()} on only one column.`);
    }
    if (ONCE.has(value)) used.add(value);
    mapping.push(value);
  }
  const hasName = mapping.some((field) => field === "full_name" || field === "first_name" || field === "last_name");
  if (!hasName) throw new AccessError("invalid", "Match a name column so we know who each row is.");
  return mapping;
}

export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const cleaned = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (cleaned.length > 2_000_000) {
    throw new AccessError("invalid", "That file is too big. Split it and import one part at a time.");
  }
  const table = parseTable(cleaned);
  const headerRow = table[0];
  if (!headerRow || headerRow.every((cell) => cell.trim() === "")) {
    throw new AccessError("invalid", "This file has no column names. Put them in the first row.");
  }
  if (headerRow.length > MAX_COLUMNS) {
    throw new AccessError("invalid", `Use ${MAX_COLUMNS} columns or fewer.`);
  }
  const headers = headerRow.map((cell) => cell.trim().slice(0, 80));
  const rows: string[][] = [];
  for (const raw of table.slice(1)) {
    if (raw.every((cell) => cell.trim() === "")) continue;
    const cells = raw.map((cell) => cell.trim().slice(0, 2000));
    while (cells.length < headers.length) cells.push("");
    rows.push(cells.slice(0, headers.length));
    if (rows.length > MAX_IMPORT_ROWS) {
      throw new AccessError("invalid", `Import up to ${MAX_IMPORT_ROWS.toLocaleString("en-US")} people at a time.`);
    }
  }
  if (rows.length === 0) {
    throw new AccessError("invalid", "This file has column names but no people. Add a row under the names.");
  }
  return { headers, rows };
}

function parseTable(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quotes = false;
      } else cell += char;
      continue;
    }
    if (char === '"') {
      quotes = true;
      continue;
    }
    if (char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

export function hashImport(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  const hash = createHash("sha256");
  hash.update(headers.join("\u001f"));
  hash.update("\n");
  for (const row of rows) hash.update(`${row.join("\u001f")}\n`);
  return hash.digest("hex");
}

export function chunkRows<T>(rows: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) chunks.push(rows.slice(i, i + size));
  return chunks;
}

export function mapCells(cells: readonly string[], mapping: readonly ImportField[], line: number): MappedRow {
  const take = (field: ImportField) => {
    const index = mapping.indexOf(field);
    return index >= 0 ? (cells[index] ?? "").trim() : "";
  };
  const faithRaw = take("faith_steps");
  return {
    line,
    firstName: take("first_name"),
    lastName: take("last_name"),
    fullName: take("full_name"),
    email: take("email").toLowerCase(),
    phone: take("phone"),
    stage: parseStage(take("stage")),
    tags: splitList(take("tags")),
    source: parseSource(take("source")),
    faithSteps: parseFaithSteps(faithRaw),
    ownerEmail: take("owner").toLowerCase(),
    lastSeenAt: parseWhen(take("last_seen")),
    lastContactAt: parseWhen(take("last_contact")),
    note: take("note"),
    address: take("address"),
    birthday: take("birthday"),
  };
}

export function displayNameOf(row: MappedRow): string {
  const full = row.fullName.replace(/\s+/g, " ").trim();
  const built = full || `${row.firstName} ${row.lastName}`.replace(/\s+/g, " ").trim();
  return built.slice(0, 80);
}

export function parseStage(value: string): Stage | null {
  const key = headerKey(value);
  if (!key) return null;
  if (isStage(key)) return key;
  if (key === "visitor" || key === "first time" || key === "new") return "guest";
  if (key === "coming back") return "returning";
  if (key === "regular") return "connected";
  if (key === "membership") return "member";
  if (key === "volunteer") return "serving";
  if (key === "leader") return "leading";
  return null;
}

export function parseSource(value: string): ProfileSource | null {
  const key = headerKey(value);
  if (!key) return null;
  if (isProfileSource(key)) return key;
  if (key.includes("plan a visit") || key === "visit") return "plan_a_visit";
  if (key.includes("know jesus") || key === "salvation") return "know_jesus";
  if (key.includes("connect")) return "connect_card";
  if (key.includes("import") || key.includes("planning center") || key === "pco") return "import";
  if (key.includes("staff") || key === "added") return "staff_added";
  if (key.includes("app") || key === "signup") return "app_signup";
  return null;
}

export function parseFaithSteps(value: string): FaithStep[] {
  const found = new Set<FaithStep>();
  for (const part of splitList(value)) {
    const key = headerKey(part);
    if (!key || key === "yes" || key === "true" || key === "y") continue;
    if (isFaithStep(key)) found.add(key);
    else if (key.includes("salvation") || key.includes("said yes") || key === "saved") found.add("salvation");
    else if (key.includes("bapt")) found.add("baptized");
    else if (key.includes("growth")) found.add("growth_track");
    else if (key.includes("serv")) found.add("serving");
  }
  return FAITH_STEPS.filter((step) => found.has(step));
}

export function parseWhen(value: string): number | null {
  const text = value.trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const parsed = Date.parse(text.length <= 10 ? `${text}T12:00:00Z` : text);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (!match) return null;
  const parsed = Date.parse(
    `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}T12:00:00Z`,
  );
  return Number.isFinite(parsed) ? parsed : null;
}

function splitList(value: string): string[] {
  return value
    .split(/[;,|]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase();
  return email.includes("@") ? email : "";
}

/** Last 10 digits, so (214) 555-0100 and 2145550100 match. Shorter numbers are ignored. */
export function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return local.length >= 10 ? local.slice(-10) : "";
}

export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type Indexed = {
  key: string;
  personId: string;
  name: string;
  email: string;
  phone: string;
  nameKey: string;
};

export function planImport(rows: readonly MappedRow[], existing: readonly KnownPerson[]): PlanItem[] {
  const emailAt = new Map<string, Indexed>();
  const phoneAt = new Map<string, Indexed>();
  const nameAt = new Map<string, Indexed>();
  for (const person of existing) {
    if (person.deleted) continue;
    const entry: Indexed = {
      key: person.id,
      personId: person.id,
      name: person.displayName,
      email: normalizeEmail(person.email),
      phone: normalizePhone(person.phone),
      nameKey: normalizeName(person.displayName),
    };
    if (entry.email && !emailAt.has(entry.email)) emailAt.set(entry.email, entry);
    if (entry.phone && !phoneAt.has(entry.phone)) phoneAt.set(entry.phone, entry);
    if (entry.nameKey.length >= 3 && !nameAt.has(entry.nameKey)) nameAt.set(entry.nameKey, entry);
  }
  const items: PlanItem[] = [];
  for (const row of rows) {
    const name = displayNameOf(row);
    if (!name) {
      items.push({ kind: "skip", line: row.line, why: "No name" });
      continue;
    }
    if (normalizeName(name) === "former member") {
      items.push({ kind: "skip", line: row.line, why: "That name is reserved" });
      continue;
    }
    const email = normalizeEmail(row.email);
    const phone = normalizePhone(row.phone);
    const byEmail = email ? emailAt.get(email) : undefined;
    const byPhone = phone ? phoneAt.get(phone) : undefined;
    let match: Indexed | undefined = byEmail;
    if (!match && byPhone) {
      const otherEmail = byPhone.email;
      if (!otherEmail || !email || otherEmail === email) match = byPhone;
    }
    const nameKey = normalizeName(name);
    const flag = flagFor(byEmail, byPhone, nameKey.length >= 3 ? nameAt.get(nameKey) : undefined);
    if (match && match.personId && isStaff(roleOf(existing, match.personId))) {
      items.push({ kind: "skip", line: row.line, why: "Staff seats stay as they are" });
      continue;
    }
    if (match) {
      items.push({
        kind: "update",
        line: row.line,
        key: match.key,
        personId: match.personId,
        name: match.name,
        flag,
        row,
      });
      if (email && !match.email) {
        match.email = email;
        emailAt.set(email, match);
      }
      if (phone && !match.phone) {
        match.phone = phone;
        phoneAt.set(phone, match);
      }
      continue;
    }
    const key = `file:${row.line}`;
    const created: Indexed = { key, personId: "", name, email, phone, nameKey };
    if (email) emailAt.set(email, created);
    if (phone && !phoneAt.has(phone)) phoneAt.set(phone, created);
    if (nameKey.length >= 3 && !nameAt.has(nameKey)) nameAt.set(nameKey, created);
    items.push({ kind: "add", line: row.line, key, name, flag, row });
  }
  return items;
}

function roleOf(existing: readonly KnownPerson[], id: string): Role {
  return existing.find((person) => person.id === id)?.role ?? "member";
}

function flagFor(byEmail: Indexed | undefined, byPhone: Indexed | undefined, byName: Indexed | undefined): string {
  if (byEmail) return `Possible duplicate: same email as ${byEmail.name}`;
  if (byPhone) return `Possible duplicate: same phone as ${byPhone.name}`;
  if (byName) return `Possible duplicate: same name as ${byName.name}`;
  return "";
}

export type PairWhy = "email" | "phone" | "name";

export type DuplicatePair = {
  leftId: string;
  rightId: string;
  why: PairWhy;
};

/** Pairs that look like the same person. Same name is not enough when both email and phone differ. */
export function findDuplicatePairs(
  people: readonly KnownPerson[],
  blocked: readonly { leftId: string; rightId: string }[],
): DuplicatePair[] {
  const live = people.filter((person) => !person.deleted);
  const block = new Set(blocked.map((pair) => pairKey(pair.leftId, pair.rightId)));
  const seen = new Set<string>();
  const pairs: DuplicatePair[] = [];
  const add = (left: KnownPerson, right: KnownPerson, why: PairWhy) => {
    if (left.id === right.id) return;
    const key = pairKey(left.id, right.id);
    if (block.has(key) || seen.has(key)) return;
    seen.add(key);
    const [leftId, rightId] = left.displayName.localeCompare(right.displayName) <= 0
      ? [left.id, right.id]
      : [right.id, left.id];
    pairs.push({ leftId, rightId, why });
  };
  const byEmail = groupBy(live, (person) => normalizeEmail(person.email));
  const byPhone = groupBy(live, (person) => normalizePhone(person.phone));
  for (const group of byEmail.values()) combine(group, (left, right) => add(left, right, "email"));
  for (const group of byPhone.values()) combine(group, (left, right) => add(left, right, "phone"));
  const byName = groupBy(live, (person) => {
    const name = normalizeName(person.displayName);
    return name.length >= 3 ? name : "";
  });
  for (const group of byName.values()) {
    combine(group, (left, right) => {
      const leftEmail = normalizeEmail(left.email);
      const rightEmail = normalizeEmail(right.email);
      const leftPhone = normalizePhone(left.phone);
      const rightPhone = normalizePhone(right.phone);
      const emailsDiffer = Boolean(leftEmail && rightEmail && leftEmail !== rightEmail);
      const phonesDiffer = Boolean(leftPhone && rightPhone && leftPhone !== rightPhone);
      if (emailsDiffer && phonesDiffer) return;
      if (leftEmail && rightEmail && leftEmail === rightEmail) return;
      if (leftPhone && rightPhone && leftPhone === rightPhone) return;
      add(left, right, "name");
    });
  }
  return pairs.slice(0, 80);
}

function pairKey(left: string, right: string): string {
  return left < right ? `${left}|${right}` : `${right}|${left}`;
}

function groupBy(people: readonly KnownPerson[], keyOf: (person: KnownPerson) => string): Map<string, KnownPerson[]> {
  const groups = new Map<string, KnownPerson[]>();
  for (const person of people) {
    const key = keyOf(person);
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(person);
    groups.set(key, list);
  }
  return groups;
}

function combine(group: KnownPerson[], visit: (left: KnownPerson, right: KnownPerson) => void) {
  const slice = group.slice(0, 6);
  for (let i = 0; i < slice.length; i += 1) {
    for (let j = i + 1; j < slice.length; j += 1) {
      const left = slice[i];
      const right = slice[j];
      if (left && right) visit(left, right);
    }
  }
}

export function whyLabel(why: PairWhy): string {
  switch (why) {
    case "email":
      return "Same email";
    case "phone":
      return "Same phone";
    case "name":
      return "Same name";
    default:
      return assertNever(why);
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function inContactWindow(at: number | null, window: string, now: number): boolean {
  if (!window) return true;
  if (!isContactWindow(window)) return true;
  if (window === "within7") return at !== null && now - at <= 7 * DAY_MS;
  if (window === "within30") return at !== null && now - at <= 30 * DAY_MS;
  if (window === "older30") return at === null || now - at > 30 * DAY_MS;
  if (window === "older60") return at === null || now - at > 60 * DAY_MS;
  return true;
}

export function matchesList(
  filters: ListFilters,
  person: {
    stage: string;
    tagIds: readonly string[];
    faithSteps: readonly string[];
    lastSeenAt: number | null;
    lastContactAt: number | null;
    source: string;
    ownerId: string;
    openTasks: number;
    quiet: boolean;
  },
  now: number,
): boolean {
  if (filters.stage && person.stage !== filters.stage) return false;
  if (filters.tagIds.some((id) => !person.tagIds.includes(id))) return false;
  if (filters.faithSteps.some((step) => !person.faithSteps.includes(step))) return false;
  if (!inContactWindow(person.lastSeenAt, filters.seen, now)) return false;
  if (!inContactWindow(person.lastContactAt, filters.contact, now)) return false;
  if (filters.source && person.source !== filters.source) return false;
  if (filters.ownerId && person.ownerId !== filters.ownerId) return false;
  if (filters.task === "open" && person.openTasks < 1) return false;
  if (filters.task === "none" && person.openTasks > 0) return false;
  if (filters.quiet && !person.quiet) return false;
  return true;
}

export function cleanFilters(input: Partial<ListFilters>): ListFilters {
  const filters = emptyFilters();
  filters.stage = input.stage && isStage(input.stage) ? input.stage : "";
  filters.tagIds = [...new Set((input.tagIds ?? []).filter(Boolean))].slice(0, 12);
  filters.faithSteps = [...new Set((input.faithSteps ?? []).filter(isFaithStep))];
  filters.seen = input.seen && isContactWindow(input.seen) ? input.seen : "";
  filters.contact = input.contact && isContactWindow(input.contact) ? input.contact : "";
  filters.source = input.source && isProfileSource(input.source) ? input.source : "";
  filters.ownerId = (input.ownerId ?? "").trim().slice(0, 80);
  filters.task = input.task === "open" || input.task === "none" ? input.task : "";
  filters.quiet = input.quiet === true;
  return filters;
}

export function filtersAreNarrow(filters: ListFilters): boolean {
  return Boolean(
    filters.stage ||
      filters.tagIds.length ||
      filters.faithSteps.length ||
      filters.seen ||
      filters.contact ||
      filters.source ||
      filters.ownerId ||
      filters.task ||
      filters.quiet,
  );
}

function assertNever(value: never): never {
  throw new Error(`Unhandled variant: ${JSON.stringify(value)}`);
}
