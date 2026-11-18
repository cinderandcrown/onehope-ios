import { Pool, type PoolClient, neonConfig } from "@neondatabase/serverless";

import { loadConfig } from "./config";
import { ChurchStore, type StoreDocument } from "./store";

if (typeof WebSocket !== "undefined") neonConfig.webSocketConstructor = WebSocket;

const SNAPSHOT_ID = "church";
const LOCK_KEY = 14011;

let pool: Pool | null = null;

export function databaseUrl(): string | null {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
  return url.length > 0 ? url : null;
}

function sharedPool(url: string): Pool {
  if (!pool) pool = new Pool({ connectionString: url, max: 1 });
  return pool;
}

/**
 * Runs work against the shared demo store. With DATABASE_URL or POSTGRES_URL,
 * the store is loaded from and saved to Postgres around the call so a
 * serverless instance sees the same labeled demo the last request left behind.
 * Without a database URL, the in-memory store used by tests is unchanged.
 */
export async function withStore<T>(fn: (store: ChurchStore) => Promise<T> | T): Promise<T> {
  const url = databaseUrl();
  if (!url) return fn(getMemoryStore());
  const client = await sharedPool(url).connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [LOCK_KEY]);
    await client.query(`CREATE TABLE IF NOT EXISTS demo_runtime (
      id text PRIMARY KEY,
      payload text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    const store = await loadOrCreate(client);
    const result = await fn(store);
    await client.query("UPDATE demo_runtime SET payload = $2, updated_at = now() WHERE id = $1", [
      SNAPSHOT_ID,
      JSON.stringify(store.toDocument()),
    ]);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function getMemoryStore(): ChurchStore {
  const globalStore = globalThis as typeof globalThis & { __onehope?: ChurchStore };
  if (!globalStore.__onehope) globalStore.__onehope = ChurchStore.demo();
  return globalStore.__onehope;
}

async function loadOrCreate(client: PoolClient): Promise<ChurchStore> {
  const found = await client.query<{ payload: string }>("SELECT payload FROM demo_runtime WHERE id = $1", [
    SNAPSHOT_ID,
  ]);
  const store = new ChurchStore(loadConfig(process.env));
  const row = found.rows[0];
  if (row) {
    const parsed: unknown = JSON.parse(row.payload);
    if (!isDocument(parsed))
      throw new Error("The demo snapshot in Postgres is not a version this server can read.");
    store.installDocument(parsed);
  } else {
    await client.query("INSERT INTO demo_runtime (id, payload) VALUES ($1, $2)", [
      SNAPSHOT_ID,
      JSON.stringify(store.toDocument()),
    ]);
  }
  await seedLabeledRows(client, store.toDocument());
  return store;
}

function isDocument(value: unknown): value is StoreDocument {
  return Boolean(value) && typeof value === "object" && (value as { version?: number }).version === 1;
}

const LOCKED_TABLES = [
  "gifts",
  "kids",
  "care_notes",
  "care_note_shares",
  "prayers",
  "background_checks",
  "audit_log",
];

async function seedLabeledRows(client: PoolClient, document: StoreDocument): Promise<void> {
  const ready = await client.query<{ households: string | null }>(
    "SELECT to_regclass('public.households') AS households",
  );
  if (!ready.rows[0]?.households) return;
  const existing = await client.query("SELECT id FROM households LIMIT 1");
  if (existing.rows.length > 0) return;
  for (const table of LOCKED_TABLES) {
    await client.query(`ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY`);
  }
  const households = new Set<string>();
  for (const person of document.people) {
    if (person.householdId) households.add(person.householdId);
  }
  for (const child of document.children) households.add(child.householdId);
  for (const householdId of households) {
    const name = householdId.startsWith("hh-") ? `Sample ${householdId.slice(3)}` : householdId;
    await client.query("INSERT INTO households (id, name) VALUES ($1, $2)", [householdId, name]);
  }
  for (const person of document.people) {
    await client.query(
      `INSERT INTO people (id, household_id, role, display_name, email, email_public, phone, phone_public)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        person.id,
        person.householdId,
        person.role,
        person.displayName,
        person.email,
        person.emailPublic,
        person.phone,
        person.phonePublic,
      ],
    );
  }
  for (const gift of document.gifts) {
    await client.query(
      "INSERT INTO gifts (id, household_id, person_id, amount_ciphertext, sample) VALUES ($1, $2, $3, $4, $5)",
      [gift.id, gift.householdId, gift.personId, gift.ciphertext, gift.sample],
    );
  }
  for (const child of document.children) {
    await client.query(
      "INSERT INTO kids (id, household_id, display_name, medical_ciphertext, restricted) VALUES ($1, $2, $3, $4, $5)",
      [
        child.id,
        child.householdId,
        child.displayName,
        child.ciphertext,
        child.restrictedPersonIds.length > 0,
      ],
    );
  }
  for (const note of document.notes) {
    await client.query(
      "INSERT INTO care_notes (id, subject_person_id, body_ciphertext) VALUES ($1, $2, $3)",
      [note.id, note.subjectPersonId, note.ciphertext],
    );
    for (const personId of note.sharedWith) {
      await client.query("INSERT INTO care_note_shares (note_id, person_id) VALUES ($1, $2)", [
        note.id,
        personId,
      ]);
    }
  }
  for (const prayer of document.prayers) {
    await client.query(
      "INSERT INTO prayers (id, author_id, body, visibility, approved) VALUES ($1, $2, $3, $4, $5)",
      [prayer.id, prayer.authorId, prayer.body, prayer.visibility, prayer.approved],
    );
  }
  for (const check of document.checks) {
    await client.query(
      "INSERT INTO background_checks (id, person_id, status, notes_ciphertext) VALUES ($1, $2, $3, $4)",
      [`check-${check.personId}`, check.personId, check.status, check.ciphertext],
    );
  }
  for (const table of LOCKED_TABLES) {
    await client.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
    await client.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
  }
}
