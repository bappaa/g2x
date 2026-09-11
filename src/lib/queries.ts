import "server-only";
import { unstable_cache } from "next/cache";
import { all, one } from "./db";
import { NAME_SORT } from "./homepage";
import { ensureSchema } from "./ensure-schema";

/* ============================ types ============================ */

export type DbGame = {
  slug: string; name: string; logo: string; accent: string | null; status: string;
};
export type DbCategory = { slug: string; name: string; blurb: string; icon: string };
export type DbProduct = {
  id: string; slug: string; game_slug: string; category_slug: string; name: string;
  image: string; base_price: number; delivery_method: string; delivery_time: string;
  region: string; platform: string; popular: number;
};
export type DbOffer = {
  id: string; seller_id: string; product_id: string; price: number; old_price: number | null;
  stock: number; delivery_time: string; delivery_method: string | null; instructions: string | null;
  status: string; featured: number; sold_count: number;
  store_name: string; seller_slug: string; level: string; verified: number;
  rating: number; total_orders: number;
  /** JSON array of data URIs uploaded by the seller with this offer. */
  images: string | null;
};
export type DbListing = {
  id: string; seller_id: string; game_slug: string; category_slug: string; title: string;
  description: string | null; image: string; price: number; stock: number; tier: string | null;
  level: number | null; outfits: number | null; delivery_time: string | null; status: string;
  store_name: string; rating: number; verified: number;
};

/* ============================ catalog ============================ */

export const getGames = () =>
  all<DbGame>(`SELECT * FROM games WHERE status='active' ORDER BY sort_order`);

export const getCategories = () =>
  all<DbCategory>(`SELECT * FROM categories ORDER BY sort_order, name`);

export const getGame = (slug: string) =>
  one<DbGame>(`SELECT * FROM games WHERE slug=? AND status='active'`, [slug]);

export const getCategory = (slug: string) =>
  one<DbCategory>(`SELECT * FROM categories WHERE slug=?`, [slug]);

export const getGameCategories = (game: string) =>
  all<DbCategory>(
    `SELECT c.* FROM categories c
       JOIN game_categories gc ON gc.category_slug=c.slug
      WHERE gc.game_slug=? ORDER BY c.sort_order, c.name`,
    [game]
  );

export const getGamesForCategory = (category: string) =>
  all<DbGame>(
    `SELECT g.* FROM games g
       JOIN game_categories gc ON gc.game_slug=g.slug
      WHERE gc.category_slug=? AND g.status='active' ORDER BY g.sort_order`,
    [category]
  );

/**
 * Every game in a category with its live offer count and real sales volume.
 *
 * Powers the category browser: a sales-ranked "Trending now" strip plus the
 * full 0-9 then A-Z index. Both come from the same query so the page needs a
 * single round trip, and neither needs any admin curation — `sold` is actual
 * delivered/completed quantity, so the ranking maintains itself.
 */
export const getCategoryGameIndex = (category: string) =>
  all<{ slug: string; name: string; logo: string; offers: number; sold: number }>(
    `SELECT g.slug, g.name, g.logo,
            /* Accounts and Boosting stock lives in listings, everything else
               in offers, so live inventory is the sum of both. */
            COALESCE((
              SELECT COUNT(*) FROM offers o
                JOIN products p ON p.id = o.product_id
               WHERE p.game_slug = g.slug AND p.category_slug = gc.category_slug
                 AND o.status='active' AND o.stock > 0
            ), 0)
            + COALESCE((
              SELECT COUNT(*) FROM listings l
               WHERE l.game_slug = g.slug AND l.category_slug = gc.category_slug
                 AND l.status='active' AND l.stock > 0
            ), 0) AS offers,
            COALESCE((
              SELECT SUM(oi.qty) FROM order_items oi
                JOIN products p ON p.id = oi.product_id
               WHERE p.game_slug = g.slug AND p.category_slug = gc.category_slug
                 AND oi.status IN ('delivered','completed')
            ), 0)
            + COALESCE((
              SELECT SUM(oi.qty) FROM order_items oi
                JOIN listings l ON l.id = oi.listing_id
               WHERE l.game_slug = g.slug AND l.category_slug = gc.category_slug
                 AND oi.status IN ('delivered','completed')
            ), 0) AS sold
       FROM games g
       JOIN game_categories gc ON gc.game_slug = g.slug
      WHERE gc.category_slug = ? AND g.status='active'
      ORDER BY ${NAME_SORT("g.name")}`,
    [category]
  );

