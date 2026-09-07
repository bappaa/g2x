-- ============================================================
--  G2X.GG  —  libSQL / Turso schema
--  Buyer + Seller scope (admin tables included where shared)
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT,
  provider       TEXT NOT NULL DEFAULT 'email',   -- email | google
  avatar         TEXT,
  role           TEXT NOT NULL DEFAULT 'buyer',   -- buyer | seller | admin
  is_seller      INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'active',  -- active | suspended | banned
  country        TEXT,
  phone          TEXT,
  balance        REAL NOT NULL DEFAULT 0,
  two_factor     INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  kyc_due_at      TEXT,
  kyc_due_reason  TEXT
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip          TEXT,
  user_agent  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- ---------------------------- catalog ----------------------------

CREATE TABLE IF NOT EXISTS games (
  slug        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  logo        TEXT NOT NULL,
  accent      TEXT,
  status      TEXT NOT NULL DEFAULT 'active',
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS categories (
  slug        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  blurb       TEXT,
  icon        TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS game_categories (
  game_slug      TEXT NOT NULL REFERENCES games(slug) ON DELETE CASCADE,
  category_slug  TEXT NOT NULL REFERENCES categories(slug) ON DELETE CASCADE,
  PRIMARY KEY (game_slug, category_slug)
);

-- Admin-created products / denominations. Sellers never create these.
CREATE TABLE IF NOT EXISTS products (
  id               TEXT PRIMARY KEY,
  slug             TEXT NOT NULL,
  game_slug        TEXT NOT NULL REFERENCES games(slug) ON DELETE CASCADE,
  category_slug    TEXT NOT NULL REFERENCES categories(slug) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  image            TEXT NOT NULL,
  base_price       REAL NOT NULL DEFAULT 0,
  delivery_method  TEXT,
  delivery_time    TEXT,
  region           TEXT,
  platform         TEXT,
  popular          INTEGER NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'active',
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (game_slug, slug)
);
CREATE INDEX IF NOT EXISTS idx_products_gc ON products(game_slug, category_slug);

-- Dynamic per-category field template (docs: no hardcoded form per game)
CREATE TABLE IF NOT EXISTS field_templates (
  id             TEXT PRIMARY KEY,
  category_slug  TEXT NOT NULL REFERENCES categories(slug) ON DELETE CASCADE,
  label          TEXT NOT NULL,
  field_key      TEXT NOT NULL,
  field_type     TEXT NOT NULL,   -- text | number | dropdown | textarea | switch | date
  options        TEXT,            -- JSON array for dropdown
  required       INTEGER NOT NULL DEFAULT 0,
  show_frontend  INTEGER NOT NULL DEFAULT 1,
  sort_order     INTEGER NOT NULL DEFAULT 0
);

-- ---------------------------- sellers ----------------------------

CREATE TABLE IF NOT EXISTS seller_profiles (
  user_id        TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  store_name     TEXT NOT NULL,
  slug           TEXT NOT NULL UNIQUE,
  logo           TEXT,
  banner         TEXT,
  description    TEXT,
  primary_cat    TEXT,
  level          TEXT NOT NULL DEFAULT 'New Seller',
  verified       INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'pending',  -- pending | active | suspended | rejected
  rating         REAL NOT NULL DEFAULT 0,
  total_sales    REAL NOT NULL DEFAULT 0,
  total_orders   INTEGER NOT NULL DEFAULT 0,
  response_rate  REAL NOT NULL DEFAULT 100,
  commission_pct REAL NOT NULL DEFAULT 8,
  available_bal  REAL NOT NULL DEFAULT 0,
  pending_bal    REAL NOT NULL DEFAULT 0,
  payout_method  TEXT,
  payout_detail  TEXT,
  applied_at     TEXT NOT NULL DEFAULT (datetime('now')),
  approved_at    TEXT
);

-- Seller offers against an admin product
CREATE TABLE IF NOT EXISTS offers (
  id               TEXT PRIMARY KEY,
  seller_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id       TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  title            TEXT,
  price            REAL NOT NULL,
  old_price        REAL,
  stock            INTEGER NOT NULL DEFAULT 0,
  delivery_time    TEXT NOT NULL,
  delivery_method  TEXT,
  login_method     TEXT,
  region           TEXT,
  platform         TEXT,
  instructions     TEXT,
  custom_fields    TEXT,             -- JSON from field_templates
  status           TEXT NOT NULL DEFAULT 'active', -- active | paused | draft | out_of_stock | rejected
  featured         INTEGER NOT NULL DEFAULT 0,
  pinned           INTEGER NOT NULL DEFAULT 0,
  sold_count       INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_offers_product ON offers(product_id, status);
CREATE INDEX IF NOT EXISTS idx_offers_seller ON offers(seller_id);

-- Standalone seller listings (accounts / boosting) not tied to a denomination
CREATE TABLE IF NOT EXISTS listings (
  id             TEXT PRIMARY KEY,
  seller_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_slug      TEXT NOT NULL,
  category_slug  TEXT NOT NULL,
  title          TEXT NOT NULL,
  description    TEXT,
  image          TEXT,
  price          REAL NOT NULL,
  stock          INTEGER NOT NULL DEFAULT 1,
  tier           TEXT,
  level          INTEGER,
  outfits        INTEGER,
  delivery_time  TEXT,
  status         TEXT NOT NULL DEFAULT 'active',
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_listings_gc ON listings(game_slug, category_slug, status);

-- ---------------------------- orders -----------------------------

CREATE TABLE IF NOT EXISTS orders (
  id              TEXT PRIMARY KEY,
  code            TEXT NOT NULL UNIQUE,
  buyer_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subtotal        REAL NOT NULL,
  fee             REAL NOT NULL DEFAULT 0,
  total           REAL NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending_payment',
  payment_method  TEXT,
  payment_status  TEXT NOT NULL DEFAULT 'pending',
  delivery_uid    TEXT,
  buyer_note      TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);

CREATE TABLE IF NOT EXISTS order_items (
  id               TEXT PRIMARY KEY,
  order_id         TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  offer_id         TEXT,
  listing_id       TEXT,
  product_id       TEXT,
  seller_id        TEXT NOT NULL,
  title            TEXT NOT NULL,
  subtitle         TEXT,
  image            TEXT,
  href             TEXT,
  unit_price       REAL NOT NULL,
  qty              INTEGER NOT NULL DEFAULT 1,
  line_total       REAL NOT NULL,
  commission_pct   REAL NOT NULL DEFAULT 8,   -- immutable snapshot
  commission_amt   REAL NOT NULL DEFAULT 0,
  seller_net       REAL NOT NULL DEFAULT 0,
  delivery_time    TEXT,
  status           TEXT NOT NULL DEFAULT 'processing',
  delivered_at     TEXT,
  credentials      TEXT                        -- JSON released to buyer
);
CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_items_seller ON order_items(seller_id, status);

CREATE TABLE IF NOT EXISTS order_events (
  id         TEXT PRIMARY KEY,
  order_id   TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  actor      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- --------------------------- finance -----------------------------

CREATE TABLE IF NOT EXISTS transactions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,     -- deposit | purchase | refund | bonus | sale | commission | withdrawal | adjustment
  amount     REAL NOT NULL,     -- signed
  balance_after REAL,
  reference  TEXT,
  order_id   TEXT,
  -- Idempotency key: UNIQUE, so a duplicate credit is rejected by the database
  -- itself rather than relying on client-side button disabling.
  idem_key   TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_txn_user ON transactions(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_txn_idem ON transactions(idem_key);

CREATE TABLE IF NOT EXISTS withdrawals (
  id          TEXT PRIMARY KEY,
  seller_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount      REAL NOT NULL,
  method      TEXT NOT NULL,
  detail      TEXT,
  status      TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected | paid
  reference   TEXT,
  admin_note  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_wd_seller ON withdrawals(seller_id);

-- ------------------------ trust & support ------------------------

CREATE TABLE IF NOT EXISTS reviews (
  id         TEXT PRIMARY KEY,
  order_id   TEXT,
  buyer_id   TEXT NOT NULL,
  seller_id  TEXT NOT NULL,
  product_id TEXT,
  stars      INTEGER NOT NULL,
  body       TEXT,
  status     TEXT NOT NULL DEFAULT 'published',
  reply      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reviews_seller ON reviews(seller_id);

CREATE TABLE IF NOT EXISTS disputes (
  id          TEXT PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,
  order_id    TEXT NOT NULL,
  buyer_id    TEXT NOT NULL,
  seller_id   TEXT NOT NULL,
  amount      REAL NOT NULL,
  reason      TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open', -- open | under_review | resolved | rejected
  resolution  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_disputes_seller ON disputes(seller_id);
CREATE INDEX IF NOT EXISTS idx_disputes_buyer ON disputes(buyer_id);

CREATE TABLE IF NOT EXISTS dispute_messages (
  id         TEXT PRIMARY KEY,
  dispute_id TEXT NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  sender     TEXT NOT NULL,   -- buyer | seller | admin
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tickets (
  id         TEXT PRIMARY KEY,
  code       TEXT NOT NULL UNIQUE,
  user_id    TEXT NOT NULL,
  subject    TEXT NOT NULL,
  category   TEXT,
  priority   TEXT NOT NULL DEFAULT 'normal',
  status     TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id         TEXT PRIMARY KEY,
  ticket_id  TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  sender     TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS threads (
  id         TEXT PRIMARY KEY,
  buyer_id   TEXT NOT NULL,
  seller_id  TEXT NOT NULL,
  order_id   TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (buyer_id, seller_id, order_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id         TEXT PRIMARY KEY,
  thread_id  TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  sender_id  TEXT NOT NULL,
  body       TEXT NOT NULL,
  read_flag  INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_msg_thread ON messages(thread_id);

CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT,
  href       TEXT,
  kind       TEXT NOT NULL DEFAULT 'system',
  read_flag  INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read_flag);

CREATE TABLE IF NOT EXISTS wishlist (
  user_id    TEXT NOT NULL,
  item_id    TEXT NOT NULL,
  title      TEXT NOT NULL,
  subtitle   TEXT,
  image      TEXT,
  price      REAL,
  href       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, item_id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id         TEXT PRIMARY KEY,
  actor_id   TEXT,
  actor_role TEXT,
  action     TEXT NOT NULL,
  target     TEXT,
  meta       TEXT,
  ip         TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS cart_items (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  offer_id   TEXT,
  listing_id TEXT,
  qty        INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, offer_id, listing_id)
);
CREATE INDEX IF NOT EXISTS idx_cart_user ON cart_items(user_id);
