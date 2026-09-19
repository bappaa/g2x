/**
 * ADDITIVE SCHEMA PATCHES — single source of truth.
 *
 * These columns/indexes are added after the base schema. They live here as
 * plain data so BOTH callers use the identical list:
 *
 *   - src/lib/ensure-schema.ts  (runtime guard, inside the app)
 *   - scripts/deploy-migrate.mts + every seeder (CLI, outside the app)
 *
 * They used to exist only inside the `server-only` module, which meant CLI
 * scripts could not see them: `npm run db:sellflow` would fail with
 * "no such column: unit_label" on a database that had only been through
 * `db:seed` + `db:migrate`. Keeping one shared list makes that impossible.
 *
 * Every statement must be additive and idempotent — columns and indexes only,
 * never a drop or a rewrite.
 */
export const PATCHES = [
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

  // --- Phase 18: split wallet ---------------------------------------------
  // `balance` stays the single spendable number. `withdrawable` tracks how
  // much of it came from seller earnings — topped-up money can be spent but
  // never cashed out.
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
  `ALTER TABLE categories ADD COLUMN sell_notice TEXT`,
  `ALTER TABLE categories ADD COLUMN sell_notice_title TEXT`,
  `ALTER TABLE categories ADD COLUMN unit_label TEXT`,
  `ALTER TABLE categories ADD COLUMN needs_title INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE categories ADD COLUMN needs_images INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE categories ADD COLUMN needs_credentials INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE categories ADD COLUMN needs_quantity INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE categories ADD COLUMN allow_volume_discount INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE categories ADD COLUMN commission_pct REAL`,
  `ALTER TABLE offers ADD COLUMN volume_discounts TEXT`,
  `ALTER TABLE offers ADD COLUMN accounts_data TEXT`,
  `ALTER TABLE offers ADD COLUMN images TEXT`,
  `ALTER TABLE offers ADD COLUMN description TEXT`,
  `ALTER TABLE offers ADD COLUMN min_qty INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE offers ADD COLUMN auto_delivery INTEGER NOT NULL DEFAULT 1`,

  // --- Phase 20: per-PRODUCT sell-flow overrides --------------------------
  // NULL means "inherit the category setting".
  `ALTER TABLE products ADD COLUMN needs_title INTEGER`,
  `ALTER TABLE products ADD COLUMN needs_images INTEGER`,
  `ALTER TABLE products ADD COLUMN needs_credentials INTEGER`,
  `ALTER TABLE products ADD COLUMN needs_quantity INTEGER`,
  `ALTER TABLE products ADD COLUMN allow_volume_discount INTEGER`,
  `ALTER TABLE products ADD COLUMN unit_label TEXT`,
  `ALTER TABLE products ADD COLUMN commission_pct REAL`,
  `ALTER TABLE products ADD COLUMN fulfilment TEXT`,
  `ALTER TABLE products ADD COLUMN show_delivery_method INTEGER`,
  `ALTER TABLE products ADD COLUMN show_region INTEGER`,
  `ALTER TABLE products ADD COLUMN show_platform INTEGER`,
  `ALTER TABLE products ADD COLUMN show_login_method INTEGER`,
  `ALTER TABLE products ADD COLUMN sell_notice TEXT`,
  `ALTER TABLE categories ADD COLUMN fulfilment TEXT`,
  `ALTER TABLE categories ADD COLUMN show_delivery_method INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE categories ADD COLUMN show_region INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE categories ADD COLUMN show_platform INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE categories ADD COLUMN show_login_method INTEGER NOT NULL DEFAULT 1`,

  // --- Phase 25: automatic delivery for one-of-a-kind listings ------------
  // Accounts and Boosting live in `listings`, which had no way to carry the
  // seller's pre-filled credentials — so an account sold as "Automatic" was
  // silently handled as manual while subscriptions (which use `offers`) worked.
  `ALTER TABLE listings ADD COLUMN auto_delivery INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE listings ADD COLUMN accounts_data TEXT`,
  `ALTER TABLE listings ADD COLUMN images TEXT`,
  `ALTER TABLE listings ADD COLUMN delivery_method TEXT`,
  `ALTER TABLE listings ADD COLUMN instructions TEXT`,
  `ALTER TABLE listings ADD COLUMN min_qty INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE listings ADD COLUMN custom_fields TEXT`,

  // --- Phase 25: user avatars ---------------------------------------------
  // Stored as a data URI so it works on any host with no writable disk.
  `ALTER TABLE users ADD COLUMN avatar TEXT`,

  // --- Phase 27: email verification (OTP) ---------------------------------
  // Anyone could sign up with an address they did not control. Existing
  // accounts are grandfathered in as verified so nobody is locked out.
  `ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0`,
  `UPDATE users SET email_verified = 1 WHERE email_verified = 0`,
  `CREATE TABLE IF NOT EXISTS email_otps (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL,
     email TEXT NOT NULL,
     code_hash TEXT NOT NULL,
     purpose TEXT NOT NULL DEFAULT 'verify',
     attempts INTEGER NOT NULL DEFAULT 0,
     expires_at TEXT NOT NULL,
     consumed_at TEXT,
     created_at TEXT DEFAULT (datetime('now'))
   )`,
  `CREATE INDEX IF NOT EXISTS idx_otp_user ON email_otps(user_id, purpose)`,

  // --- Phase 27 fix: Google users are already verified by Google ---
  `UPDATE users SET email_verified=1 WHERE provider='google' AND email_verified=0`,

  // --- Phase 28: seller contact links (optional whatsapp/telegram/discord) ---
  `ALTER TABLE seller_profiles ADD COLUMN whatsapp TEXT`,
  `ALTER TABLE seller_profiles ADD COLUMN telegram TEXT`,
  `ALTER TABLE seller_profiles ADD COLUMN discord TEXT`,

  // --- Phase 36: game-specific cascading offer fields (Region -> Realm -> Faction etc) ---
  `CREATE TABLE IF NOT EXISTS game_offer_fields (
     id TEXT PRIMARY KEY,
     game_slug TEXT NOT NULL,
     field_key TEXT NOT NULL,
     label TEXT NOT NULL,
     field_type TEXT NOT NULL DEFAULT 'dropdown',
     options TEXT,
     parent_field TEXT,
     parent_value TEXT,
     sort_order INTEGER NOT NULL DEFAULT 0,
     required INTEGER NOT NULL DEFAULT 1,
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   )`,
  `CREATE INDEX IF NOT EXISTS idx_game_offer_fields_game ON game_offer_fields(game_slug)`,
  `CREATE INDEX IF NOT EXISTS idx_game_offer_fields_parent ON game_offer_fields(game_slug, parent_field)`,
  `CREATE TABLE IF NOT EXISTS game_category_images (
     id TEXT PRIMARY KEY,
     game_slug TEXT NOT NULL,
     category_slug TEXT NOT NULL,
     image TEXT NOT NULL,
     created_at TEXT NOT NULL DEFAULT (datetime('now')),
     UNIQUE(game_slug, category_slug)
   )`,
  `CREATE INDEX IF NOT EXISTS idx_gci_game ON game_category_images(game_slug)`,

  // --- Phase 45: Razorpay automated payments ---
  `ALTER TABLE payment_gateways ADD COLUMN config TEXT`,
  `ALTER TABLE orders ADD COLUMN razorpay_order_id TEXT`,
  `ALTER TABLE orders ADD COLUMN razorpay_payment_id TEXT`,
  `ALTER TABLE orders ADD COLUMN razorpay_signature TEXT`,
  `ALTER TABLE transactions ADD COLUMN razorpay_order_id TEXT`,
  `ALTER TABLE transactions ADD COLUMN razorpay_payment_id TEXT`,
  `CREATE TABLE IF NOT EXISTS razorpay_intents (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL,
     razorpay_order_id TEXT NOT NULL UNIQUE,
     amount REAL NOT NULL,
     currency TEXT NOT NULL DEFAULT 'INR',
     purpose TEXT NOT NULL DEFAULT 'checkout',
     status TEXT NOT NULL DEFAULT 'created',
     gateway_code TEXT NOT NULL DEFAULT 'razorpay',
     meta TEXT,
     created_at TEXT NOT NULL DEFAULT (datetime('now')),
     verified_at TEXT
   )`,
  `CREATE INDEX IF NOT EXISTS idx_rzp_user ON razorpay_intents(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_rzp_order ON razorpay_intents(razorpay_order_id)`,

  // --- Phase 46 hotfix: seller orders crash oi.created_at missing ---
  `ALTER TABLE order_items ADD COLUMN created_at TEXT`,
  `ALTER TABLE order_items ADD COLUMN opt_region TEXT`,
  `ALTER TABLE order_items ADD COLUMN opt_delivery TEXT`,
  `ALTER TABLE cart_items ADD COLUMN opt_region TEXT`,
  `ALTER TABLE cart_items ADD COLUMN opt_delivery TEXT`,
];

/** Errors that mean "already applied" — expected on every run after the first. */
export const isBenignSchemaError = (message) =>
  /duplicate column|already exists/i.test(String(message ?? ""));

/**
 * Apply every patch against a libSQL client.
 * Never throws: a patch that cannot apply is reported, not fatal.
 */
export async function applyPatches(db, { log = false } = {}) {
  let applied = 0, present = 0, failed = 0;
  for (const sql of PATCHES) {
    try {
      await db.execute(sql);
      applied++;
    } catch (e) {
      if (isBenignSchemaError(e?.message)) present++;
      else {
        failed++;
        if (log) console.warn(`  skipped: ${sql.slice(0, 60)} — ${String(e?.message).slice(0, 100)}`);
      }
    }
  }
  return { applied, present, failed, total: PATCHES.length };
}