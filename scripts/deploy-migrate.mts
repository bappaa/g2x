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
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { resolveDbConfig } from "./db-url.mjs";
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
  /**
   * Always migrate.
   *
   * This used to bail out unless TURSO_DATABASE_URL was set, which was correct
   * for Netlify but wrong on a VPS: the local database would silently never be
   * migrated, and the app would only self-repair on the first request that
   * happened to need a new column.
   */
  const cfg = resolveDbConfig();
  console.log(`[deploy-migrate] target: ${cfg.url}`);

  // Make sure the directory exists — /var/lib/g2x on a fresh box.
  if (cfg.url.startsWith("file:")) {
    const file = cfg.url.slice("file:".length);
    const dir = dirname(resolve(file));
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      console.log(`[deploy-migrate] created ${dir}`);
    }
  }

  const db = cfg.authToken
    ? createClient({ url: cfg.url, authToken: cfg.authToken })
    : createClient({ url: cfg.url });
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
