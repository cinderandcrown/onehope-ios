import { decryptString, encryptString } from "./crypto";
import { MODULES, type ModuleId } from "./domain";
import type { SqlClient } from "./migrate";
import type { StoreDocument } from "./store";

export class WriteConflictError extends Error {
  constructor(table: string) {
    super(`Write conflict on ${table}. Reload and try again.`);
    this.name = "WriteConflictError";
  }
}

const versions = new WeakMap<StoreDocument, Map<string, number>>();

export function rowVersions(doc: StoreDocument): Map<string, number> {
  let map = versions.get(doc);
  if (!map) {
    map = new Map();
    versions.set(doc, map);
  }
  return map;
}

export type LoadOptions = {
  includeAudit?: boolean;
  /** Load every session. Request paths pass sessionToken instead. */
  allSessions?: boolean;
  sessionToken?: string | null;
  platformKey?: Buffer | null;
  /** When set, only these tables are read. Omit it to read every table. */
  tables?: readonly string[];
  /** Read every touch (snapshots and exports). Requests read the recent window plus one person's page. */
  allTouches?: boolean;
  /** One page of one person's timeline, newest first, older than `before` (ms) when set. */
  touchPage?: { personId: string; before?: number | null } | null;
};

/** Touches a normal request reads across the whole church: the newest ones. */
export const RECENT_TOUCHES = 500;
/** Rows read for one person's timeline page. One extra tells the page there is more. */
export const PERSON_TOUCH_ROWS = 51;

export type SaveOptions = {
  syncModules: boolean;
  platformKey?: Buffer | null;
  /** Import path: do not delete rows that exist only in the tables. */
  retainExtras?: boolean;
  /** When set, only these tables are written. audit_log is always included. */
  onlyTables?: readonly string[];
};

type Row = Record<string, unknown>;

type SyncSpec = {
  table: string;
  conflict: string;
  columns: readonly string[];
  appendOnly?: boolean;
  rows: (doc: StoreDocument) => Row[];
  values: (row: Row, ctx: SaveContext) => unknown[];
  identity: (row: Row) => { column: string; value: unknown }[];
  assign: (doc: StoreDocument, rows: Row[]) => void;
};

type SaveContext = { platformKey: Buffer | null };

const IDENT = /^[a-z_]+$/;

function assertIdent(value: string): string {
  if (!IDENT.test(value)) throw new Error(`Rejected SQL name ${value}.`);
  return value;
}

export function emptyDocument(): StoreDocument {
  const flags = Object.fromEntries(MODULES.map((id) => [id, false])) as Record<ModuleId, boolean>;
  return {
    version: 1,
    people: [],
    gifts: [],
    children: [],
    sessions: [],
    auditLog: [],
    alerts: [],
    proposals: [],
    secrets: [],
    station: [],
    flags,
    groups: [],
    messages: [],
    events: [],
    registrations: [],
    announcements: [],
    prayers: [],
    notes: [],
    checks: [],
    schedule: [],
    volunteers: [],
    rooms: [],
    bookings: [],
    expenses: [],
    pathways: [],
    visitors: [],
    requests: [],
    drafts: [],
    invites: [],
    followUps: [],
    streaks: [],
    throttle: [],
    amens: [],
    myFive: [],
    testimonies: [],
    milestones: [],
    outreach: [],
    outreachRsvps: [],
    coffeeOrders: [],
    social: [],
    kidsTeam: [],
    profiles: [],
    tags: [],
    personTags: [],
    touches: [],
    playbooks: [],
    careTasks: [],
    featuredMessage: null,
  };
}

/** Postgres 42P01. The Neon driver and node-postgres both set `code` on the error. */
export function isMissingRelation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "42P01");
}

const OPTIONAL_TABLES = new Set([
  "featured_messages",
  "kids_team",
  "person_profiles",
  "tags",
  "person_tags",
  "interactions",
  "care_playbooks",
  "care_tasks",
]);

function epoch(row: Row, key: string): string | null {
  const value = row[key];
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? new Date(value).toISOString() : null;
}

/** A missing new table must not abort the request transaction. */
async function relationReady(sql: SqlClient, table: string): Promise<boolean> {
  if (!OPTIONAL_TABLES.has(table)) return true;
  const found = await sql.query<{ ok: string | null }>("SELECT to_regclass($1) AS ok", [table]);
  return Boolean(found.rows[0]?.ok);
}

export function stable(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as object).sort()) {
      const field = (value as Record<string, unknown>)[key];
      if (field !== undefined) out[key] = canonicalize(field);
    }
    return out;
  }
  return value;
}

function objects(value: unknown): Row[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Row => Boolean(item) && typeof item === "object");
}

