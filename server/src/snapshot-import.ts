import { createHash } from "node:crypto";

import { loadConfig, resolveEnvMode } from "./config";
import { documentCounts, loadDocument, saveDocumentDiff } from "./document-store";
import { assumeService } from "./service-role";
import type { SqlClient } from "./migrate";
import type { StoreDocument } from "./store";

const IMPORT_ID = "legacy-blob";

/**
 * Copies demo_runtime into tenant tables. Call this from the seed script, never from a request.
 * An advisory lock covers the read and the write. If the blob changed after a previous import,
 * the new rows are upserted and rows that exist only in the tables are left in place.
 * demo_runtime itself is not updated.
 */
export async function importLegacySnapshot(
  sql: SqlClient,
  env: NodeJS.ProcessEnv = process.env,
): Promise<"imported" | "absent" | "already" | "updated"> {
  await sql.query("BEGIN");
  try {
    await sql.query("SELECT pg_advisory_xact_lock($1)", [14011]);
    const found = await sql.query<{ payload: string }>("SELECT payload FROM demo_runtime WHERE id = 'church'");
    const payload = found.rows[0]?.payload;
    if (!payload) {
      await sql.query(
        `INSERT INTO snapshot_imports (id, status, imported_at) VALUES ($1, 'absent', now())
         ON CONFLICT (id) DO UPDATE SET status = 'absent', imported_at = now()`,
        [IMPORT_ID],
      );
      await sql.query("COMMIT");
      return "absent";
    }
    const checksum = createHash("sha256").update(payload).digest("hex");
    const flag = await sql.query<{ status: string; source_checksum: string | null }>(
      "SELECT status, source_checksum FROM snapshot_imports WHERE id = $1",
      [IMPORT_ID],
    );
    if (flag.rows[0]?.status === "imported" && flag.rows[0].source_checksum === checksum) {
      const check = await sql.query<{ payload: string }>("SELECT payload FROM demo_runtime WHERE id = 'church'");
      if (check.rows[0]?.payload !== payload) throw new Error("demo_runtime changed while it was being checked.");
      await sql.query("COMMIT");
      return "already";
    }
    const parsed: unknown = JSON.parse(payload);
    if (!isDocument(parsed)) throw new Error("The legacy snapshot is not a version this server can import.");
    refuseSampleInProduction(parsed, env);
    await sql.query("SELECT set_config('app.tenant_id', 'onehope', true)");
    await assumeService(sql);
    const key = loadConfig(env).fieldEncryptionKey;
    const current = await loadDocument(sql, "onehope", {
      includeAudit: true,
      allSessions: true,
      allTouches: true,
      platformKey: key,
    });
    await saveDocumentDiff(sql, "onehope", current, parsed, {
      syncModules: true,
      platformKey: key,
      retainExtras: true,
    });
    await sql.query("INSERT INTO tenant_runtime (tenant_id) VALUES ('onehope') ON CONFLICT DO NOTHING");
    const loaded = await loadDocument(sql, "onehope", {
      includeAudit: true,
      allSessions: true,
      allTouches: true,
      platformKey: key,
    });
    const expected = await documentCounts(parsed);
    const actual = await documentCounts(loaded);
    for (const [name, count] of Object.entries(expected)) {
      if ((actual[name] ?? 0) < count) {
        throw new Error(`Import count mismatch for ${name}: expected at least ${count}, stored ${actual[name] ?? 0}.`);
      }
    }
    await sql.query("RESET ROLE");
    const unchanged = await sql.query<{ payload: string }>("SELECT payload FROM demo_runtime WHERE id = 'church'");
    if (unchanged.rows[0]?.payload !== payload) throw new Error("demo_runtime changed during import.");
    await sql.query(
      `INSERT INTO snapshot_imports (id, status, source_checksum, row_counts, imported_at)
       VALUES ($1, 'imported', $2, $3, now())
       ON CONFLICT (id) DO UPDATE
         SET status = 'imported', source_checksum = EXCLUDED.source_checksum, row_counts = EXCLUDED.row_counts, imported_at = now()`,
      [IMPORT_ID, checksum, JSON.stringify(actual)],
    );
    await sql.query("COMMIT");
    return flag.rows.length > 0 ? "updated" : "imported";
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
  if (resolveEnvMode(env) !== "production") return;
  for (const person of doc.people) {
    if (person.sample || person.email.endsWith("@sample.onehope")) {
      throw new Error("Refusing to import sample people into a production tenant.");
    }
  }
}
