import { decryptString, encryptString, tenantDataKey } from "./crypto";
import type { SqlClient } from "./migrate";

export type StoredCredential = {
  provider: string;
  last4: string;
  keyId: string;
  mode: string;
};

/**
 * Writes a tenant secret encrypted with that tenant's data key.
 * The plaintext is not stored. Adapters call readTenantSecret and refuse the
 * live call when this returns null.
 */
export async function saveTenantSecret(
  sql: SqlClient,
  input: { tenantId: string; provider: string; plaintext: string; platformKey: Buffer; connectedBy: string },
): Promise<void> {
  const key = tenantDataKey(input.platformKey, input.tenantId);
  const ciphertext = encryptString(input.plaintext, key);
  const last4 = input.plaintext.slice(-4);
  await sql.query(
    `INSERT INTO tenant_integrations
       (tenant_id, provider, mode, credentials_ciphertext, key_id, last4, connected_by, connected_at, revoked_at)
     VALUES ($1, $2, 'connected', $3, 'tenant', $4, $5, now(), NULL)
     ON CONFLICT (tenant_id, provider) DO UPDATE
       SET mode = 'connected',
           credentials_ciphertext = EXCLUDED.credentials_ciphertext,
           key_id = 'tenant',
           last4 = EXCLUDED.last4,
           connected_by = EXCLUDED.connected_by,
           connected_at = now(),
           revoked_at = NULL`,
    [input.tenantId, input.provider, ciphertext, last4, input.connectedBy],
  );
}

export async function readTenantSecret(
  sql: SqlClient,
  input: { tenantId: string; provider: string; platformKey: Buffer },
): Promise<string | null> {
  const found = await sql.query<{ credentials_ciphertext: string | null; key_id: string; mode: string }>(
    `SELECT credentials_ciphertext, key_id, mode
     FROM tenant_integrations
     WHERE tenant_id = $1 AND provider = $2 AND revoked_at IS NULL`,
    [input.tenantId, input.provider],
  );
  const row = found.rows[0];
  if (!row?.credentials_ciphertext || row.mode === "dry_run") return null;
  const key = row.key_id === "tenant" ? tenantDataKey(input.platformKey, input.tenantId) : input.platformKey;
  return decryptString(row.credentials_ciphertext, key);
}

export async function connectedProviders(sql: SqlClient, tenantId: string): Promise<Set<string>> {
  const found = await sql.query<{ provider: string }>(
    `SELECT provider FROM tenant_integrations
     WHERE tenant_id = $1 AND revoked_at IS NULL AND credentials_ciphertext IS NOT NULL AND mode = 'connected'`,
    [tenantId],
  );
  return new Set(found.rows.map((row) => row.provider));
}

/** Test double. It sends only when the tenant secret decrypts. */
export function fakeEmailAdapter(sql: SqlClient, tenantId: string, platformKey: Buffer) {
  return {
    id: "fake-email",
    implemented: true as const,
    async send(message: string): Promise<{ delivered: boolean; reason: "dry_run" | "sent" }> {
      const secret = await readTenantSecret(sql, { tenantId, provider: "fake-email", platformKey });
      if (!secret) return { delivered: false, reason: "dry_run" };
      if (!message) return { delivered: false, reason: "dry_run" };
      return { delivered: true, reason: "sent" };
    },
  };
}
