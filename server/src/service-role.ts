import type { SqlClient } from "./migrate";

/** Runs fn as app_service for one tenant. The GUC is transaction-local. */
export async function withServiceRole<T>(sql: SqlClient, tenantId: string, fn: () => Promise<T>): Promise<T> {
  await sql.query("BEGIN");
  try {
    await sql.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    await assumeService(sql);
    const result = await fn();
    await sql.query("COMMIT");
    return result;
  } catch (error) {
    await sql.query("ROLLBACK");
    throw error;
  }
}

export async function assumeService(sql: SqlClient): Promise<void> {
  try {
    await sql.query("SET LOCAL ROLE app_service");
  } catch (error) {
    const message = error instanceof Error ? error.message : "role change failed";
    throw new Error(`Could not assume app_service. Apply migration 0004. ${message}`);
  }
}