/** products + cheapest live offer price */
export const getProducts = (game: string, category?: string) =>
  all<DbProduct & { min_price: number | null; offer_count: number }>(
    `SELECT p.*,
            (SELECT MIN(o.price) FROM offers o
              WHERE o.product_id=p.id AND o.status='active' AND o.stock>0) AS min_price,
            (SELECT COUNT(*) FROM offers o
              WHERE o.product_id=p.id AND o.status='active' AND o.stock>0) AS offer_count
       FROM products p
      WHERE p.game_slug=? ${category ? "AND p.category_slug=?" : ""} AND p.status='active'
      ORDER BY p.base_price`,
    category ? [game, category] : [game]
  );

export const getPopularProducts = (category: string, limit = 12) =>
  all<DbProduct & { min_price: number | null }>(
    `SELECT p.*, (SELECT MIN(o.price) FROM offers o
                   WHERE o.product_id=p.id AND o.status='active' AND o.stock>0) AS min_price
       FROM products p
      WHERE p.category_slug=? AND p.status='active'
      ORDER BY p.popular DESC, p.base_price LIMIT ?`,
    [category, limit]
  );

export const getProduct = (game: string, slug: string) =>
  one<DbProduct>(
    `SELECT * FROM products WHERE game_slug=? AND slug=? AND status='active'`,
    [game, slug]
  );

export const getProductById = (id: string) =>
  one<DbProduct>(`SELECT * FROM products WHERE id=?`, [id]);

/** live seller offers for a product — the buyer comparison table */
export const getOffers = (productId: string) =>
  all<DbOffer>(
    `SELECT o.*, sp.store_name, sp.slug AS seller_slug, sp.level, sp.verified,
            sp.rating, sp.total_orders
       FROM offers o
       JOIN seller_profiles sp ON sp.user_id=o.seller_id
      WHERE o.product_id=? AND o.status='active' AND o.stock>0 AND sp.status='active'
      ORDER BY o.price ASC`,
    [productId]
  );

export const getOfferById = (id: string) =>
  one<DbOffer>(
    `SELECT o.*, sp.store_name, sp.slug AS seller_slug, sp.level, sp.verified,
            sp.rating, sp.total_orders
       FROM offers o JOIN seller_profiles sp ON sp.user_id=o.seller_id
      WHERE o.id=?`,
    [id]
  );

export const getListings = (opts: { game?: string; category: string; limit?: number }) =>
  all<DbListing>(
    `SELECT l.*, sp.store_name, sp.rating, sp.verified
       FROM listings l
       JOIN seller_profiles sp ON sp.user_id=l.seller_id
      WHERE l.category_slug=? ${opts.game ? "AND l.game_slug=?" : ""}
        AND l.status='active' AND l.stock>0 AND sp.status='active'
      ORDER BY l.price LIMIT ${Math.min(opts.limit ?? 60, 200)}`,
    opts.game ? [opts.category, opts.game] : [opts.category]
  );

export const getListing = (id: string) =>
  one<DbListing>(
    `SELECT l.*, sp.store_name, sp.rating, sp.verified
       FROM listings l JOIN seller_profiles sp ON sp.user_id=l.seller_id
      WHERE l.id=?`,
    [id]
  );

export const searchCatalog = async (q: string) => {
  const like = `%${q}%`;
  const [games, products] = await Promise.all([
    all<DbGame>(`SELECT * FROM games WHERE name LIKE ? AND status='active' LIMIT 4`, [like]),
    all<DbProduct>(
      `SELECT * FROM products WHERE name LIKE ? AND status='active' LIMIT 6`,
      [like]
    ),
  ]);
  return { games, products };
};

/* ============================ buyer ============================ */

