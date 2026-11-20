import { z } from "zod";

import type { SqlClient } from "./migrate";
import { assumeService } from "./service-role";

/**
 * A tenant spec is tenant config, so it lives outside git (a file passed on the command line).
 * See docs/examples/tenant-spec.example.json for the shape with placeholder values.
 */
const slug = z.string().regex(/^[a-z][a-z0-9_]{1,62}$/, "lowercase letters, digits, underscores");

export const tenantSpecSchema = z
  .object({
    id: slug,
    name: z.string().min(1).max(200),
    kind: z.enum(["church", "shop", "platform", "business"]),
    timezone: z.string().min(1),
    modules: z.array(z.object({ id: slug, enabled: z.boolean() })).default([]),
    domains: z.array(z.string().regex(/^[a-z0-9.-]+$/)).default([]),
    clerkOrgId: z
      .string()
      .regex(/^org_[A-Za-z0-9]+$/)
      .nullable()
      .default(null),
  })
  .strict();

export type TenantSpec = z.infer<typeof tenantSpecSchema>;

export type ProvisionResult = {
  tenant: "created" | "updated" | "unchanged";
  modules: number;
  domains: number;
  clerkOrg: boolean;
};

export class ProvisionRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProvisionRefusedError";
  }
}

/**
 * Idempotent. One transaction. The tenants row is written by the connecting role (app_service has
 * no grant on tenants). Everything tenant-owned is written as app_service with app.tenant_id bound,
 * so forced RLS checks every row.
 */
export async function provisionTenant(sql: SqlClient, input: unknown): Promise<ProvisionResult> {
  const spec = tenantSpecSchema.parse(input);
  await sql.query("BEGIN");
  try {
    const existing = await sql.query<{ name: string; kind: string; timezone: string }>(
      "SELECT name, kind, timezone FROM tenants WHERE id = $1",
      [spec.id],
    );
    const before = existing.rows[0];
    if (before && before.kind !== spec.kind) {
      throw new ProvisionRefusedError(
        `Tenant ${spec.id} exists with kind ${before.kind}. Refusing to change it to ${spec.kind}.`,
      );
    }
    let tenant: ProvisionResult["tenant"] = "unchanged";
    if (!before) {
      await sql.query("INSERT INTO tenants (id, name, kind, timezone) VALUES ($1, $2, $3, $4)", [
        spec.id,
        spec.name,
        spec.kind,
        spec.timezone,
      ]);
      tenant = "created";
    } else if (before.name !== spec.name || before.timezone !== spec.timezone) {
      await sql.query("UPDATE tenants SET name = $2, timezone = $3 WHERE id = $1", [
        spec.id,
        spec.name,
        spec.timezone,
      ]);
      tenant = "updated";
    }

    await sql.query("SELECT set_config('app.tenant_id', $1, true)", [spec.id]);
    await assumeService(sql);

    for (const module of spec.modules) {
      await sql.query(
        `INSERT INTO tenant_modules (tenant_id, module_id, enabled) VALUES ($1, $2, $3)
         ON CONFLICT (tenant_id, module_id) DO UPDATE SET enabled = EXCLUDED.enabled`,
        [spec.id, module.id, module.enabled],
      );
    }
    for (const host of spec.domains) {
      const owner = await sql.query<{ tenant_id: string }>(
        "SELECT tenant_id FROM tenant_domains WHERE host = $1",
        [host],
      );
      const current = owner.rows[0]?.tenant_id;
      if (current && current !== spec.id) {
        throw new ProvisionRefusedError(`Host ${host} already belongs to another tenant.`);
      }
      if (!current)
        await sql.query("INSERT INTO tenant_domains (host, tenant_id) VALUES ($1, $2)", [host, spec.id]);
    }
    if (spec.clerkOrgId) {
      const mapped = await sql.query<{ tenant_id: string }>(
        "SELECT tenant_id FROM tenant_auth_orgs WHERE provider = 'clerk' AND external_org_id = $1",
        [spec.clerkOrgId],
      );
      const current = mapped.rows[0]?.tenant_id;
      if (current && current !== spec.id) {
        throw new ProvisionRefusedError("That Clerk organization already belongs to another tenant.");
      }
      if (!current) {
        await sql.query(
          "INSERT INTO tenant_auth_orgs (provider, external_org_id, tenant_id) VALUES ('clerk', $1, $2)",
          [spec.clerkOrgId, spec.id],
        );
      }
    }
    await sql.query("COMMIT");
    return {
      tenant,
      modules: spec.modules.length,
      domains: spec.domains.length,
      clerkOrg: spec.clerkOrgId !== null,
    };
  } catch (error) {
    await sql.query("ROLLBACK");
    throw error;
  }
}
