-- ============================================================
-- G2X.GG — Phase 4 migration
-- Seller KYC verification · Admin panel · Chat monitoring · CMS
-- Safe to run repeatedly (all statements are IF NOT EXISTS / guarded).
-- ============================================================

-- ---------- categories get status + admin-editable metadata ----------
ALTER TABLE categories ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE categories ADD COLUMN kind TEXT;

-- ---------- games get admin metadata ----------
ALTER TABLE games ADD COLUMN created_at TEXT;

-- ---------- seller ranking / badges (admin controlled) ----------
ALTER TABLE seller_profiles ADD COLUMN rank_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE seller_profiles ADD COLUMN custom_badge TEXT;
ALTER TABLE seller_profiles ADD COLUMN featured INTEGER NOT NULL DEFAULT 0;
ALTER TABLE seller_profiles ADD COLUMN top_seller INTEGER NOT NULL DEFAULT 0;
ALTER TABLE seller_profiles ADD COLUMN show_homepage INTEGER NOT NULL DEFAULT 0;

-- ---------- offers get admin moderation ----------
ALTER TABLE offers ADD COLUMN recommended INTEGER NOT NULL DEFAULT 0;
ALTER TABLE offers ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE offers ADD COLUMN admin_note TEXT;

-- ---------- products get admin fields ----------
ALTER TABLE products ADD COLUMN old_price REAL;
ALTER TABLE products ADD COLUMN discount_pct REAL;
ALTER TABLE products ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN featured INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN login_method TEXT;
ALTER TABLE products ADD COLUMN delivery_instructions TEXT;

-- ---------- messages get moderation flags ----------
ALTER TABLE messages ADD COLUMN flagged INTEGER NOT NULL DEFAULT 0;
ALTER TABLE messages ADD COLUMN flag_reasons TEXT;
ALTER TABLE messages ADD COLUMN admin_reviewed INTEGER NOT NULL DEFAULT 0;