export const getCart = (userId: string) =>
  all<{
    key: string; offer_id: string | null; listing_id: string | null; product_id: string | null;
    title: string; sub: string; image: string; seller_id: string; store_name: string;
    price: number; qty: number; stock: number; delivery: string; href: string;
    opt_region: string | null; opt_delivery: string | null;
    /** 1 = the seller pre-filled the details; deliver instantly on payment. */
    auto_delivery: number;
    /** JSON array of credential sets the seller supplied up front. */
    accounts_data: string | null;
  }>(
    `SELECT * FROM (
       SELECT ci.id AS key, ci.offer_id, ci.listing_id, o.product_id,
              p.name AS title,
              g.name || ' · ' || c.name AS sub,
              p.image, o.seller_id, sp.store_name, o.price, ci.qty, o.stock,
              o.delivery_time AS delivery,
              '/g/' || p.game_slug || '/' || p.category_slug || '/' || p.slug AS href,
              ci.opt_region, ci.opt_delivery,
              COALESCE(o.auto_delivery, 0) AS auto_delivery, o.accounts_data
         FROM cart_items ci
         JOIN offers o   ON o.id = ci.offer_id
         JOIN products p ON p.id = o.product_id
         JOIN games g    ON g.slug = p.game_slug
         JOIN categories c ON c.slug = p.category_slug
         JOIN seller_profiles sp ON sp.user_id = o.seller_id
        WHERE ci.user_id = ?
       UNION ALL
       SELECT ci.id AS key, ci.offer_id, ci.listing_id, NULL,
              l.title, g.name || ' · ' || c.name AS sub, l.image,
              l.seller_id, sp.store_name, l.price, ci.qty, l.stock,
              COALESCE(l.delivery_time,'5 - 30 min'),
              '/g/' || l.game_slug || '/' || l.category_slug || '/' || l.id,
              ci.opt_region, ci.opt_delivery,
              0 AS auto_delivery, NULL AS accounts_data
         FROM cart_items ci
         JOIN listings l ON l.id = ci.listing_id
         JOIN games g    ON g.slug = l.game_slug
         JOIN categories c ON c.slug = l.category_slug
         JOIN seller_profiles sp ON sp.user_id = l.seller_id
        WHERE ci.user_id = ?
     )`,
    [userId, userId]
  );

export const getOrders = (buyerId: string, status?: string) =>
  all(
    `SELECT o.*, (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id=o.id) AS item_count,
            (SELECT oi.title FROM order_items oi WHERE oi.order_id=o.id LIMIT 1) AS first_title,
            (SELECT oi.image FROM order_items oi WHERE oi.order_id=o.id LIMIT 1) AS first_image
       FROM orders o
      WHERE o.buyer_id=? ${status && status !== "all" ? "AND o.status=?" : ""}
      ORDER BY o.created_at DESC`,
    status && status !== "all" ? [buyerId, status] : [buyerId]
  );

export const getOrder = async (code: string, buyerId?: string) => {
  const order = await one(
    `SELECT * FROM orders WHERE code=? ${buyerId ? "AND buyer_id=?" : ""}`,
    buyerId ? [code, buyerId] : [code]
  );
  if (!order) return null;
  const id = String((order as Record<string, unknown>).id);
  const [items, events] = await Promise.all([
    all(
      `SELECT oi.*, sp.store_name FROM order_items oi
         LEFT JOIN seller_profiles sp ON sp.user_id=oi.seller_id
        WHERE oi.order_id=?`,
      [id]
    ),
    all(`SELECT * FROM order_events WHERE order_id=? ORDER BY created_at`, [id]),
  ]);
  return { order, items, events };
};

export const getWallet = (userId: string) =>
  all(`SELECT * FROM transactions WHERE user_id=? ORDER BY created_at DESC LIMIT 200`, [userId]);

export const getWishlist = (userId: string) =>
  all(`SELECT * FROM wishlist WHERE user_id=? ORDER BY created_at DESC`, [userId]);

export const getNotifications = (userId: string) =>
  all(`SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50`, [userId]);

export const getUnreadCount = async (userId: string) => {
  const r = await one<{ n: number }>(
    `SELECT COUNT(*) AS n FROM notifications WHERE user_id=? AND read_flag=0`,
    [userId]
  );
  return Number(r?.n ?? 0);
};

export const getBuyerDisputes = (userId: string) =>
  all(
    `SELECT d.*, sp.store_name FROM disputes d
       LEFT JOIN seller_profiles sp ON sp.user_id=d.seller_id
      WHERE d.buyer_id=? ORDER BY d.created_at DESC`,
    [userId]
  );

export const getBuyerReviewables = (userId: string) =>
  all(
    `SELECT oi.*, o.code, o.created_at AS ordered_at, sp.store_name,
            (SELECT r.id FROM reviews r WHERE r.order_id=o.id AND r.seller_id=oi.seller_id) AS review_id,
            (SELECT r.stars FROM reviews r WHERE r.order_id=o.id AND r.seller_id=oi.seller_id) AS review_stars,
            (SELECT r.body FROM reviews r WHERE r.order_id=o.id AND r.seller_id=oi.seller_id) AS review_body
       FROM order_items oi
       JOIN orders o ON o.id=oi.order_id
       LEFT JOIN seller_profiles sp ON sp.user_id=oi.seller_id
      WHERE o.buyer_id=? AND o.status IN ('completed','delivered')
      ORDER BY o.created_at DESC`,
    [userId]
  );

