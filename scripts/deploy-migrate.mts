/**
 * Deploy-time schema repair.
 *
 * Git deploys do not run migrations, so a release that adds a column reaches a
 * database that does not have it yet — which is exactly how the seller "New
 * offer" page started returning a server-side exception in production.
 *
 * This applies the same additive `PATCHES` the runtime guard uses, but *before*
 * any traffic arrives. `ensure-schema.ts` is marked `server-only`, so it cannot
 * be imported from a plain script; the statement list is parsed out of the file
 * instead, which keeps a single source of truth.
 *
 * Deliberately non-fatal: if the database is unreachable at build time (or the
 * env vars are not set, as in a preview build), the deploy still succeeds and
 * the runtime guard repairs the schema on the first request.
 */
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { createClient } from "@libsql/client";

config({ path: ".env.local" });

/** Pull the SQL statements out of `PATCHES` without importing the module. */
function patches(): string[] {
  const src = readFileSync("src/lib/ensure-schema.ts", "utf8");
  const body = src.split("const PATCHES: string[] = [")[1]?.split("\n];")[0] ?? "";
  const out: string[] = [];
  let cur = "";
  for (const line of body.split("\n")) {
    const t = line.trim();
    if (!cur && t.startsWith("//")) continue;
    if (!cur && t.startsWith("`")) cur = t;
    else if (cur) cur += "\n" + t;
    if (cur && /`,?$/.test(cur.trim())) {
      out.push(cur.trim().replace(/^`/, "").replace(/`,?$/, ""));
      cur = "";
    }
  }
  return out;
}

const benign = (m: string) => /duplicate column|already exists/i.test(m);

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    console.log("[deploy-migrate] no TURSO_DATABASE_URL — skipping (runtime guard will handle it).");
    return;
  }

  const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  const list = patches();
  let applied = 0;
  let present = 0;
  let failed = 0;

  for (const sql of list) {
    try {
      await db.execute(sql);
      applied++;
    } catch (e) {
      const msg = String((e as Error)?.message ?? "");
      if (benign(msg)) present++;
      else {
        failed++;
        console.warn(`[deploy-migrate] skipped: ${sql.slice(0, 60)} — ${msg.slice(0, 120)}`);
      }
    }
  }

  console.log(
    `[deploy-migrate] ${list.length} statements: ${applied} applied, ${present} already present, ${failed} skipped.`
  );
}

main().catch((e) => {
  console.warn("[deploy-migrate] skipped:", String((e as Error)?.message ?? "").slice(0, 200));
  process.exit(0);
});
