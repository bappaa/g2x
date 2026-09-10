/**
 * DATABASE RESTORE
 * ================
 * A backup you have never restored is not a backup. This makes the drill cheap:
 *
 *   npm run db:restore                       # newest snapshot
 *   npm run db:restore -- g2x-2026-01-05.db  # a specific one
 *
 * Safety rails, because this overwrites live data:
 *   - verifies the snapshot's integrity BEFORE touching anything
 *   - saves the current database to <db>.pre-restore-<stamp> first
 *   - refuses to run unless you pass --yes
 *
 * Stop the app first so nothing writes mid-restore:
 *   sudo systemctl stop g2x && npm run db:restore -- --yes && sudo systemctl start g2x
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@libsql/client";
import { existsSync, readdirSync, statSync, copyFileSync, unlinkSync } from "node:fs";
import { resolve, join, isAbsolute } from "node:path";
import { resolveDbConfig } from "./db-url.mjs";

const DIR = resolve(process.env.BACKUP_DIR || "/var/backups/g2x");

async function main() {
  const args = process.argv.slice(2);
  const confirmed = args.includes("--yes");
  const named = args.find((a) => !a.startsWith("--"));

  const cfg = resolveDbConfig();
  if (cfg.mode !== "local") {
    console.error("[restore] remote libSQL in use — restore via the provider.");
    process.exit(1);
  }
  const dbFile = resolve(cfg.url.replace(/^file:/, ""));

  // Pick the snapshot.
  let snapshot: string;
  if (named) {
    snapshot = isAbsolute(named) ? named : join(DIR, named);
  } else {
    if (!existsSync(DIR)) {
      console.error(`[restore] no backup directory at ${DIR}`);
      process.exit(1);
    }
    const list = readdirSync(DIR)
      .filter((f) => /^g2x-.*\.db$/.test(f))
      .map((f) => ({ f, t: statSync(join(DIR, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    if (!list.length) {
      console.error(`[restore] no snapshots in ${DIR}`);
      process.exit(1);
    }
    snapshot = join(DIR, list[0].f);
  }

  if (!existsSync(snapshot)) {
    console.error(`[restore] snapshot not found: ${snapshot}`);
    process.exit(1);
  }

  // Never restore a corrupt file over a working one.
  const probe = createClient({ url: `file:${snapshot}` });
  const check = await probe.execute("PRAGMA integrity_check");
  const verdict = String((check.rows[0] as Record<string, unknown>)?.integrity_check ?? "");
  if (verdict !== "ok") {
    console.error(`[restore] snapshot FAILED integrity check: ${verdict}`);
    process.exit(1);
  }
  const users = await probe.execute("SELECT COUNT(*) AS n FROM users").catch(() => null);
  const orders = await probe.execute("SELECT COUNT(*) AS n FROM orders").catch(() => null);

  console.log(`[restore] snapshot : ${snapshot}`);
  console.log(`[restore] target   : ${dbFile}`);
  console.log(
    `[restore] contents : ${(users?.rows[0] as { n: number })?.n ?? "?"} users, ` +
      `${(orders?.rows[0] as { n: number })?.n ?? "?"} orders`
  );

  if (!confirmed) {
    console.log("\n[restore] dry run. Re-run with --yes to overwrite the live database.");
    return;
  }

  /**
   * A live -wal means a process still has the database open. Restoring
   * underneath it corrupts both the file and that process's view of it, so
   * stop rather than destroy data.
   */
  if (existsSync(dbFile + "-wal") && !args.includes("--force")) {
    console.error(
      "\n[restore] the database is in use (a -wal file is present).\n" +
        "  Stop the app first:  sudo systemctl stop g2x\n" +
        "  Then re-run.         npm run db:restore -- --yes\n" +
        "  (override with --force only if you are certain nothing is running)"
    );
    process.exit(1);
  }

  // Keep an escape hatch from the state we are about to replace.
  if (existsSync(dbFile)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const safety = `${dbFile}.pre-restore-${stamp}`;
    copyFileSync(dbFile, safety);
    console.log(`[restore] previous database saved to ${safety}`);
  }

  /**
   * Remove the old -wal / -shm BEFORE swapping the file in.
   *
   * These side files belong to the database being replaced. If they survive,
   * SQLite replays that write-ahead log on top of the restored snapshot and the
   * result is "database disk image is malformed" — a corrupt database created
   * by the very command meant to rescue it.
   *
   * They must also be deleted, not renamed-in-place afterwards: the app
   * recreates them the instant it touches the file, so ordering matters.
   */
  for (const ext of ["-wal", "-shm"]) {
    const side = dbFile + ext;
    if (existsSync(side)) {
      unlinkSync(side);
      console.log(`[restore] removed stale ${ext.slice(1).toUpperCase()}`);
    }
  }

  copyFileSync(snapshot, dbFile);

  // Prove the restored file actually opens before declaring success.
  const verify = createClient({ url: `file:${dbFile}` });
  const vc = await verify.execute("PRAGMA integrity_check");
  const vv = String((vc.rows[0] as Record<string, unknown>)?.integrity_check ?? "");
  if (vv !== "ok") {
    console.error(`[restore] restored file FAILED integrity check: ${vv}`);
    process.exit(1);
  }
  const g = await verify.execute("SELECT COUNT(*) AS n FROM games").catch(() => null);
  console.log(
    `[restore] verified OK — ${(g?.rows[0] as { n: number })?.n ?? "?"} games restored.`
  );

  console.log("[restore] done. Start the app: sudo systemctl start g2x");
}

main().catch((e) => {
  console.error("[restore] failed:", e);
  process.exit(1);
});
