/**
 * Provision one tenant from a spec file kept outside git.
 *
 *   node --import tsx server/scripts/provision-tenant.ts --spec /secure/path/tenant.json            # dry run
 *   PROVISION_CONFIRM_DATABASE=<db name> node --import tsx server/scripts/provision-tenant.ts --spec ... --apply
 *
 * Reads DATABASE_URL or POSTGRES_URL. Never prints the URL. Run migrations first (server/scripts/seed.ts
 * or the migrate step). --apply refuses unless PROVISION_CONFIRM_DATABASE names the database you meant.
 */
import { readFileSync } from "node:fs";

import { clientSql, createPool } from "../src/db-pool.ts";
import { databaseUrl } from "../src/persist.ts";
import { provisionTenant, tenantSpecSchema } from "../src/provision.ts";

const args = process.argv.slice(2);
const specIndex = args.indexOf("--spec");
const specPath = specIndex >= 0 ? args[specIndex + 1] : undefined;
const apply = args.includes("--apply");

if (!specPath) {
  process.stderr.write("Pass --spec <path to tenant JSON>. Keep that file out of git.\n");
  process.exit(1);
}

const spec = tenantSpecSchema.parse(JSON.parse(readFileSync(specPath, "utf8")));
process.stdout.write(
  `Tenant ${spec.id} (${spec.kind}): ${spec.modules.length} modules, ${spec.domains.length} domains, ` +
    `Clerk org ${spec.clerkOrgId ? "set" : "not set"}.\n`,
);
if (!apply) {
  process.stdout.write("Dry run. Nothing was written. Add --apply to write.\n");
  process.exit(0);
}

const url = databaseUrl();
if (!url) {
  process.stderr.write("Set DATABASE_URL or POSTGRES_URL.\n");
  process.exit(1);
}

const pool = createPool(url, 1);
const client = await pool.connect();
try {
  const sql = clientSql(client);
  const db = await sql.query<{ name: string }>("SELECT current_database() AS name");
  const name = db.rows[0]?.name ?? "";
  if (process.env.PROVISION_CONFIRM_DATABASE !== name) {
    process.stderr.write(
      `Refusing to write. Set PROVISION_CONFIRM_DATABASE to the target database name (${name}) to confirm.\n`,
    );
    process.exitCode = 1;
  } else {
    const result = await provisionTenant(sql, spec);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  }
} finally {
  client.release();
  await pool.end();
}
