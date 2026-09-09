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

  // --- Phase 16: usernames -------------------------------------------------
  `ALTER TABLE users ADD COLUMN username TEXT`,
  `ALTER TABLE users ADD COLUMN username_changes INTEGER NOT NULL DEFAULT 0`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)`,

  // --- Phase 16: 7-day escrow auto-release ---------------------------------
  `ALTER TABLE orders ADD COLUMN delivered_at TEXT`,
  `ALTER TABLE orders ADD COLUMN release_at TEXT`,
  `ALTER TABLE orders ADD COLUMN released INTEGER NOT NULL DEFAULT 0`,
  `CREATE INDEX IF NOT EXISTS idx_orders_release ON orders(released, release_at)`,

  // --- Phase 16: chat attachments + in-thread disputes ---------------------
  `ALTER TABLE messages ADD COLUMN kind TEXT NOT NULL DEFAULT 'text'`,
  `ALTER TABLE messages ADD COLUMN attachment_name TEXT`,
  `ALTER TABLE messages ADD COLUMN attachment_type TEXT`,
  `ALTER TABLE messages ADD COLUMN attachment_size INTEGER`,
  `ALTER TABLE messages ADD COLUMN attachment_data TEXT`,
  `ALTER TABLE messages ADD COLUMN dispute_id TEXT`,
  `ALTER TABLE threads ADD COLUMN dispute_id TEXT`,
  `ALTER TABLE disputes ADD COLUMN thread_id TEXT`,

  // --- Phase 18: split wallet -------------------------------------------
  // `balance` stays the single spendable number. `withdrawable` tracks how
  // much of it came from seller earnings — topped-up money can be spent but
  // never cashed out, which stops the wallet being used to launder a card.
  `ALTER TABLE users ADD COLUMN withdrawable REAL NOT NULL DEFAULT 0`,

  // --- Phase 18: subscription drip-release --------------------------------
  `ALTER TABLE products ADD COLUMN sub_months INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE offers ADD COLUMN sub_months INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE order_items ADD COLUMN sub_months INTEGER NOT NULL DEFAULT 0`,
  `CREATE TABLE IF NOT EXISTS subscription_schedule (
     id TEXT PRIMARY KEY,
     order_id TEXT NOT NULL,
     order_item_id TEXT NOT NULL,
     seller_id TEXT NOT NULL,
     buyer_id TEXT NOT NULL,
     month_no INTEGER NOT NULL,
     months_total INTEGER NOT NULL,
     amount REAL NOT NULL,
     due_at TEXT NOT NULL,
     released INTEGER NOT NULL DEFAULT 0,
     released_at TEXT,
     created_at TEXT DEFAULT (datetime('now'))
   )`,
  `CREATE INDEX IF NOT EXISTS idx_sub_due ON subscription_schedule(released, due_at)`,
  `CREATE INDEX IF NOT EXISTS idx_sub_order ON subscription_schedule(order_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_sub_item_month
     ON subscription_schedule(order_item_id, month_no)`,

  // --- Phase 18: dispute chat + 10-day media retention --------------------
  `ALTER TABLE dispute_messages ADD COLUMN kind TEXT NOT NULL DEFAULT 'text'`,
  `ALTER TABLE dispute_messages ADD COLUMN attachment_name TEXT`,
  `ALTER TABLE dispute_messages ADD COLUMN attachment_type TEXT`,
  `ALTER TABLE dispute_messages ADD COLUMN attachment_size INTEGER`,
  `ALTER TABLE dispute_messages ADD COLUMN attachment_data TEXT`,
  `ALTER TABLE dispute_messages ADD COLUMN purged INTEGER NOT NULL DEFAULT 0`,
  `CREATE INDEX IF NOT EXISTS idx_dmsg_dispute ON dispute_messages(dispute_id, created_at)`,
  `ALTER TABLE messages ADD COLUMN purged INTEGER NOT NULL DEFAULT 0`,

  // --- Phase 19: admin-configurable offer wizard --------------------------
  // Each category describes its own "create offer" flow, so the admin decides
  // what a seller must supply per category without a code change.
  `ALTER TABLE categories ADD COLUMN sell_notice TEXT`,
  `ALTER TABLE categories ADD COLUMN sell_notice_title TEXT`,
  `ALTER TABLE categories ADD COLUMN unit_label TEXT`,
  `ALTER TABLE categories ADD COLUMN needs_title INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE categories ADD COLUMN needs_images INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE categories ADD COLUMN needs_credentials INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE categories ADD COLUMN needs_quantity INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE categories ADD COLUMN allow_volume_discount INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE categories ADD COLUMN commission_pct REAL`,
  // Volume discounts + account credential sets live as JSON on the offer.
  `ALTER TABLE offers ADD COLUMN volume_discounts TEXT`,
  `ALTER TABLE offers ADD COLUMN accounts_data TEXT`,
  `ALTER TABLE offers ADD COLUMN images TEXT`,
  `ALTER TABLE offers ADD COLUMN description TEXT`,
  `ALTER TABLE offers ADD COLUMN min_qty INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE offers ADD COLUMN auto_delivery INTEGER NOT NULL DEFAULT 1`,

  // --- Phase 20: per-PRODUCT sell-flow overrides --------------------------
  // Category defaults were too blunt: a Crunchyroll subscription and a game
  // account both live under one category yet need completely different fields.
  // NULL on any of these means "inherit the category setting", so existing
  // products keep working untouched.
  `ALTER TABLE products ADD COLUMN needs_title INTEGER`,
  `ALTER TABLE products ADD COLUMN needs_images INTEGER`,
  `ALTER TABLE products ADD COLUMN needs_credentials INTEGER`,
  `ALTER TABLE products ADD COLUMN needs_quantity INTEGER`,
  `ALTER TABLE products ADD COLUMN allow_volume_discount INTEGER`,
  `ALTER TABLE products ADD COLUMN unit_label TEXT`,
  `ALTER TABLE products ADD COLUMN commission_pct REAL`,
  // Which fulfilment modes the seller may pick for THIS product.
  //   'both' | 'auto' | 'manual'
  `ALTER TABLE products ADD COLUMN fulfilment TEXT`,
  // Toggle individual blocks off for products that do not need them.
  `ALTER TABLE products ADD COLUMN show_delivery_method INTEGER`,
  `ALTER TABLE products ADD COLUMN show_region INTEGER`,
  `ALTER TABLE products ADD COLUMN show_platform INTEGER`,
  `ALTER TABLE products ADD COLUMN show_login_method INTEGER`,
  `ALTER TABLE products ADD COLUMN sell_notice TEXT`,

  // Same switches at category level, so a whole category can hide a block.
  `ALTER TABLE categories ADD COLUMN fulfilment TEXT`,
  `ALTER TABLE categories ADD COLUMN show_delivery_method INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE categories ADD COLUMN show_region INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE categories ADD COLUMN show_platform INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE categories ADD COLUMN show_login_method INTEGER NOT NULL DEFAULT 1`,
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