-- ============================================================
-- Seller verification (KYC)
-- ============================================================
CREATE TABLE IF NOT EXISTS seller_verifications (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  country       TEXT NOT NULL,
  id_type       TEXT NOT NULL,          -- Aadhaar / PAN / Passport / SSN ...
  id_number     TEXT NOT NULL,
  id_number_last4 TEXT,
  dob           TEXT,
  address       TEXT,
  front_path    TEXT NOT NULL,          -- stored file path
  back_path     TEXT,
  selfie_path   TEXT,
  status        TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected | resubmit
  reviewed_by   TEXT,
  review_note   TEXT,
  submitted_at  TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_ver_user ON seller_verifications(user_id, status);
CREATE INDEX IF NOT EXISTS idx_ver_status ON seller_verifications(status);

-- ============================================================
-- Admin: roles, permissions, activity
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_roles (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  permissions TEXT NOT NULL DEFAULT '[]',  -- JSON array of permission keys
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admin_users (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role_id    TEXT NOT NULL REFERENCES admin_roles(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- Marketing: coupons, announcements, banners, homepage CMS
-- ============================================================
CREATE TABLE IF NOT EXISTS coupons (
  id             TEXT PRIMARY KEY,
  code           TEXT NOT NULL UNIQUE,
  discount_type  TEXT NOT NULL DEFAULT 'percent',  -- percent | fixed
  discount_value REAL NOT NULL,
  applies_to     TEXT NOT NULL DEFAULT 'all',      -- all | game:<slug> | category:<slug>
  min_order      REAL NOT NULL DEFAULT 0,
  start_date     TEXT,
  end_date       TEXT,
  usage_limit    INTEGER NOT NULL DEFAULT 0,       -- 0 = unlimited
  usage_per_user INTEGER NOT NULL DEFAULT 1,
  used_count     INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'active',
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS coupon_uses (
  id         TEXT PRIMARY KEY,
  coupon_id  TEXT NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL,
  order_id   TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS announcements (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  body       TEXT,
  tone       TEXT NOT NULL DEFAULT 'info',
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cms_blocks (
  key        TEXT PRIMARY KEY,     -- hero | trust | faq | promo_bar ...
  title      TEXT,
  subtitle   TEXT,
  body       TEXT,
  image      TEXT,
  cta_label  TEXT,
  cta_href   TEXT,
  data       TEXT,                 -- JSON for list-type blocks
  active     INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- Delivery logs (admin visibility)
-- ============================================================
CREATE TABLE IF NOT EXISTS delivery_logs (
  id            TEXT PRIMARY KEY,
  order_item_id TEXT NOT NULL,
  seller_id     TEXT NOT NULL,
  buyer_id      TEXT NOT NULL,
  action        TEXT NOT NULL,
  detail        TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_dlog_item ON delivery_logs(order_item_id);

-- ============================================================
-- Indexes that speed up the hot buyer paths
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_products_cat   ON products(category_slug, status);
CREATE INDEX IF NOT EXISTS idx_products_game  ON products(game_slug, category_slug, status);
CREATE INDEX IF NOT EXISTS idx_orders_buyer   ON orders(buyer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notif_user     ON notifications(user_id, read_flag);
CREATE INDEX IF NOT EXISTS idx_msgs_thread    ON messages(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_msgs_flagged   ON messages(flagged, admin_reviewed);
CREATE INDEX IF NOT EXISTS idx_reviews_seller ON reviews(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_txn_user       ON transactions(user_id, created_at);

-- ============================================================
-- Phase 5: admin-managed option lists, site assets & banners
-- ============================================================

-- Dropdown option lists (login method, delivery method, region, platform…)
CREATE TABLE IF NOT EXISTS option_lists (
  id          TEXT PRIMARY KEY,
  list_key    TEXT NOT NULL,          -- 'login_method' | 'delivery_method' | 'region' | 'platform'
  value       TEXT NOT NULL,
  label       TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_option_lists_key ON option_lists(list_key, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS idx_option_lists_uniq ON option_lists(list_key, value);

-- Uploaded media (game icons, banners, logos) stored as data URIs in the DB
CREATE TABLE IF NOT EXISTS media (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL DEFAULT 'image',   -- 'game_icon' | 'banner' | 'logo' | 'image'
  name        TEXT NOT NULL,
  mime        TEXT NOT NULL,
  data        TEXT NOT NULL,                    -- base64 payload (no data: prefix)
  size        INTEGER NOT NULL DEFAULT 0,
  ref_key     TEXT,                             -- e.g. game slug this icon belongs to
  created_by  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_media_kind ON media(kind, created_at);
CREATE INDEX IF NOT EXISTS idx_media_ref ON media(ref_key);

-- Homepage banners / slides
CREATE TABLE IF NOT EXISTS banners (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL DEFAULT '',
  subtitle    TEXT NOT NULL DEFAULT '',
  image       TEXT NOT NULL DEFAULT '',
  cta_label   TEXT NOT NULL DEFAULT '',
  cta_href    TEXT NOT NULL DEFAULT '',
  placement   TEXT NOT NULL DEFAULT 'hero',    -- 'hero' | 'strip' | 'sidebar' | 'category'
  bg_color    TEXT NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_banners_placement ON banners(placement, sort_order);

-- perf: hot lookup paths
CREATE INDEX IF NOT EXISTS idx_banners_live      ON banners(placement, active, sort_order);
CREATE INDEX IF NOT EXISTS idx_options_live      ON option_lists(list_key, active, sort_order);
CREATE INDEX IF NOT EXISTS idx_products_browse   ON products(game_slug, category_slug, status);
CREATE INDEX IF NOT EXISTS idx_products_popular  ON products(status, popular);
CREATE INDEX IF NOT EXISTS idx_offers_product    ON offers(product_id, status, price);
CREATE INDEX IF NOT EXISTS idx_offers_seller     ON offers(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_order_items_ord   ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_sell  ON order_items(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_buyer      ON orders(buyer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notif_user        ON notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_messages_thread   ON messages(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_users_email_like  ON users(email);
CREATE INDEX IF NOT EXISTS idx_media_kind        ON media(kind, created_at);

-- Admin-managed footer / header navigation links (phase 5, item 11)
CREATE TABLE IF NOT EXISTS nav_links (
  id         TEXT PRIMARY KEY,
  section    TEXT NOT NULL,           -- footer column heading, e.g. 'Marketplace'
  label      TEXT NOT NULL,
  href       TEXT NOT NULL,
  placement  TEXT NOT NULL DEFAULT 'footer',   -- footer | header
  sort_order INTEGER NOT NULL DEFAULT 0,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_nav_live ON nav_links(placement, active, sort_order);

-- Admin-managed payment gateways & their fees (phase 6)
CREATE TABLE IF NOT EXISTS payment_gateways (
  id          TEXT PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,      -- card | upi | paypal | crypto | wallet
  name        TEXT NOT NULL,
  logo        TEXT,                      -- BrandIcon name or /api/media/<id>
  fee_percent REAL NOT NULL DEFAULT 0,   -- % of the amount
  fee_fixed   REAL NOT NULL DEFAULT 0,   -- flat fee in USD
  min_amount  REAL NOT NULL DEFAULT 0,
  max_amount  REAL NOT NULL DEFAULT 0,   -- 0 = no limit
  enabled     INTEGER NOT NULL DEFAULT 1,
  for_topup   INTEGER NOT NULL DEFAULT 1,
  for_checkout INTEGER NOT NULL DEFAULT 1,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  note        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_gateways_live ON payment_gateways(enabled, sort_order);

-- Record what was actually charged, so history stays accurate if fees change
ALTER TABLE orders ADD COLUMN gateway_fee REAL NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN gateway_code TEXT;

-- ============================================================
-- Buyer identity verification (spending threshold)
-- Separate from seller_verifications: a buyer only needs a light
-- check (ID number + ID photo + face photo) once their spend
-- crosses the configured threshold.
-- ============================================================
CREATE TABLE IF NOT EXISTS buyer_verifications (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name       TEXT NOT NULL,
  country         TEXT NOT NULL,
  id_type         TEXT NOT NULL,
  id_number       TEXT NOT NULL,
  id_number_last4 TEXT,
  dob             TEXT,
  id_photo_path   TEXT NOT NULL,
  face_photo_path TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected | resubmit
  reviewed_by     TEXT,
  review_note     TEXT,
  submitted_at    TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_bver_user ON buyer_verifications(user_id, status);
CREATE INDEX IF NOT EXISTS idx_bver_status ON buyer_verifications(status, submitted_at);

-- cached flag on the user so the gate check is a single cheap read
ALTER TABLE users ADD COLUMN kyc_status TEXT DEFAULT 'none';

-- Buyer's chosen game server / delivery method, captured at add-to-cart time
-- and carried through to the order so the seller knows what to deliver.
ALTER TABLE cart_items ADD COLUMN opt_region TEXT;
ALTER TABLE cart_items ADD COLUMN opt_delivery TEXT;
ALTER TABLE order_items ADD COLUMN opt_region TEXT;
ALTER TABLE order_items ADD COLUMN opt_delivery TEXT;

-- Idempotency guard for wallet top-ups (double-credit bug).
-- A UNIQUE column lets the DATABASE reject a duplicate credit atomically, which
-- is the only reliable defence against double-submits, retries and races
-- between concurrent requests. Nullable so existing rows stay valid.
ALTER TABLE transactions ADD COLUMN idem_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_txn_idem ON transactions(idem_key);

-- Post-payment buyer verification (replaces the pre-payment block).
-- A qualifying transaction now completes normally and stamps `kyc_due_at`;
-- the buyer is then sent to the verification tab to submit their details.
ALTER TABLE users ADD COLUMN kyc_due_at TEXT;
ALTER TABLE users ADD COLUMN kyc_due_reason TEXT;
CREATE INDEX IF NOT EXISTS idx_users_kyc_due ON users(kyc_due_at);

-- ============ Phase 14 ============
-- Public usernames: unique handle per user, admin-priced renames after 2 free.
ALTER TABLE users ADD COLUMN username TEXT;
ALTER TABLE users ADD COLUMN username_changes INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Escrow: auto-release 7 days after delivery, no buyer action required.
ALTER TABLE orders ADD COLUMN delivered_at TEXT;
ALTER TABLE orders ADD COLUMN release_at TEXT;
ALTER TABLE orders ADD COLUMN released INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_orders_release ON orders(released, release_at);

-- Chat attachments (stored in-DB as data URIs) + dispute system messages.
ALTER TABLE messages ADD COLUMN kind TEXT NOT NULL DEFAULT 'text';
ALTER TABLE messages ADD COLUMN attachment_name TEXT;
ALTER TABLE messages ADD COLUMN attachment_type TEXT;
ALTER TABLE messages ADD COLUMN attachment_size INTEGER;
ALTER TABLE messages ADD COLUMN attachment_data TEXT;
ALTER TABLE messages ADD COLUMN dispute_id TEXT;

-- Link a dispute to its chat thread so the red banner can live in the message box.
ALTER TABLE disputes ADD COLUMN thread_id TEXT;
ALTER TABLE threads ADD COLUMN dispute_id TEXT;
