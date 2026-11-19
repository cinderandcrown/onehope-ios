import { createHash } from "node:crypto";

import { documentCounts, emptyDocument, loadDocument, saveDocumentDiff } from "./document-store";
import { assumeService } from "./service-role";
import type { SqlClient } from "./migrate";
import type { StoreDocument } from "./store";

const IMPORT_ID = "legacy-blob";

/**
 * Copies demo_runtime into tenant tables once.
 * After snapshot_imports has a row, this function does not read demo_runtime.
 * The blob stays in place for rollback. A copy is also written to demo_runtime_backup.
 */
export async function importLegacySnapshot(
  sql: SqlClient,
  env: NodeJS.ProcessEnv = process.env,
): Promise<"imported" | "absent" | "already"> {
  const flag = await sql.query<{ status: string }>("SELECT status FROM snapshot_imports WHERE id = $1", [IMPORT_ID]);
  if (flag.rows.length > 0) return "already";
  await sql.query("BEGIN");
  try {
    await sql.query("SELECT pg_advisory_xact_lock($1)", [14011]);
    const again = await sql.query<{ status: string }>("SELECT status FROM snapshot_imports WHERE id = $1", [IMPORT_ID]);
    if (again.rows.length > 0) {
      await sql.query("COMMIT");
      return "already";
    }
    const found = await sql.query<{ id: string; payload: string }>(
      "SELECT id, payload FROM demo_runtime WHERE id = 'church'",
    );
    const row = found.rows[0];
    if (!row) {
      await sql.query("INSERT INTO snapshot_imports (id, status, imported_at) VALUES ($1, 'absent', now())", [
        IMPORT_ID,
      ]);
      await sql.query("COMMIT");
      return "absent";
    }
    const parsed: unknown = JSON.parse(row.payload);
    if (!isDocument(parsed)) throw new Error("The legacy snapshot is not a version this server can import.");
    refuseSampleInProduction(parsed, env);
    const checksum = createHash("sha256").update(row.payload).digest("hex");
    await sql.query(
      `INSERT INTO demo_runtime_backup (id, payload)
       SELECT id, payload FROM demo_runtime
       ON CONFLICT (id) DO NOTHING`,
    );
    await sql.query("SELECT set_config('app.tenant_id', 'onehope', true)");
    await assumeService(sql);
    await saveDocumentDiff(sql, "onehope", emptyDocument(), parsed, { syncModules: true });
    await sql.query("INSERT INTO tenant_runtime (tenant_id) VALUES ('onehope') ON CONFLICT DO NOTHING");
    const loaded = await loadDocument(sql, "onehope");
    const expected = await documentCounts(parsed);
    const actual = await documentCounts(loaded);
    for (const [key, count] of Object.entries(expected)) {
      if (actual[key] !== count) {
        throw new Error(`Import count mismatch for ${key}: expected ${count}, stored ${actual[key] ?? 0}.`);
      }
    }
    await sql.query(
      `INSERT INTO snapshot_imports (id, status, source_checksum, row_counts, imported_at)
       VALUES ($1, 'imported', $2, $3, now())`,
      [IMPORT_ID, checksum, JSON.stringify(actual)],
    );
    await sql.query("COMMIT");
    return "imported";
  } catch (error) {
    await sql.query("ROLLBACK");
    throw error;
  }
}

function isDocument(value: unknown): value is StoreDocument {
  if (!value || typeof value !== "object") return false;
  const version = (value as { version?: unknown }).version;
  return version === 1 && Array.isArray((value as { people?: unknown }).people);
}

export function refuseSampleInProduction(doc: StoreDocument, env: NodeJS.ProcessEnv): void {
  if (env.ONEHOPE_ENV !== "production") return;
  for (const person of doc.people) {
    if (person.sample || person.email.endsWith("@sample.onehope")) {
      throw new Error("Refusing to import sample people into a production tenant.");
    }
  }
}
