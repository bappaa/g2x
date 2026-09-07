import "server-only";
import { db } from "./db";

/**
 * RUNTIME SCHEMA GUARD
 * ====================
 * Additive migrations are applied by `npm run db:migrate`, which runs against
 * whichever database the CLI is pointed at. That is easy to forget for the
 * hosted Turso instance: the code ships via git, the schema does not, and the
 * first request that touches a new column throws a server-side exception
 * (the "Digest: …" page) instead of anything actionable.
 *
 * This module closes that gap. On the first DB-touching request in a process
 * it applies the small set of *additive, idempotent* statements below —
 * columns and indexes only, never a drop or a rewrite — so a freshly deployed
 * build repairs its own database instead of erroring.
 *
 * It is NOT a replacement for the migration script. It is a safety net for the
 * handful of columns whose absence is fatal, and it is deliberately cheap:
 * one probe query, then a cached no-op for the rest of the process lifetime.
 */

/** Additive statements, safe to run repeatedly. */
const PATCHES: string[] = [
  `ALTER TABLE transactions ADD COLUMN idem_key TEXT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_txn_idem ON transactions(idem_key)`,
  `ALTER TABLE users ADD COLUMN kyc_due_at TEXT`,
  `ALTER TABLE users ADD COLUMN kyc_due_reason TEXT`,
  `CREATE INDEX IF NOT EXISTS idx_users_kyc_due ON users(kyc_due_at)`,
];

/**
 * Errors that mean "already applied". SQLite has no
 * `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, so a duplicate column is the
 * expected outcome on every run after the first.
 */
function benign(message: string): boolean {
  return /duplicate column|already exists/i.test(message);
}

let done: Promise<void> | null = null;

async function apply(): Promise<void> {
  for (const sql of PATCHES) {
    try {
      await db.execute(sql);
    } catch (e) {
      const msg = String((e as Error)?.message ?? "");
      if (benign(msg)) continue;
      // Anything else is logged but never thrown: a schema-repair failure must
      // not take down a request that might not even need the new column.
      console.warn(`[ensure-schema] skipped: ${sql.slice(0, 60)} — ${msg.slice(0, 120)}`);
    }
  }
}

/**
 * Idempotent, concurrency-safe, once per process.
 * Awaiting this from several requests at once runs the patches a single time.
 */
export function ensureSchema(): Promise<void> {
  if (!done) {
    done = apply().catch(() => {
      // Never cache a rejection — let a later request retry.
      done = null;
    }) as Promise<void>;
  }
  return done;
}