export const getPurchased = (userId: string) =>
  all(
    `SELECT oi.*, o.code, o.created_at, sp.store_name
       FROM order_items oi
       JOIN orders o ON o.id=oi.order_id
       LEFT JOIN seller_profiles sp ON sp.user_id=oi.seller_id
      WHERE o.buyer_id=? AND oi.status IN ('delivered','completed')
      ORDER BY o.created_at DESC`,
    [userId]
  );

/* ============================ threads ============================ */

export const getThreads = (userId: string) =>
  all(
    `SELECT t.*,
            CASE WHEN t.buyer_id=? THEN sp.store_name
                 ELSE COALESCE('@' || bu.username, '@user_' || substr(bu.id,-6)) END AS other_name,
            CASE WHEN t.buyer_id=? THEN t.seller_id ELSE t.buyer_id END AS other_id,
            (SELECT m.body FROM messages m WHERE m.thread_id=t.id ORDER BY m.created_at DESC LIMIT 1) AS last_body,
            (SELECT COUNT(*) FROM messages m WHERE m.thread_id=t.id AND m.read_flag=0 AND m.sender_id<>?) AS unread
       FROM threads t
       LEFT JOIN seller_profiles sp ON sp.user_id=t.seller_id
       LEFT JOIN users bu ON bu.id=t.buyer_id
      WHERE t.buyer_id=? OR t.seller_id=?
      ORDER BY t.updated_at DESC`,
    [userId, userId, userId, userId, userId]
  );

export const getMessages = (threadId: string) =>
  all(`SELECT * FROM messages WHERE thread_id=? ORDER BY created_at`, [threadId]);

/* ============================ seller ============================ */

export const getSellerProfile = (userId: string) =>
  one(`SELECT * FROM seller_profiles WHERE user_id=?`, [userId]);

export const getSellerStats = async (sellerId: string) => {
  const [totals, today, pending, counts] = await Promise.all([
    one<{ orders: number; gross: number; net: number; commission: number }>(
      `SELECT COUNT(*) AS orders, COALESCE(SUM(line_total),0) AS gross,
              COALESCE(SUM(seller_net),0) AS net, COALESCE(SUM(commission_amt),0) AS commission
         FROM order_items WHERE seller_id=? AND status IN ('delivered','completed')`,
      [sellerId]
    ),
    one<{ orders: number; gross: number }>(
      `SELECT COUNT(*) AS orders, COALESCE(SUM(oi.line_total),0) AS gross
         FROM order_items oi JOIN orders o ON o.id=oi.order_id
        WHERE oi.seller_id=? AND date(o.created_at)=date('now')`,
      [sellerId]
    ),
    one<{ n: number }>(
      `SELECT COUNT(*) AS n FROM order_items WHERE seller_id=? AND status='processing'`,
      [sellerId]
    ),
    one<{ offers: number; active: number; oos: number; listings: number }>(
      `SELECT
         (SELECT COUNT(*) FROM offers WHERE seller_id=?) AS offers,
         (SELECT COUNT(*) FROM offers WHERE seller_id=? AND status='active') AS active,
         (SELECT COUNT(*) FROM offers WHERE seller_id=? AND stock<=0) AS oos,
         (SELECT COUNT(*) FROM listings WHERE seller_id=? AND status='active') AS listings`,
      [sellerId, sellerId, sellerId, sellerId]
    ),
  ]);
  const rating = await one<{ avg: number; n: number }>(
    `SELECT COALESCE(AVG(stars),0) AS avg, COUNT(*) AS n FROM reviews WHERE seller_id=? AND status='published'`,
    [sellerId]
  );
  return { totals, today, pending: Number(pending?.n ?? 0), counts, rating };
};

/**
 * A seller's offers, paginated.
 *
 * This used to return every row. A store with a few hundred offers rendered
 * them all into the HTML — ~900 KB of markup on a single page — which is what
 * made the offers page (and the "New offer" button on it) feel slow. Capping
 * the page keeps the payload flat no matter how large the store grows.
 */
