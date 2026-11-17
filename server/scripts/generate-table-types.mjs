import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "migrations");
const sql = readdirSync(dir)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => readFileSync(join(dir, name), "utf8"))
  .join("\n");

const typeMap = {
  text: "string",
  integer: "number",
  boolean: "boolean",
  timestamptz: "string",
};

const tables = [];
const pattern = /CREATE TABLE(?: IF NOT EXISTS)? ([a-z_]+) \(([^;]+?)\);/g;
for (const match of sql.matchAll(pattern)) {
  const name = match[1];
  const columns = [];
  for (const rawLine of match[2].split("\n")) {
    const line = rawLine.trim().replace(/,$/, "");
    if (!line || line.startsWith("PRIMARY") || line.startsWith("CHECK") || line.startsWith("CONSTRAINT")) continue;
    const parts = line.split(/\s+/);
    const column = parts[0];
    const sqlType = parts[1]?.toLowerCase();
    if (!column || !sqlType || !typeMap[sqlType]) continue;
    columns.push({ column, ts: typeMap[sqlType] });
  }
  tables.push({ name, columns });
}

function pascal(name) {
  return name
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

const chunks = [
  "// Generated from server/migrations by server/scripts/generate-table-types.mjs. Do not edit.",
  "",
  `export const tableNames = ${JSON.stringify(tables.map((table) => table.name))} as const;`,
  "",
  "export type TableName = (typeof tableNames)[number];",
  "",
];
for (const table of tables) {
  chunks.push(`export type ${pascal(table.name)}Row = {`);
  for (const column of table.columns) {
    const optional = column.column.endsWith("_id") && column.column !== "id" ? "" : "";
    chunks.push(`  ${column.column}: ${column.ts}${optional};`);
  }
  chunks.push("};", "");
}
const out = chunks.join("\n");
const target = join(root, "src/generated/tables.ts");
if (process.argv.includes("--check")) {
  const current = readFileSync(target, "utf8");
  if (current !== out) {
    console.error("generated table types are stale. Run node server/scripts/generate-table-types.mjs");
    process.exit(1);
  }
} else {
  writeFileSync(target, out);
  console.log(`wrote ${tables.length} tables`);
}
