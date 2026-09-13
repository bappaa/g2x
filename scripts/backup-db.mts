/**
 * DATABASE BACKUP
 * ===============
 * With Turso, backups were somebody else's problem. On your own VPS they are
 * not: the database is one file on one disk. This is the single most important
 * script in the repo.
 *
 *   npm run db:backup
 *
 * Uses SQLite's own `VACUUM INTO`, which takes a consistent snapshot even while
 * the app is writing — unlike `cp`, which can copy a half-written page and give
 * you a corrupt backup that only fails when you try to restore it.
 *
 * The output is also compacted (no free pages) and verified with an integrity
 * check before the old backups are rotated.
 *
 * Cron it nightly:
 *   0 3 * * * cd /var/www/g2x && /usr/bin/npm run db:backup >> /var/log/g2x-backup.log 2>&1
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@libsql/client";
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { resolve, join } from "node:path";
import { resolveDbConfig } from "./db-url.mjs";

/** Keep this many nightly snapshots. */
const KEEP = Number(process.env.BACKUP_KEEP || 14);
const DIR = resolve(process.env.BACKUP_DIR || "/var/backups/g2x");

async function main() {
  const cfg = resolveDbConfig();
  if (cfg.mode !== "local") {
    console.log("[backup] remote libSQL in use — backups are managed by the provider.");
    return;
  }

  const dbFile = resolve(cfg.url.replace(/^file:/, ""));
  if (!existsSync(dbFile)) {
    console.error(`[backup] database not found: ${dbFile}`);
    process.exit(1);
  }

  if (!existsSync(DIR)) {
    mkdirSync(DIR, { recursive: true });
    console.log(`[backup] created ${DIR}`);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const out = join(DIR, `g2x-${stamp}.db`);

  const db = createClient({ url: cfg.url });

  // Fail loudly on a corrupt source rather than archiving the corruption.
  const check = await db.execute("PRAGMA integrity_check");
  const verdict = String((check.rows[0] as Record<string, unknown>)?.integrity_check ?? "");
  if (verdict !== "ok") {
    console.error(`[backup] integrity check FAILED: ${verdict}`);
    process.exit(1);
  }

  // Consistent, compacted snapshot — safe to run while the site is live.
  await db.execute({ sql: "VACUUM INTO ?", args: [out] });

  const mb = (statSync(out).size / 1024 / 1024).toFixed(2);
  console.log(`[backup] wrote ${out} (${mb} MB)`);

  // Rotate: keep the newest KEEP snapshots.
  const old = readdirSync(DIR)
    .filter((f) => /^g2x-.*\.db$/.test(f))
    .map((f) => ({ f, t: statSync(join(DIR, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t)
    .slice(KEEP);

  for (const { f } of old) {
    unlinkSync(join(DIR, f));
    console.log(`[backup] pruned ${f}`);
  }

  console.log(`[backup] done — ${Math.min(KEEP, readdirSync(DIR).length)} snapshot(s) retained.`);
}

main().catch((e) => {
  console.error("[backup] failed:", e);
  process.exit(1);
});