function text(row: Row, key: string): string | null {
  const value = row[key];
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

function required(row: Row, key: string): string {
  const value = row[key];
  return value === null || value === undefined ? "" : String(value);
}

function bool(row: Row, key: string): boolean {
  return row[key] === true;
}

function recordColumn(row: Row): string {
  return JSON.stringify(canonicalize(row));
}

function secretFree(row: Row): string {
  const copy = { ...row };
  delete copy.passwordHash;
  delete copy.totpSecret;
  return JSON.stringify(canonicalize(copy));
}

function idKey(row: Row): { column: string; value: unknown }[] {
  return [{ column: "id", value: required(row, "id") }];
}

function recordSpec(
  table: string,
  read: (doc: StoreDocument) => unknown,
  assign: (doc: StoreDocument, rows: Row[]) => void,
  extraColumns: readonly string[] = [],
  extraValues: (row: Row) => unknown[] = () => [],
  conflict = "tenant_id, id",
): SyncSpec {
  return {
    table,
    conflict,
    columns: ["tenant_id", "id", ...extraColumns, "record"],
    rows: (doc) => objects(read(doc)),
    values: (row) => [required(row, "id"), ...extraValues(row), recordColumn(row)],
    identity: idKey,
    assign,
  };
}

function assignArray(key: keyof StoreDocument): (doc: StoreDocument, rows: Row[]) => void {
  return (doc, rows) => {
    (doc as unknown as Record<string, unknown>)[key] = rows;
  };
}

const SPECS: readonly SyncSpec[] = [
  {
    table: "people",
    conflict: "id",
    columns: [
      "tenant_id",
      "id",
      "household_id",
      "role",
      "display_name",
      "email",
      "email_public",
      "phone",
      "phone_public",
      "password_hash",
      "totp_secret",
      "listed_in_directory",
      "deleted",
      "last_ip",
      "last_user_agent",
      "sample",
      "record",
    ],
    rows: (doc) => objects(doc.people),
    values: (row, ctx) => [
      required(row, "id"),
      text(row, "householdId"),
      required(row, "role"),
      required(row, "displayName"),
      text(row, "email"),
      bool(row, "emailPublic"),
      text(row, "phone"),
      bool(row, "phonePublic"),
      null,
      ctx.platformKey && text(row, "totpSecret")
        ? encryptString(String(row.totpSecret), ctx.platformKey)
        : null,
      bool(row, "listedInDirectory"),
      bool(row, "deleted"),
      text(row, "lastIp"),
      text(row, "lastUserAgent"),
      bool(row, "sample"),
      secretFree(row),
    ],
    identity: idKey,
    assign: assignArray("people"),
  },
  {
    table: "gifts",
    conflict: "id",
    columns: ["tenant_id", "id", "household_id", "person_id", "amount_ciphertext", "sample", "record"],
    rows: (doc) => objects(doc.gifts),
    values: (row) => [
      required(row, "id"),
      required(row, "householdId"),
      required(row, "personId"),
      required(row, "ciphertext"),
      bool(row, "sample"),
      recordColumn(row),
    ],
    identity: idKey,
    assign: assignArray("gifts"),
  },
  {
    table: "kids",
    conflict: "id",
    columns: ["tenant_id", "id", "household_id", "display_name", "medical_ciphertext", "restricted", "record"],
    rows: (doc) => objects(doc.children),
    values: (row) => [
      required(row, "id"),
      required(row, "householdId"),
      required(row, "displayName"),
      required(row, "ciphertext"),
      Array.isArray(row.restrictedPersonIds) && row.restrictedPersonIds.length > 0,
      recordColumn(row),
    ],
    identity: idKey,
    assign: assignArray("children"),
  },
  {
    table: "care_notes",
    conflict: "id",
    columns: ["tenant_id", "id", "subject_person_id", "body_ciphertext", "author_id", "sample", "record"],
    rows: (doc) => objects(doc.notes),
    values: (row) => [
      required(row, "id"),
      required(row, "subjectPersonId"),
      required(row, "ciphertext"),
      text(row, "authorId"),
      bool(row, "sample"),
      recordColumn(row),
    ],
    identity: idKey,
    assign: assignArray("notes"),
  },
  {
    table: "prayers",
    conflict: "id",
    columns: ["tenant_id", "id", "author_id", "body", "visibility", "approved", "sample", "record"],
    rows: (doc) => objects(doc.prayers),
    values: (row) => [
      required(row, "id"),
      required(row, "authorId"),
      required(row, "body"),
      required(row, "visibility"),
      bool(row, "approved"),
      bool(row, "sample"),
      recordColumn(row),
    ],
    identity: idKey,
    assign: assignArray("prayers"),
  },
  {
    table: "background_checks",
    conflict: "id",
    columns: ["tenant_id", "id", "person_id", "status", "notes_ciphertext", "sample", "record"],
    rows: (doc) => objects(doc.checks),
    values: (row) => [
      `bg:${required(row, "personId")}`,
      required(row, "personId"),
      required(row, "status"),
      required(row, "ciphertext"),
      bool(row, "sample"),
      recordColumn(row),
    ],
    identity: (row) => [{ column: "id", value: `bg:${required(row, "personId")}` }],
    assign: assignArray("checks"),
  },
  {
    table: "audit_log",
    conflict: "id",
    appendOnly: true,
    columns: ["tenant_id", "id", "actor_id", "action", "resource", "resource_id", "tier", "at_ms", "source", "record"],
    rows: (doc) => objects(doc.auditLog),
    values: (row) => [
      required(row, "id"),
      required(row, "actorId"),
      required(row, "action"),
      required(row, "resource"),
      text(row, "resourceId"),
      Number(row.tier ?? 0),
      required(row, "at"),
      "app",
      recordColumn(row),
    ],
    identity: idKey,
    assign: assignArray("auditLog"),
  },
  {
    table: "sessions",
    conflict: "token",
    columns: ["tenant_id", "token", "person_id", "record"],
    rows: (doc) => objects(doc.sessions),
    values: (row) => [required(row, "token"), required(row, "personId"), recordColumn(row)],
    identity: (row) => [{ column: "token", value: required(row, "token") }],
    assign: assignArray("sessions"),
  },
  recordSpec("alerts", (doc) => doc.alerts, assignArray("alerts"), ["person_id"], (row) => [text(row, "personId")]),
  recordSpec("proposals", (doc) => doc.proposals, assignArray("proposals")),
  recordSpec("groups", (doc) => doc.groups, assignArray("groups")),
  recordSpec(
    "group_messages",
    (doc) => doc.messages,
    assignArray("messages"),
    ["group_id", "author_id"],
    (row) => [text(row, "groupId"), text(row, "authorId")],
  ),
  recordSpec("events", (doc) => doc.events, assignArray("events")),
  recordSpec(
    "registrations",
    (doc) => doc.registrations,
    assignArray("registrations"),
    ["event_id", "person_id", "status"],
    (row) => [text(row, "eventId"), text(row, "personId"), text(row, "status")],
  ),
  recordSpec("announcements", (doc) => doc.announcements, assignArray("announcements")),
  recordSpec(
    "schedule_assignments",
    (doc) => doc.schedule,
    assignArray("schedule"),
    ["person_id"],
    (row) => [text(row, "personId")],
  ),
  {
    table: "volunteers",
    conflict: "tenant_id, person_id",
    columns: ["tenant_id", "person_id", "record"],
    rows: (doc) => objects(doc.volunteers),
    values: (row) => [required(row, "personId"), recordColumn(row)],
    identity: (row) => [{ column: "person_id", value: required(row, "personId") }],
    assign: assignArray("volunteers"),
  },
  recordSpec("rooms", (doc) => doc.rooms, assignArray("rooms")),
  recordSpec("bookings", (doc) => doc.bookings, assignArray("bookings")),
  recordSpec("expenses", (doc) => doc.expenses, assignArray("expenses"), ["person_id"], (row) => [text(row, "personId")]),
  {
    table: "pathways",
    conflict: "tenant_id, person_id",
    columns: ["tenant_id", "person_id", "record"],
    rows: (doc) => objects(doc.pathways),
    values: (row) => [required(row, "personId"), recordColumn(row)],
    identity: (row) => [{ column: "person_id", value: required(row, "personId") }],
    assign: assignArray("pathways"),
  },
  recordSpec("visitors", (doc) => doc.visitors, assignArray("visitors")),
  recordSpec("care_requests", (doc) => doc.requests, assignArray("requests"), ["person_id"], (row) => [
    text(row, "personId"),
  ]),
  recordSpec("message_drafts", (doc) => doc.drafts, assignArray("drafts")),
  {
    table: "member_invites",
    conflict: "tenant_id, token_hash",
    columns: ["tenant_id", "token_hash", "email", "expires_ms", "record"],
    rows: (doc) => objects(doc.invites),
    values: (row) => [required(row, "tokenHash"), required(row, "email"), required(row, "expires"), recordColumn(row)],
    identity: (row) => [{ column: "token_hash", value: required(row, "tokenHash") }],
    assign: assignArray("invites"),
  },
  recordSpec("follow_ups", (doc) => doc.followUps, assignArray("followUps"), ["person_id"], (row) => [
    text(row, "personId"),
  ]),
  {
    table: "streaks",
    conflict: "tenant_id, person_id",
    columns: ["tenant_id", "person_id", "record"],
    rows: (doc) => objects(doc.streaks),
    values: (row) => [required(row, "personId"), recordColumn(row)],
    identity: (row) => [{ column: "person_id", value: required(row, "personId") }],
    assign: assignArray("streaks"),
  },
  {
    table: "rate_limits",
    conflict: "tenant_id, bucket_key",
    columns: ["tenant_id", "bucket_key", "record"],
    rows: (doc) => objects(doc.throttle),
    values: (row) => [required(row, "key"), recordColumn(row)],
    identity: (row) => [{ column: "bucket_key", value: required(row, "key") }],
    assign: assignArray("throttle"),
  },
  {
    table: "my_five",
    conflict: "tenant_id, person_id",
    columns: ["tenant_id", "person_id", "record"],
    rows: (doc) => objects(doc.myFive),
    values: (row) => [required(row, "personId"), recordColumn(row)],
    identity: (row) => [{ column: "person_id", value: required(row, "personId") }],
    assign: assignArray("myFive"),
  },
  recordSpec("testimonies", (doc) => doc.testimonies, assignArray("testimonies"), ["author_id"], (row) => [
    text(row, "authorId"),
  ]),
  recordSpec("milestones", (doc) => doc.milestones, assignArray("milestones")),
  recordSpec("outreach_events", (doc) => doc.outreach, assignArray("outreach")),
  recordSpec(
    "outreach_rsvps",
    (doc) => doc.outreachRsvps,
    assignArray("outreachRsvps"),
    ["outreach_id", "person_id"],
    (row) => [text(row, "outreachId"), text(row, "personId")],
  ),
  recordSpec("coffee_orders", (doc) => doc.coffeeOrders, assignArray("coffeeOrders"), ["person_id"], (row) => [
    text(row, "personId"),
  ]),
  recordSpec("social_links", (doc) => doc.social, assignArray("social")),
  recordSpec(
    "person_profiles",
    (doc) => doc.profiles,
    assignArray("profiles"),
    ["person_id", "stage", "last_contact_at"],
    (row) => [required(row, "personId"), required(row, "stage"), epoch(row, "lastContactAt")],
  ),
  recordSpec("tags", (doc) => doc.tags, assignArray("tags"), ["kind", "archived"], (row) => [
    required(row, "kind"),
    bool(row, "archived"),
  ]),
  recordSpec(
    "person_tags",
    (doc) => doc.personTags,
    assignArray("personTags"),
    ["person_id", "tag_id"],
    (row) => [required(row, "personId"), required(row, "tagId")],
  ),
  recordSpec(
    "interactions",
    (doc) => doc.touches,
    assignArray("touches"),
    ["person_id", "kind", "outcome", "touched_at"],
    (row) => [required(row, "personId"), required(row, "kind"), required(row, "outcome"), epoch(row, "at")],
  ),
  recordSpec("care_playbooks", (doc) => doc.playbooks, assignArray("playbooks"), ["trigger", "active"], (row) => [
    required(row, "trigger"),
    bool(row, "active"),
  ]),
  recordSpec(
    "care_tasks",
    (doc) => doc.careTasks,
    assignArray("careTasks"),
    ["person_id", "follow_up_id", "playbook_id", "assignee_id", "status", "due_at", "completed_at"],
    (row) => [
      text(row, "personId"),
      text(row, "followUpId"),
      text(row, "playbookId"),
      text(row, "assigneeId"),
      required(row, "status"),
      epoch(row, "dueAt"),
      epoch(row, "completedAt"),
    ],
  ),
  recordSpec(
    "featured_messages",
    (doc) => (doc.featuredMessage ? [{ id: "current", ...doc.featuredMessage }] : []),
    (doc, rows) => {
      const row = rows[0];
      if (!row) {
        doc.featuredMessage = null;
        return;
      }
      doc.featuredMessage = {
        videoId: String(row.videoId ?? ""),
        title: String(row.title ?? ""),
        speaker: String(row.speaker ?? ""),
        passage: String(row.passage ?? ""),
        link: String(row.link ?? ""),
        thumbnail: String(row.thumbnail ?? ""),
      };
    },
  ),
];

function keyOf(parts: { column: string; value: unknown }[]): string {
  return parts.map((part) => `${part.column}=${String(part.value)}`).join("|");
}

async function syncSpec(
  sql: SqlClient,
  tenantId: string,
  spec: SyncSpec,
  before: StoreDocument,
  after: StoreDocument,
  ctx: SaveContext,
  retainExtras = false,
) {
  let writes = 0;
  const known = rowVersions(before);
  const previous = new Map(spec.rows(before).map((row) => [keyOf(spec.identity(row)), row]));
  const next = new Map(spec.rows(after).map((row) => [keyOf(spec.identity(row)), row]));
  for (const [key, row] of next) {
    const prior = previous.get(key);
    if (prior && stable(prior) === stable(row)) continue;
    if (prior && spec.appendOnly) continue;
    await upsert(sql, tenantId, spec, row, ctx, {
      prior: Boolean(prior),
      expectedVersion: known.get(`${spec.table}:${key}`) ?? 1,
    });
    writes += 1;
  }
  if (!spec.appendOnly && !retainExtras) {
    for (const [key, row] of previous) {
      if (next.has(key)) continue;
      await remove(sql, tenantId, spec, row);
      writes += 1;
    }
  }
  return writes;
}

async function upsert(
  sql: SqlClient,
  tenantId: string,
  spec: SyncSpec,
  row: Row,
  ctx: SaveContext,
  change: { prior: boolean; expectedVersion: number },
) {
  const columns = spec.columns.map(assertIdent);
  const values = [tenantId, ...spec.values(row, ctx)];
  if (values.length !== columns.length) {
    throw new Error(`${spec.table} expected ${columns.length} values and got ${values.length}.`);
  }
  const table = assertIdent(spec.table);
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
  if (spec.appendOnly || !change.prior) {
    const inserted = await sql.query(
      `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders}) ON CONFLICT (${spec.conflict}) DO NOTHING RETURNING 1 AS ok`,
      values,
    );
    if (!spec.appendOnly && inserted.rows.length === 0) throw new WriteConflictError(table);
    return;
  }
  const keys = new Set(spec.conflict.split(",").map((part) => part.trim()));
  const pairs = columns
    .map((column, index) => ({ column, value: values[index] }))
    .filter((pair) => !keys.has(pair.column));
  const assignments = pairs.map((pair, index) => `${pair.column} = $${index + 1}`);
  const assignedValues = pairs.map((pair) => pair.value);
  const identity = spec.identity(row);
  const where = [
    "tenant_id = $" + (assignedValues.length + 1),
    ...identity.map((part, index) => `${assertIdent(part.column)} = $${assignedValues.length + 2 + index}`),
    `row_version = $${assignedValues.length + 2 + identity.length}`,
  ];
  const updated = await sql.query(
    `UPDATE ${table} SET ${assignments.join(", ")}, row_version = row_version + 1 WHERE ${where.join(" AND ")} RETURNING row_version`,
    [...assignedValues, tenantId, ...identity.map((part) => part.value), change.expectedVersion],
  );
  if (updated.rows.length === 0) throw new WriteConflictError(table);
}

async function remove(sql: SqlClient, tenantId: string, spec: SyncSpec, row: Row) {
  const parts = spec.identity(row);
  const where = ["tenant_id = $1", ...parts.map((part, index) => `${assertIdent(part.column)} = $${index + 2}`)];
  await sql.query(`DELETE FROM ${assertIdent(spec.table)} WHERE ${where.join(" AND ")}`, [
    tenantId,
    ...parts.map((part) => part.value),
  ]);
}

async function loadRecords(
  sql: SqlClient,
  tenantId: string,
  spec: SyncSpec,
  doc: StoreDocument,
  platformKey: Buffer | null,
  extraWhere = "",
  extraParams: readonly unknown[] = [],
): Promise<Row[]> {
  const versionColumn = spec.table === "audit_log" ? "" : ", row_version";
  const totpColumn = spec.table === "people" ? ", totp_secret" : "";
  if (!(await relationReady(sql, spec.table))) return [];
  const found = await sql.query<{ record: string; row_version?: number; totp_secret?: string | null }>(
    `SELECT record${versionColumn}${totpColumn} FROM ${assertIdent(spec.table)}
     WHERE tenant_id = $1 AND record IS NOT NULL${extraWhere}`,
    [tenantId, ...extraParams],
  );
  const known = rowVersions(doc);
  return found.rows.map((row) => {
    const parsed = JSON.parse(row.record) as Row;
    if (typeof row.row_version === "number") {
      const key = `${spec.table}:${keyOf(spec.identity(parsed))}`;
      known.set(key, row.row_version);
    }
    if (spec.table === "people" && row.totp_secret && platformKey) {
      parsed.totpSecret = decryptString(row.totp_secret, platformKey);
    }
    return parsed;
  });
}

/** The church's newest touches, plus one page of one person's timeline when asked. */
async function loadTouches(
  sql: SqlClient,
  tenantId: string,
  spec: SyncSpec,
  doc: StoreDocument,
  platformKey: Buffer | null,
  page: { personId: string; before?: number | null } | null,
): Promise<Row[]> {
  const recent = await loadRecords(
    sql,
    tenantId,
    spec,
    doc,
    platformKey,
    ` ORDER BY touched_at DESC NULLS LAST, id DESC LIMIT ${RECENT_TOUCHES}`,
  );
  if (!page) return recent;
  const before = typeof page.before === "number" && page.before > 0 ? new Date(page.before).toISOString() : null;
  const personRows = await loadRecords(
    sql,
    tenantId,
    spec,
    doc,
    platformKey,
    ` AND person_id = $2 AND ($3::timestamptz IS NULL OR touched_at < $3::timestamptz)
     ORDER BY touched_at DESC NULLS LAST, id DESC LIMIT ${PERSON_TOUCH_ROWS}`,
    [page.personId, before],
  );
  const seen = new Set(recent.map((row) => String(row.id)));
  return [...recent, ...personRows.filter((row) => !seen.has(String(row.id)))];
}

export async function loadDocument(
  sql: SqlClient,
  tenantId: string,
  options: LoadOptions = {},
): Promise<StoreDocument> {
  const doc = emptyDocument();
  const platformKey = options.platformKey ?? null;
  const only = options.tables ? new Set(options.tables) : null;
  const want = (table: string) => !only || only.has(table);
  for (const spec of SPECS) {
    if (!want(spec.table)) continue;
    if (spec.table === "audit_log" && !options.includeAudit) continue;
    if (spec.table === "sessions" && !options.allSessions && !options.sessionToken) continue;
    const extra =
      spec.table === "sessions" && options.sessionToken
        ? " AND token = $2"
        : spec.table === "audit_log"
          ? " AND source = 'app'"
          : "";
    const params = spec.table === "sessions" && options.sessionToken ? [options.sessionToken] : [];
    if (spec.table === "interactions" && !options.allTouches) {
      spec.assign(doc, await loadTouches(sql, tenantId, spec, doc, platformKey, options.touchPage ?? null));
      continue;
    }
    if (spec.table === "care_tasks" && !options.allTouches) {
      // Open tasks, plus the last 30 days of finished ones for the Today numbers.
      const recent = " AND (status = 'open' OR completed_at > now() - interval '30 days')";
      spec.assign(doc, await loadRecords(sql, tenantId, spec, doc, platformKey, recent));
      continue;
    }
    spec.assign(doc, await loadRecords(sql, tenantId, spec, doc, platformKey, extra, params));
  }
  if (want("station_duty")) {
    const duty = await sql.query<{ person_id: string }>(`SELECT person_id FROM station_duty WHERE tenant_id = $1`, [
      tenantId,
    ]);
    doc.station = duty.rows.map((row) => row.person_id);
  }
  if (want("kids_team") && (await relationReady(sql, "kids_team"))) {
    const team = await sql.query<{ person_id: string }>(`SELECT person_id FROM kids_team WHERE tenant_id = $1`, [
      tenantId,
    ]);
    doc.kidsTeam = team.rows.map((row) => row.person_id);
  }
  if (want("prayer_amens")) {
    const amens = await sql.query<{ prayer_id: string; person_id: string }>(
      `SELECT prayer_id, person_id FROM prayer_amens WHERE tenant_id = $1`,
      [tenantId],
    );
    doc.amens = amens.rows.map((row) => ({ prayerId: row.prayer_id, personId: row.person_id }));
  }
  const shares = want("care_notes")
    ? await sql.query<{ note_id: string; person_id: string }>(
        `SELECT note_id, person_id FROM care_note_shares WHERE tenant_id = $1`,
        [tenantId],
      )
    : { rows: [] as { note_id: string; person_id: string }[] };
  const byNote = new Map<string, string[]>();
  for (const share of shares.rows) {
    const list = byNote.get(share.note_id) ?? [];
    list.push(share.person_id);
    byNote.set(share.note_id, list);
  }
  doc.notes = doc.notes.map((note) => ({ ...note, sharedWith: byNote.get(note.id) ?? note.sharedWith ?? [] }));
  if (want("tenant_integrations")) {
    const secrets = await sql.query<{ provider: string; credentials_ciphertext: string; last4: string }>(
      `SELECT provider, credentials_ciphertext, last4 FROM tenant_integrations
       WHERE tenant_id = $1 AND credentials_ciphertext IS NOT NULL AND revoked_at IS NULL`,
      [tenantId],
    );
    doc.secrets = secrets.rows.map((row) => ({
      provider: row.provider,
      ciphertext: row.credentials_ciphertext,
      last4: row.last4,
    }));
  }
  if (want("tenant_modules")) {
    const modules = await sql.query<{ module_id: string; enabled: boolean }>(
      `SELECT module_id, enabled FROM tenant_modules WHERE tenant_id = $1`,
      [tenantId],
    );
    for (const row of modules.rows) {
      if (MODULES.includes(row.module_id as ModuleId)) doc.flags[row.module_id as ModuleId] = row.enabled;
    }
  }
  if (want("people")) await hydratePasswords(sql, tenantId, doc);
  return doc;
}

export async function saveDocumentDiff(
  sql: SqlClient,
  tenantId: string,
  before: StoreDocument,
  after: StoreDocument,
  options: SaveOptions,
): Promise<number> {
  let writes = 0;
  const ctx: SaveContext = { platformKey: options.platformKey ?? null };
  const only = options.onlyTables ? new Set(options.onlyTables) : null;
  const want = (table: string) => !only || only.has(table) || table === "audit_log";
  for (const spec of SPECS) {
    if (!want(spec.table)) continue;
    writes += await syncSpec(sql, tenantId, spec, before, after, ctx, options.retainExtras === true);
  }
  writes += await eraseLeavers(sql, tenantId, before, after, want);
  if (want("station_duty")) writes += await syncStation(sql, tenantId, before.station, after.station);
  if (want("kids_team")) writes += await syncIdSet(sql, tenantId, "kids_team", before.kidsTeam ?? [], after.kidsTeam ?? []);
  if (want("prayer_amens")) writes += await syncAmens(sql, tenantId, before.amens ?? [], after.amens ?? []);
  if (want("care_notes")) writes += await syncShares(sql, tenantId, before.notes, after.notes);
  if (want("tenant_integrations")) writes += await syncSecrets(sql, tenantId, before.secrets, after.secrets);
  if (
    (want("people") || want("kids")) &&
    (stable(before.people) !== stable(after.people) || stable(before.children) !== stable(after.children))
  ) {
    writes += await syncHouseholds(sql, tenantId, after);
  }
  if (want("people") && stable(before.people) !== stable(after.people)) {
    writes += await syncAccounts(sql, tenantId, before, after);
  }
  if (want("tenant_modules") && options.syncModules && stable(before.flags) !== stable(after.flags)) {
    writes += await syncModules(sql, tenantId, after);
  }
  return writes;
}

async function syncStation(sql: SqlClient, tenantId: string, before: string[], after: string[]) {
  return syncIdSet(sql, tenantId, "station_duty", before, after);
}

/**
 * Touches and tasks are read a page at a time, so rows for someone who just left may not be in memory.
 * Delete them by person in Postgres so leaving the church erases all of it.
 */
async function eraseLeavers(
  sql: SqlClient,
  tenantId: string,
  before: StoreDocument,
  after: StoreDocument,
  want: (table: string) => boolean,
): Promise<number> {
  const wasLive = new Set(objects(before.people).filter((row) => !bool(row, "deleted")).map((row) => required(row, "id")));
  const leavers = objects(after.people)
    .filter((row) => bool(row, "deleted") && wasLive.has(required(row, "id")))
    .map((row) => required(row, "id"));
  let writes = 0;
  for (const table of ["interactions", "care_tasks"] as const) {
    if (leavers.length === 0 || !want(table) || !(await relationReady(sql, table))) continue;
    const removed = await sql.query(`DELETE FROM ${table} WHERE tenant_id = $1 AND person_id = ANY($2::text[]) RETURNING id`, [
      tenantId,
      leavers,
    ]);
    writes += removed.rows.length;
  }
  return writes;
}

async function syncIdSet(sql: SqlClient, tenantId: string, table: "station_duty" | "kids_team", before: string[], after: string[]) {
  let writes = 0;
  const previous = new Set(before);
  const next = new Set(after);
  const name = assertIdent(table);
  for (const personId of next) {
    if (previous.has(personId)) continue;
    await sql.query(`INSERT INTO ${name} (tenant_id, person_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [
      tenantId,
      personId,
    ]);
    writes += 1;
  }
  for (const personId of previous) {
    if (next.has(personId)) continue;
    await sql.query(`DELETE FROM ${name} WHERE tenant_id = $1 AND person_id = $2`, [tenantId, personId]);
    writes += 1;
  }
  return writes;
}

async function syncAmens(
  sql: SqlClient,
  tenantId: string,
  before: { prayerId: string; personId: string }[],
  after: { prayerId: string; personId: string }[],
) {
  let writes = 0;
  const key = (row: { prayerId: string; personId: string }) => `${row.prayerId}:${row.personId}`;
  const previous = new Map(before.map((row) => [key(row), row]));
  const next = new Map(after.map((row) => [key(row), row]));
  for (const [id, row] of next) {
    if (previous.has(id)) continue;
    await sql.query(
      `INSERT INTO prayer_amens (tenant_id, prayer_id, person_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [tenantId, row.prayerId, row.personId],
    );
    writes += 1;
  }
  for (const [id, row] of previous) {
    if (next.has(id)) continue;
    await sql.query(`DELETE FROM prayer_amens WHERE tenant_id = $1 AND prayer_id = $2 AND person_id = $3`, [
      tenantId,
      row.prayerId,
      row.personId,
    ]);
    writes += 1;
  }
  return writes;
}

async function syncShares(
  sql: SqlClient,
  tenantId: string,
  before: StoreDocument["notes"],
  after: StoreDocument["notes"],
) {
  const pairs = (notes: StoreDocument["notes"]) =>
    notes.flatMap((note) => (note.sharedWith ?? []).map((personId) => ({ noteId: note.id, personId })));
  let writes = 0;
  const key = (row: { noteId: string; personId: string }) => `${row.noteId}:${row.personId}`;
  const previous = new Map(pairs(before).map((row) => [key(row), row]));
  const next = new Map(pairs(after).map((row) => [key(row), row]));
  for (const [id, row] of next) {
    if (previous.has(id)) continue;
    await sql.query(
      `INSERT INTO care_note_shares (note_id, person_id, tenant_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [row.noteId, row.personId, tenantId],
    );
    writes += 1;
  }
  for (const [id, row] of previous) {
    if (next.has(id)) continue;
    await sql.query(`DELETE FROM care_note_shares WHERE tenant_id = $1 AND note_id = $2 AND person_id = $3`, [
      tenantId,
      row.noteId,
      row.personId,
    ]);
    writes += 1;
  }
  return writes;
}

async function syncSecrets(
  sql: SqlClient,
  tenantId: string,
  before: StoreDocument["secrets"],
  after: StoreDocument["secrets"],
) {
  let writes = 0;
  const previous = new Map(before.map((row) => [row.provider, row]));
  const next = new Map(after.map((row) => [row.provider, row]));
  for (const [provider, row] of next) {
    const prior = previous.get(provider);
    if (prior && prior.ciphertext === row.ciphertext && prior.last4 === row.last4) continue;
    await sql.query(
      `INSERT INTO tenant_integrations (tenant_id, provider, mode, credentials_ciphertext, key_id, last4)
       VALUES ($1, $2, 'connected', $3, 'platform-field', $4)
       ON CONFLICT (tenant_id, provider) DO UPDATE
         SET credentials_ciphertext = EXCLUDED.credentials_ciphertext,
             last4 = EXCLUDED.last4,
             key_id = 'platform-field',
             mode = 'connected',
             revoked_at = NULL`,
      [tenantId, provider, row.ciphertext, row.last4],
    );
    writes += 1;
  }
  for (const [provider] of previous) {
    if (next.has(provider)) continue;
    await sql.query(`DELETE FROM tenant_integrations WHERE tenant_id = $1 AND provider = $2`, [tenantId, provider]);
    writes += 1;
  }
  return writes;
}

async function hydratePasswords(sql: SqlClient, tenantId: string, doc: StoreDocument) {
  const found = await sql.query<{ person_id: string; password_hash: string | null }>(
    "SELECT person_id, password_hash FROM read_tenant_passwords($1)",
    [tenantId],
  );
  const hashes = new Map(found.rows.map((row) => [row.person_id, row.password_hash]));
  doc.people = doc.people.map((person) => ({
    ...person,
    passwordHash: hashes.get(person.id) ?? null,
  }));
}

async function syncHouseholds(sql: SqlClient, tenantId: string, doc: StoreDocument) {
  const ids = new Set<string>();
  for (const person of doc.people) if (person.householdId) ids.add(person.householdId);
  for (const child of doc.children) ids.add(child.householdId);
  let writes = 0;
  for (const id of ids) {
    await sql.query(
      `INSERT INTO households (id, name, tenant_id) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
      [id, id, tenantId],
    );
    writes += 1;
  }
  return writes;
}

async function syncAccounts(sql: SqlClient, tenantId: string, before: StoreDocument, after: StoreDocument) {
  let writes = 0;
  const removed = new Set(before.people.map((person) => person.id));
  for (const person of after.people) removed.delete(person.id);
  for (const person of after.people) {
    const email = person.email?.trim().toLowerCase();
    if (!email) continue;
    await sql.query(`SELECT link_membership($1, $2, $3, $4, $5, $6)`, [
      email,
      person.passwordHash,
      tenantId,
      person.id,
      person.role,
      person.deleted ? "disabled" : "active",
    ]);
    writes += 1;
  }
  for (const personId of removed) {
    await sql.query(`UPDATE memberships SET status = 'disabled', updated_at = now() WHERE tenant_id = $1 AND person_id = $2`, [
      tenantId,
      personId,
    ]);
    writes += 1;
  }
  return writes;
}

async function syncModules(sql: SqlClient, tenantId: string, doc: StoreDocument) {
  let writes = 0;
  for (const moduleId of MODULES) {
    await sql.query(
      `INSERT INTO tenant_modules (tenant_id, module_id, enabled) VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, module_id) DO UPDATE SET enabled = EXCLUDED.enabled`,
      [tenantId, moduleId, doc.flags[moduleId] === true],
    );
    writes += 1;
  }
  return writes;
}

export async function documentCounts(doc: StoreDocument): Promise<Record<string, number>> {
  return {
    people: doc.people.length,
    gifts: doc.gifts.length,
    children: doc.children.length,
    sessions: doc.sessions.length,
    prayers: doc.prayers.length,
    groups: doc.groups.length,
    events: doc.events.length,
    notes: doc.notes.length,
  };
}