export const getSellerOffers = (
  sellerId: string,
  status?: string,
  category?: string,
  limit = 30,
  offset = 0
) => {
  const args: (string | number)[] = [sellerId];
  let sql = `SELECT o.*, p.name AS product_name, p.image, p.game_slug, p.category_slug, p.slug AS product_slug,
            g.name AS game_name, c.name AS category_name,
            (SELECT MIN(o2.price) FROM offers o2
              WHERE o2.product_id=o.product_id AND o2.status='active' AND o2.stock>0) AS market_min
       FROM offers o
       JOIN products p ON p.id=o.product_id
       JOIN games g ON g.slug=p.game_slug
       JOIN categories c ON c.slug=p.category_slug
      WHERE o.seller_id=?`;
  if (status && status !== "all") {
    sql += ` AND o.status=?`;
    args.push(status);
  }
  // Drives the "My Offers" category drawer in the seller sidebar.
  if (category) {
    sql += ` AND p.category_slug=?`;
    args.push(category);
  }
  sql += ` ORDER BY o.updated_at DESC LIMIT ? OFFSET ?`;
  args.push(limit, offset);
  return all(sql, args);
};

/** Total offers matching the same filters — drives the pager. */
export const countSellerOffers = (sellerId: string, status?: string, category?: string) => {
  const args: (string | number)[] = [sellerId];
  let sql = `SELECT COUNT(*) AS n FROM offers o
               JOIN products p ON p.id=o.product_id
              WHERE o.seller_id=?`;
  if (status && status !== "all") { sql += ` AND o.status=?`; args.push(status); }
  if (category) { sql += ` AND p.category_slug=?`; args.push(category); }
  return one<{ n: number }>(sql, args);
};

export const getSellerOffer = (id: string, sellerId: string) =>
  one(
    `SELECT o.*, p.name AS product_name, p.image, p.game_slug, p.category_slug,
            g.name AS game_name, c.name AS category_name
       FROM offers o
       JOIN products p ON p.id=o.product_id
       JOIN games g ON g.slug=p.game_slug
       JOIN categories c ON c.slug=p.category_slug
      WHERE o.id=? AND o.seller_id=?`,
    [id, sellerId]
  );

export const getSellerListings = (sellerId: string, status?: string) =>
  all(
    `SELECT l.*, g.name AS game_name, c.name AS category_name
       FROM listings l
       JOIN games g ON g.slug=l.game_slug
       JOIN categories c ON c.slug=l.category_slug
      WHERE l.seller_id=? ${status && status !== "all" ? "AND l.status=?" : ""}
      ORDER BY l.created_at DESC`,
    status && status !== "all" ? [sellerId, status] : [sellerId]
  );

export const getSellerListing = (id: string, sellerId: string) =>
  one(`SELECT * FROM listings WHERE id=? AND seller_id=?`, [id, sellerId]);

export const getSellerOrders = (sellerId: string, status?: string) =>
  all(
    `SELECT oi.*, o.code, o.created_at, o.delivery_uid, o.buyer_note, o.payment_method,
            COALESCE('@' || u.username, '@user_' || substr(u.id,-6)) AS buyer_name,
            COALESCE('@' || u.username, '@user_' || substr(u.id,-6)) AS buyer_email, o.buyer_id
       FROM order_items oi
       JOIN orders o ON o.id=oi.order_id
       JOIN users u ON u.id=o.buyer_id
      WHERE oi.seller_id=? ${status && status !== "all" ? "AND oi.status=?" : ""}
      ORDER BY o.created_at DESC`,
    status && status !== "all" ? [sellerId, status] : [sellerId]
  );

export const getSellerOrderItem = (id: string, sellerId: string) =>
  one(
    `SELECT oi.*, o.code, o.created_at, o.delivery_uid, o.buyer_note, o.payment_method,
            COALESCE('@' || u.username, '@user_' || substr(u.id,-6)) AS buyer_name,
            COALESCE('@' || u.username, '@user_' || substr(u.id,-6)) AS buyer_email, o.buyer_id
       FROM order_items oi
       JOIN orders o ON o.id=oi.order_id
       JOIN users u ON u.id=o.buyer_id
      WHERE oi.id=? AND oi.seller_id=?`,
    [id, sellerId]
  );

export const getSellerReviews = (sellerId: string) =>
  all(
    `SELECT r.*, COALESCE('@' || u.username, '@user_' || substr(u.id,-6)) AS buyer_name FROM reviews r
       JOIN users u ON u.id=r.buyer_id
      WHERE r.seller_id=? ORDER BY r.created_at DESC`,
    [sellerId]
  );

