import { MODULES, type ModuleId } from "./domain";
import type { SqlClient } from "./migrate";
import type { StoreDocument } from "./store";

type Row = Record<string, unknown>;

type SyncSpec = {
  table: string;
  conflict: string;
  columns: readonly string[];
  appendOnly?: boolean;
  rows: (doc: StoreDocument) => Row[];
  values: (row: Row) => unknown[];
  identity: (row: Row) => { column: string; value: unknown }[];
  assign: (doc: StoreDocument, rows: Row[]) => void;
};

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
  };
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
    values: (row) => [
      required(row, "id"),
      text(row, "householdId"),
      required(row, "role"),
      required(row, "displayName"),
      text(row, "email"),
      bool(row, "emailPublic"),
      text(row, "phone"),
      bool(row, "phonePublic"),
      text(row, "passwordHash"),
      text(row, "totpSecret"),
      bool(row, "listedInDirectory"),
      bool(row, "deleted"),
      text(row, "lastIp"),
      text(row, "lastUserAgent"),
      bool(row, "sample"),
      recordColumn(row),
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
];

function keyOf(parts: { column: string; value: unknown }[]): string {
  return parts.map((part) => `${part.column}=${String(part.value)}`).join("|");
}

async function syncSpec(sql: SqlClient, tenantId: string, spec: SyncSpec, before: StoreDocument, after: StoreDocument) {
  let writes = 0;
  const previous = new Map(spec.rows(before).map((row) => [keyOf(spec.identity(row)), row]));
  const next = new Map(spec.rows(after).map((row) => [keyOf(spec.identity(row)), row]));
  for (const [key, row] of next) {
    const prior = previous.get(key);
    if (prior && stable(prior) === stable(row)) continue;
    if (prior && spec.appendOnly) continue;
    await upsert(sql, tenantId, spec, row);
    writes += 1;
  }
  if (!spec.appendOnly) {
    for (const [key, row] of previous) {
      if (next.has(key)) continue;
      await remove(sql, tenantId, spec, row);
      writes += 1;
    }
  }
  return writes;
}

async function upsert(sql: SqlClient, tenantId: string, spec: SyncSpec, row: Row) {
  const columns = spec.columns.map(assertIdent);
  const values = [tenantId, ...spec.values(row)];
  if (values.length !== columns.length) {
    throw new Error(`${spec.table} expected ${columns.length} values and got ${values.length}.`);
  }
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
  const keys = new Set(spec.conflict.split(",").map((part) => part.trim()));
  const assignments = columns.filter((column) => !keys.has(column)).map((column) => `${column} = EXCLUDED.${column}`);
  const action = assignments.length === 0 ? "DO NOTHING" : `DO UPDATE SET ${assignments.join(", ")}`;
  await sql.query(
    `INSERT INTO ${assertIdent(spec.table)} (${columns.join(", ")}) VALUES (${placeholders}) ON CONFLICT (${spec.conflict}) ${action}`,
    values,
  );
}

async function remove(sql: SqlClient, tenantId: string, spec: SyncSpec, row: Row) {
  const parts = spec.identity(row);
  const where = ["tenant_id = $1", ...parts.map((part, index) => `${assertIdent(part.column)} = $${index + 2}`)];
  await sql.query(`DELETE FROM ${assertIdent(spec.table)} WHERE ${where.join(" AND ")}`, [
    tenantId,
    ...parts.map((part) => part.value),
  ]);
}

async function loadRecords(sql: SqlClient, tenantId: string, spec: SyncSpec): Promise<Row[]> {
  if (spec.table === "audit_log") {
    const found = await sql.query<{ record: string }>(
      `SELECT record FROM audit_log WHERE tenant_id = $1 AND source = 'app' AND record IS NOT NULL`,
      [tenantId],
    );
    return found.rows.map((row) => JSON.parse(row.record) as Row);
  }
  const found = await sql.query<{ record: string }>(
    `SELECT record FROM ${assertIdent(spec.table)} WHERE tenant_id = $1 AND record IS NOT NULL`,
    [tenantId],
  );
  return found.rows.map((row) => JSON.parse(row.record) as Row);
}

