/**
 * Verifies lib/permissions/keys.ts and supabase/seed/0001_permissions.sql
 * contain exactly the same permission keys. Exits non-zero on drift.
 */
import { readFileSync } from "node:fs";

const seed = readFileSync("supabase/seed/0001_permissions.sql", "utf8");
const ts = readFileSync("lib/permissions/keys.ts", "utf8");

const seedKeys = new Set(
  [...seed.matchAll(/^\s*\('([a-z0-9_.]+)',/gm)].map((m) => m[1]),
);
const tsKeys = new Set(
  [...ts.matchAll(/: "([a-z0-9_.]+)",/g)].map((m) => m[1]),
);

const missingInTs = [...seedKeys].filter((k) => !tsKeys.has(k));
const missingInSeed = [...tsKeys].filter((k) => !seedKeys.has(k));

if (missingInTs.length || missingInSeed.length) {
  if (missingInTs.length)
    console.error("In seed but missing from keys.ts:", missingInTs);
  if (missingInSeed.length)
    console.error("In keys.ts but missing from seed:", missingInSeed);
  process.exit(1);
}
console.log(`Permission catalogue in sync (${seedKeys.size} keys).`);