export const getSellerDisputes = (sellerId: string) =>
  all(
    `SELECT d.*, COALESCE('@' || u.username, '@user_' || substr(u.id,-6)) AS buyer_name FROM disputes d
       JOIN users u ON u.id=d.buyer_id
      WHERE d.seller_id=? ORDER BY d.created_at DESC`,
    [sellerId]
  );

export const getDispute = (code: string) => {
  return one(`SELECT * FROM disputes WHERE code=?`, [code]);
};

export const getDisputeMessages = (disputeId: string) =>
  all(`SELECT * FROM dispute_messages WHERE dispute_id=? ORDER BY created_at`, [disputeId]);

export const getWithdrawals = (sellerId: string) =>
  all(`SELECT * FROM withdrawals WHERE seller_id=? ORDER BY created_at DESC`, [sellerId]);

export const getSellerSalesSeries = (sellerId: string, days = 14) =>
  all<{ d: string; revenue: number; orders: number }>(
    `SELECT date(o.created_at) AS d,
            COALESCE(SUM(oi.line_total),0) AS revenue,
            COUNT(*) AS orders
       FROM order_items oi JOIN orders o ON o.id=oi.order_id
      WHERE oi.seller_id=? AND o.created_at >= date('now', '-' || ? || ' days')
      GROUP BY date(o.created_at) ORDER BY d`,
    [sellerId, days]
  );

export const getTopSellerProducts = (sellerId: string) =>
  all(
    `SELECT oi.title, COUNT(*) AS orders, SUM(oi.line_total) AS revenue
       FROM order_items oi
      WHERE oi.seller_id=? GROUP BY oi.title ORDER BY revenue DESC LIMIT 6`,
    [sellerId]
  );

/**
 * Field keys the offer form already renders as first-class controls.
 *
 * Older seeds also defined these as generic templates, which made the wizard
 * ask for Price / Stock / Delivery Time twice — once as the real control and
 * again as a stray text box. Templates are for *extra* attributes, so the
 * reserved keys are filtered out rather than deleted (an admin may still want
 * them visible on the public product page).
 */
export const RESERVED_FIELD_KEYS = [
  "price", "stock", "quantity", "amount", "min_qty",
  "delivery_time", "delivery_method", "login_method",
  "region", "platform", "instructions", "title", "description",
];

export const getFieldTemplates = (category: string) =>
  all<{
    id: string; category_slug: string; label: string; field_key: string;
    field_type: string; options: string | null; required: number; sort_order: number;
  }>(
    `SELECT * FROM field_templates
      WHERE category_slug=? AND lower(field_key) NOT IN (${RESERVED_FIELD_KEYS.map(() => "?").join(",")})
      ORDER BY sort_order`,
    [category, ...RESERVED_FIELD_KEYS]
  );

/** products a seller can create an offer against */
export const getSellableProducts = () =>
  all<DbProduct & { game_name: string; category_name: string }>(
    `SELECT p.*, g.name AS game_name, c.name AS category_name
       FROM products p
       JOIN games g ON g.slug=p.game_slug
       JOIN categories c ON c.slug=p.category_slug
      WHERE p.status='active'
      ORDER BY g.sort_order, c.sort_order, p.base_price`
  );

export const getPublicSeller = (slug: string) =>
  one(
    `SELECT sp.*, u.name, u.created_at AS joined
       FROM seller_profiles sp JOIN users u ON u.id=sp.user_id
      WHERE sp.slug=? AND sp.status='active'`,
    [slug]
  );

/** every admin product a seller can create an offer against */
export const getCatalogForSeller = () =>
  all<{
    id: string; name: string; image: string; base_price: number;
    game_slug: string; category_slug: string; game_name: string; category_name: string;
    market_min: number | null; offer_count: number;
  }>(
    `SELECT p.id, p.name, p.image, p.base_price, p.game_slug, p.category_slug,
            g.name AS game_name, c.name AS category_name,
            (SELECT MIN(o.price) FROM offers o WHERE o.product_id=p.id AND o.status='active' AND o.stock>0) AS market_min,
            (SELECT COUNT(*) FROM offers o WHERE o.product_id=p.id AND o.status='active' AND o.stock>0) AS offer_count
       FROM products p
       JOIN games g ON g.slug=p.game_slug
       JOIN categories c ON c.slug=p.category_slug
      WHERE p.status='active'
      ORDER BY g.sort_order, c.sort_order, p.base_price`
  );

