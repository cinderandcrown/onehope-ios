import type { SqlClient } from "./migrate";

export type OutboxJob = {
  id: string;
  tenantId: string;
  jobName: string;
  idempotencyKey: string;
  payload: string;
  status: string;
  attempts: number;
};

/**
 * Durable side effects. Call inside a transaction that has already SET ROLE
 * app_service and set app.tenant_id. Duplicate idempotency keys return the
 * existing job and do not run the work twice.
 */
export async function enqueueJob(
  sql: SqlClient,
  input: { tenantId: string; jobName: string; idempotencyKey: string; payload: unknown },
): Promise<{ id: string; created: boolean }> {
  const id = `job_${input.idempotencyKey.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40)}_${input.tenantId}`;
  const inserted = await sql.query<{ id: string }>(
    `INSERT INTO outbox_jobs (id, tenant_id, job_name, idempotency_key, payload)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (tenant_id, idempotency_key) DO NOTHING
     RETURNING id`,
    [id, input.tenantId, input.jobName, input.idempotencyKey, JSON.stringify(input.payload)],
  );
  const created = inserted.rows[0];
  if (created) return { id: created.id, created: true };
  const existing = await sql.query<{ id: string }>(
    `SELECT id FROM outbox_jobs WHERE tenant_id = $1 AND idempotency_key = $2`,
    [input.tenantId, input.idempotencyKey],
  );
  const row = existing.rows[0];
  if (!row) throw new Error("Outbox job was not stored.");
  return { id: row.id, created: false };
}

export async function claimJobs(sql: SqlClient, tenantId: string, limit: number): Promise<OutboxJob[]> {
  const claimed = await sql.query<{
    id: string;
    tenant_id: string;
    job_name: string;
    idempotency_key: string;
    payload: string;
    status: string;
    attempts: number;
  }>(
    `UPDATE outbox_jobs SET status = 'running', attempts = attempts + 1, updated_at = now()
     WHERE tenant_id = $1 AND id IN (
       SELECT id FROM outbox_jobs
       WHERE tenant_id = $1 AND status IN ('pending', 'failed') AND available_at <= now()
       ORDER BY created_at
       FOR UPDATE SKIP LOCKED
       LIMIT $2
     )
     RETURNING id, tenant_id, job_name, idempotency_key, payload, status, attempts`,
    [tenantId, limit],
  );
  return claimed.rows.map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    jobName: row.job_name,
    idempotencyKey: row.idempotency_key,
    payload: row.payload,
    status: row.status,
    attempts: Number(row.attempts),
  }));
}

export async function finishJob(
  sql: SqlClient,
  input: { tenantId: string; id: string; status: "succeeded" | "failed"; error?: string },
): Promise<void> {
  await sql.query(
    `UPDATE outbox_jobs
     SET status = $3, last_error = $4, updated_at = now(),
         available_at = CASE WHEN $3 = 'failed' THEN now() ELSE available_at END
     WHERE tenant_id = $1 AND id = $2`,
    [input.tenantId, input.id, input.status, input.error ?? null],
  );
}

export async function recordWebhook(
  sql: SqlClient,
  input: { tenantId: string; provider: string; eventId: string; payload: unknown },
): Promise<{ duplicate: boolean }> {
  const inserted = await sql.query<{ id: string }>(
    `INSERT INTO webhook_inbox (id, tenant_id, provider, event_id, payload)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (tenant_id, provider, event_id) DO NOTHING
     RETURNING id`,
    [`wh_${input.provider}_${input.eventId}`, input.tenantId, input.provider, input.eventId, JSON.stringify(input.payload)],
  );
  return { duplicate: inserted.rows.length === 0 };
}
