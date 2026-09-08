import "server-only";
import { unstable_cache } from "next/cache";
import { all, one } from "./db";
import { NAME_SORT } from "./homepage";

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
  }>(
    `SELECT * FROM (
       SELECT ci.id AS key, ci.offer_id, ci.listing_id, o.product_id,
              p.name AS title,
              g.name || ' · ' || c.name AS sub,
              p.image, o.seller_id, sp.store_name, o.price, ci.qty, o.stock,
              o.delivery_time AS delivery,
              '/g/' || p.game_slug || '/' || p.category_slug || '/' || p.slug AS href,
              ci.opt_region, ci.opt_delivery
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
              ci.opt_region, ci.opt_delivery
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
            CASE WHEN t.buyer_id=? THEN sp.store_name ELSE bu.name END AS other_name,
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

export const getSellerOffers = (sellerId: string, status?: string, category?: string) => {
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
  sql += ` ORDER BY o.updated_at DESC`;
  return all(sql, args);
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
            u.name AS buyer_name, u.email AS buyer_email, o.buyer_id
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
            u.name AS buyer_name, u.email AS buyer_email, o.buyer_id
       FROM order_items oi
       JOIN orders o ON o.id=oi.order_id
       JOIN users u ON u.id=o.buyer_id
      WHERE oi.id=? AND oi.seller_id=?`,
    [id, sellerId]
  );

export const getSellerReviews = (sellerId: string) =>
  all(
    `SELECT r.*, u.name AS buyer_name FROM reviews r
       JOIN users u ON u.id=r.buyer_id
      WHERE r.seller_id=? ORDER BY r.created_at DESC`,
    [sellerId]
  );

export const getSellerDisputes = (sellerId: string) =>
  all(
    `SELECT d.*, u.name AS buyer_name FROM disputes d
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

export const getFieldTemplates = (category: string) =>
  all(`SELECT * FROM field_templates WHERE category_slug=? ORDER BY sort_order`, [category]);

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