export const getAllFieldTemplates = () =>
  all<{ id: string; category_slug: string; label: string; field_key: string; field_type: string; options: string | null; required: number }>(
    `SELECT * FROM field_templates ORDER BY category_slug, sort_order`
  );

/** Active banners for a placement. Cached — busted by any banner write. */
export const activeBanners = unstable_cache(
  async (placement: string) =>
    all<{
      id: string; title: string; subtitle: string; image: string;
      cta_label: string; cta_href: string; bg_color: string;
    }>(
      `SELECT id,title,subtitle,image,cta_label,cta_href,bg_color
         FROM banners WHERE active=1 AND placement=?
        ORDER BY sort_order, created_at`,
      [placement]
    ),
  ["banners"],
  { tags: ["catalog", "banners"], revalidate: 300 }
);

/* ==================================================================== */
/* Sell wizard (admin-configured per category)                           */
/* ==================================================================== */

export type SellConfig = {
  slug: string; name: string; unit_label: string | null;
  needs_title: number; needs_images: number; needs_credentials: number;
  needs_quantity: number; allow_volume_discount: number;
  commission_pct: number | null;
  sell_notice_title: string | null; sell_notice: string | null;
  /** 'both' | 'auto' | 'manual' — which fulfilment modes the seller may pick. */
  fulfilment: string;
  show_delivery_method: number;
  show_region: number;
  show_platform: number;
  show_login_method: number;
};

/**
 * Resolve a product's sell-flow settings over its category's.
 *
 * A category is too blunt on its own — a Crunchyroll subscription and a game
 * account can share a category yet need completely different fields, which is
 * why the wizard was asking every product for a Region, a Platform and twelve
 * delivery methods it did not need.
 *
 * Any per-product column that is NULL inherits the category value, so existing
 * products keep behaving exactly as before until an admin overrides something.
 */
export function mergeSellConfig(
  cat: SellConfig,
  product?: Record<string, unknown> | null
): SellConfig {
  if (!product) return cat;
  const pick = <K extends keyof SellConfig>(key: K): SellConfig[K] => {
    const v = product[key as string];
    return (v === null || v === undefined ? cat[key] : v) as SellConfig[K];
  };
  return {
    ...cat,
    unit_label: pick("unit_label"),
    needs_title: pick("needs_title"),
    needs_images: pick("needs_images"),
    needs_credentials: pick("needs_credentials"),
    needs_quantity: pick("needs_quantity"),
    allow_volume_discount: pick("allow_volume_discount"),
    commission_pct: pick("commission_pct"),
    fulfilment: pick("fulfilment") || cat.fulfilment || "both",
    show_delivery_method: pick("show_delivery_method"),
    show_region: pick("show_region"),
    show_platform: pick("show_platform"),
    show_login_method: pick("show_login_method"),
    // A product-level notice replaces the category one when present.
    sell_notice: (product.sell_notice as string) ?? cat.sell_notice,
  };
}

/**
 * The shape of one category's "create offer" flow.
 *
 * Everything a seller is asked for is a column here, so the admin controls the
 * wizard per category (and per game via `field_templates`) without a code
 * change — which is exactly the "admin can add what that product wants"
 * requirement.
 */
/**
 * Sensible defaults for a category whose sell-flow columns have not been
 * configured (or, on a database that has not been migrated yet, do not exist).
 */
const DEFAULT_SELL_CONFIG = {
  unit_label: "unit",
  needs_title: 1,
  needs_images: 1,
  needs_credentials: 0,
  needs_quantity: 1,
  allow_volume_discount: 1,
  commission_pct: null as number | null,
  sell_notice_title: null as string | null,
  sell_notice: null as string | null,
  fulfilment: "both",
  show_delivery_method: 1,
  show_region: 1,
  show_platform: 1,
  show_login_method: 1,
};

