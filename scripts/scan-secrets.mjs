import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const skip = new Set(["node_modules", ".git", ".next", "coverage", "test-results", "playwright-report"]);
const patterns = [
  { name: "private key", re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "aws access key", re: /AKIA[0-9A-Z]{16}/ },
  { name: "stripe live key", re: /sk_live_[0-9a-zA-Z]{8,}/ },
  { name: "github token", re: /ghp_[0-9A-Za-z]{20,}/ },
  { name: "slack token", re: /xox[baprs]-[0-9A-Za-z-]{10,}/ },
];

const hits = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue;
    const path = join(dir, name);
    const info = statSync(path);
    if (info.isDirectory()) {
      walk(path);
      continue;
    }
    if (info.size > 1_000_000) continue;
    if (/\.(png|jpg|jpeg|webp|gif)$/i.test(name)) continue;
    const text = readFileSync(path, "utf8");
    for (const pattern of patterns) {
      if (pattern.re.test(text)) hits.push(`${path}: ${pattern.name}`);
    }
  }
}

walk(process.cwd());
if (hits.length > 0) {
  console.error(hits.join("\n"));
  process.exit(1);
}
console.log("secret scan: no matches");