export async function loadDocument(sql: SqlClient, tenantId: string): Promise<StoreDocument> {
  const doc = emptyDocument();
  for (const spec of SPECS) {
    spec.assign(doc, await loadRecords(sql, tenantId, spec));
  }
  const duty = await sql.query<{ person_id: string }>(`SELECT person_id FROM station_duty WHERE tenant_id = $1`, [
    tenantId,
  ]);
  doc.station = duty.rows.map((row) => row.person_id);
  const amens = await sql.query<{ prayer_id: string; person_id: string }>(
    `SELECT prayer_id, person_id FROM prayer_amens WHERE tenant_id = $1`,
    [tenantId],
  );
  doc.amens = amens.rows.map((row) => ({ prayerId: row.prayer_id, personId: row.person_id }));
  const shares = await sql.query<{ note_id: string; person_id: string }>(
    `SELECT note_id, person_id FROM care_note_shares WHERE tenant_id = $1`,
    [tenantId],
  );
  const byNote = new Map<string, string[]>();
  for (const share of shares.rows) {
    const list = byNote.get(share.note_id) ?? [];
    list.push(share.person_id);
    byNote.set(share.note_id, list);
  }
  doc.notes = doc.notes.map((note) => ({ ...note, sharedWith: byNote.get(note.id) ?? note.sharedWith ?? [] }));
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
  const modules = await sql.query<{ module_id: string; enabled: boolean }>(
    `SELECT module_id, enabled FROM tenant_modules WHERE tenant_id = $1`,
    [tenantId],
  );
  for (const row of modules.rows) {
    if (MODULES.includes(row.module_id as ModuleId)) doc.flags[row.module_id as ModuleId] = row.enabled;
  }
  return doc;
}

export async function saveDocumentDiff(
  sql: SqlClient,
  tenantId: string,
  before: StoreDocument,
  after: StoreDocument,
  options: { syncModules: boolean },
): Promise<number> {
  let writes = 0;
  for (const spec of SPECS) writes += await syncSpec(sql, tenantId, spec, before, after);
  writes += await syncStation(sql, tenantId, before.station, after.station);
  writes += await syncAmens(sql, tenantId, before.amens ?? [], after.amens ?? []);
  writes += await syncShares(sql, tenantId, before.notes, after.notes);
  writes += await syncSecrets(sql, tenantId, before.secrets, after.secrets);
  if (stable(before.people) !== stable(after.people) || stable(before.children) !== stable(after.children)) {
    writes += await syncHouseholds(sql, tenantId, after);
  }
  if (stable(before.people) !== stable(after.people)) writes += await syncAccounts(sql, tenantId, before, after);
  if (options.syncModules && stable(before.flags) !== stable(after.flags)) {
    writes += await syncModules(sql, tenantId, after);
  }
  return writes;
}

async function syncStation(sql: SqlClient, tenantId: string, before: string[], after: string[]) {
  let writes = 0;
  const previous = new Set(before);
  const next = new Set(after);
  for (const personId of next) {
    if (previous.has(personId)) continue;
    await sql.query(`INSERT INTO station_duty (tenant_id, person_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [
      tenantId,
      personId,
    ]);
    writes += 1;
  }
  for (const personId of previous) {
    if (next.has(personId)) continue;
    await sql.query(`DELETE FROM station_duty WHERE tenant_id = $1 AND person_id = $2`, [tenantId, personId]);
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

async function syncHouseholds(sql: SqlClient, tenantId: string, doc: StoreDocument) {
  const ids = new Set<string>();
  for (const person of doc.people) if (person.householdId) ids.add(person.householdId);
  for (const child of doc.children) ids.add(child.householdId);
  let writes = 0;
  for (const id of ids) {
    await sql.query(
      `INSERT INTO households (id, name, tenant_id) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, tenant_id = EXCLUDED.tenant_id`,
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
    const saved = await sql.query<{ id: string }>(
      `INSERT INTO accounts (id, email, password_hash) VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET password_hash = COALESCE(EXCLUDED.password_hash, accounts.password_hash)
       RETURNING id`,
      [`acct_${email}`, email, person.passwordHash],
    );
    const accountId = saved.rows[0]?.id;
    if (!accountId) continue;
    await sql.query(
      `INSERT INTO memberships (id, tenant_id, account_id, person_id, role, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tenant_id, person_id) DO UPDATE
         SET role = EXCLUDED.role, status = EXCLUDED.status, account_id = EXCLUDED.account_id, updated_at = now()`,
      [
        `mem_${tenantId}_${person.id}`,
        tenantId,
        accountId,
        person.id,
        person.role,
        person.deleted ? "disabled" : "active",
      ],
    );
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