export async function getSellConfig(slug: string): Promise<SellConfig | null> {
  // A deploy can reach a database that has not been migrated yet (git deploys
  // do not run migrations). Repair the schema first so the columns below exist.
  await ensureSchema();

  try {
    const row = await one<SellConfig>(
      `SELECT slug, name, unit_label, needs_title, needs_images, needs_credentials,
              needs_quantity, allow_volume_discount, commission_pct,
              sell_notice_title, sell_notice, fulfilment,
              show_delivery_method, show_region, show_platform, show_login_method
         FROM categories WHERE slug=? AND status='active'`,
      [slug]
    );
    if (row) return { ...DEFAULT_SELL_CONFIG, ...row };
  } catch {
    /* falls through to the base query below */
  }

  /**
   * Last resort: the sell-flow columns are still missing (an old replica, or a
   * permission problem stopped the ALTER). Fall back to the columns that have
   * always existed and serve defaults, so the seller can still list an item
   * instead of hitting a 500.
   */
  const base = await one<{ slug: string; name: string }>(
    `SELECT slug, name FROM categories WHERE slug=? AND status='active'`,
    [slug]
  ).catch(() => null);
  if (!base) return null;

  return {
    ...DEFAULT_SELL_CONFIG,
    ...base,
    // Accounts and subscriptions genuinely need the credential vault; without
    // the config columns we infer it from the slug rather than losing it.
    needs_credentials: ["accounts", "subscriptions"].includes(base.slug) ? 1 : 0,
    allow_volume_discount: ["accounts", "boosting"].includes(base.slug) ? 0 : 1,
  };
}

/**
 * Games a seller can list in, for step 2 of the wizard.
 *
 * Two different inventory models live side by side: most categories sell
 * admin-defined `products`, but Accounts and Boosting are free-form
 * `listings` (every account is unique, so there is nothing to pre-define).
 * A game qualifies if it is attached to the category at all — otherwise
 * Accounts and Boosting show an empty picker, since they have no products.
 */
export const getSellGames = unstable_cache(
  (category: string) =>
    all<{ slug: string; name: string; logo: string; products: number }>(
      `SELECT g.slug, g.name, g.logo,
              (SELECT COUNT(*) FROM products p
                WHERE p.game_slug = g.slug AND p.category_slug = ? AND p.status='active') AS products
         FROM games g
         JOIN game_categories gc ON gc.game_slug = g.slug
        WHERE gc.category_slug = ? AND g.status='active'
        ORDER BY ${NAME_SORT("g.name")}`,
      [category, category]
    ),
  ["sell-games"],
  { tags: ["catalog"], revalidate: 300 }
);

/** Admin-listed products for one game+category — step 3 of the wizard. */
export const getSellProducts = unstable_cache(
  (game: string, category: string) =>
    all<{
    id: string; name: string; image: string; base_price: number;
    region: string | null; platform: string | null; delivery_method: string | null;
    market_min: number | null; offer_count: number;
  }>(
    `SELECT p.id, p.name, p.image, p.base_price, p.region, p.platform, p.delivery_method,
            (SELECT MIN(o.price) FROM offers o
              WHERE o.product_id=p.id AND o.status='active' AND o.stock>0) AS market_min,
            (SELECT COUNT(*) FROM offers o
              WHERE o.product_id=p.id AND o.status='active' AND o.stock>0) AS offer_count
       FROM products p
        WHERE p.game_slug=? AND p.category_slug=? AND p.status='active'
        ORDER BY p.sort_order, p.base_price`,
      [game, category]
    ),
  ["sell-products"],
  { tags: ["catalog"], revalidate: 300 }
);

/**
 * Every dropdown the offer form needs, in ONE query.
 *
 * The wizard needs six lists (region, platform, delivery method, delivery time,
 * login method…). Fetching them individually is six network round-trips to
 * Turso for what is a single small table; grouping them client-side turns that
 * into one. Cached, because option lists only change when an admin edits them.
 */
export const getOptionLists = unstable_cache(
  async (keys: string[]): Promise<Record<string, { value: string; label: string }[]>> => {
    if (!keys.length) return {};
    const rows = await all<{ list_key: string; value: string; label: string }>(
      `SELECT list_key, value, label FROM option_lists
        WHERE active=1 AND list_key IN (${keys.map(() => "?").join(",")})
        ORDER BY sort_order, label`,
      keys
    );
    const out: Record<string, { value: string; label: string }[]> = {};
    for (const k of keys) out[k] = [];
    for (const r of rows) (out[r.list_key] ??= []).push({ value: r.value, label: r.label });
    return out;
  },
  ["option-lists"],
  { tags: ["catalog", "options"], revalidate: 300 }
);

/** Admin-managed dropdown values (regions, platforms, delivery methods…). */
export const getOptionList = unstable_cache(
  (listKey: string) =>
    all<{ value: string; label: string }>(
      `SELECT value, label FROM option_lists
        WHERE list_key=? AND active=1 ORDER BY sort_order, label`,
      [listKey]
    ),
  ["option-list"],
  { tags: ["catalog", "options"], revalidate: 300 }
);
