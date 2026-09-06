import "server-only";
import { all, one } from "./db";

/* ============================ dashboard ============================ */

export const getAdminStats = async () => {
  const [rev, orders, users, sellers, pendingKyc, openDisputes, pendingWd, flagged, pendingBuyerKyc] =
    await Promise.all([
      one<{ gross: number; fees: number; commission: number }>(
        `SELECT COALESCE(SUM(o.total),0) AS gross, COALESCE(SUM(o.fee),0) AS fees,
                (SELECT COALESCE(SUM(commission_amt),0) FROM order_items) AS commission
           FROM orders o WHERE o.payment_status='paid'`
      ),
      one<{ n: number; today: number }>(
        `SELECT COUNT(*) AS n,
                SUM(CASE WHEN date(created_at)=date('now') THEN 1 ELSE 0 END) AS today
           FROM orders`
      ),
      one<{ n: number; today: number }>(
        `SELECT COUNT(*) AS n,
                SUM(CASE WHEN date(created_at)=date('now') THEN 1 ELSE 0 END) AS today
           FROM users`
      ),
      one<{ n: number; active: number }>(
        `SELECT COUNT(*) AS n, SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) AS active
           FROM seller_profiles`
      ),
      one<{ n: number }>(`SELECT COUNT(*) AS n FROM seller_verifications WHERE status='pending'`),
      one<{ n: number }>(`SELECT COUNT(*) AS n FROM disputes WHERE status IN ('open','under_review')`),
      one<{ n: number }>(`SELECT COUNT(*) AS n FROM withdrawals WHERE status='pending'`),
      one<{ n: number }>(`SELECT COUNT(*) AS n FROM messages WHERE flagged=1 AND admin_reviewed=0`),
      one<{ n: number }>(`SELECT COUNT(*) AS n FROM buyer_verifications WHERE status='pending'`),
    ]);
  return {
    rev, orders, users, sellers,
    pendingKyc: Number(pendingKyc?.n ?? 0),
    openDisputes: Number(openDisputes?.n ?? 0),
    pendingWd: Number(pendingWd?.n ?? 0),
    flagged: Number(flagged?.n ?? 0),
    pendingBuyerKyc: Number(pendingBuyerKyc?.n ?? 0),
  };
};

export const getAdminSalesSeries = (days = 14) =>
  all<{ d: string; revenue: number; orders: number; commission: number }>(
    `SELECT date(o.created_at) AS d,
            COALESCE(SUM(o.total),0) AS revenue,
            COUNT(DISTINCT o.id) AS orders,
            COALESCE((SELECT SUM(oi.commission_amt) FROM order_items oi
                       WHERE oi.order_id IN (SELECT id FROM orders WHERE date(created_at)=date(o.created_at))),0) AS commission
       FROM orders o
      WHERE o.created_at >= date('now', '-' || ? || ' days')
      GROUP BY date(o.created_at) ORDER BY d`,
    [days]
  );

/* ============================= catalog ============================= */

export const adminGames = () =>
  all(
    `SELECT g.*,
            (SELECT COUNT(*) FROM game_categories gc WHERE gc.game_slug=g.slug) AS categories,
            (SELECT COUNT(*) FROM products p WHERE p.game_slug=g.slug) AS products,
            (SELECT group_concat(gc.category_slug) FROM game_categories gc WHERE gc.game_slug=g.slug) AS cat_slugs
       FROM games g ORDER BY g.sort_order, g.name`
  );

export const adminCategories = () =>
  all(
    `SELECT c.*,
            (SELECT COUNT(*) FROM game_categories gc WHERE gc.category_slug=c.slug) AS games,
            (SELECT COUNT(*) FROM products p WHERE p.category_slug=c.slug) AS products
       FROM categories c ORDER BY c.sort_order`
  );

export const adminGameCategories = (game: string) =>
  all<{ category_slug: string }>(`SELECT category_slug FROM game_categories WHERE game_slug=?`, [game]);

export const adminProducts = (opts: { game?: string; category?: string; q?: string; limit?: number }) => {
  const w: string[] = ["1=1"];
  const a: unknown[] = [];
  if (opts.game) { w.push("p.game_slug=?"); a.push(opts.game); }
  if (opts.category) { w.push("p.category_slug=?"); a.push(opts.category); }
  if (opts.q) { w.push("p.name LIKE ?"); a.push(`%${opts.q}%`); }
  a.push(Math.min(opts.limit ?? 100, 500));
  return all(
    `SELECT p.*, g.name AS game_name, c.name AS category_name,
            (SELECT COUNT(*) FROM offers o WHERE o.product_id=p.id) AS offer_count,
            (SELECT MIN(o.price) FROM offers o WHERE o.product_id=p.id AND o.status='active') AS min_price
       FROM products p
       JOIN games g ON g.slug=p.game_slug
       JOIN categories c ON c.slug=p.category_slug
      WHERE ${w.join(" AND ")}
      ORDER BY g.sort_order, p.base_price LIMIT ?`,
    a as never
  );
};

export const adminTemplates = (category: string) =>
  all(`SELECT * FROM field_templates WHERE category_slug=? ORDER BY sort_order`, [category]);

/* ============================== offers ============================= */

export const adminOffers = (opts: { q?: string; status?: string; limit?: number }) => {
  const w: string[] = ["1=1"];
  const a: unknown[] = [];
  if (opts.status && opts.status !== "all") { w.push("o.status=?"); a.push(opts.status); }
  if (opts.q) { w.push("(p.name LIKE ? OR sp.store_name LIKE ?)"); a.push(`%${opts.q}%`, `%${opts.q}%`); }
  a.push(Math.min(opts.limit ?? 100, 500));
  return all(
    `SELECT o.*, p.name AS product_name, p.image, g.name AS game_name, c.name AS category_name,
            sp.store_name, sp.user_id AS seller_user
       FROM offers o
       JOIN products p ON p.id=o.product_id
       JOIN games g ON g.slug=p.game_slug
       JOIN categories c ON c.slug=p.category_slug
       JOIN seller_profiles sp ON sp.user_id=o.seller_id
      WHERE ${w.join(" AND ")}
      ORDER BY o.updated_at DESC LIMIT ?`,
    a as never
  );
};

/* ========================== users & sellers ======================== */

export const adminUsers = (opts: { q?: string; role?: string; limit?: number }) => {
  const w: string[] = ["1=1"];
  const a: unknown[] = [];
  if (opts.role && opts.role !== "all") { w.push("u.role=?"); a.push(opts.role); }
  if (opts.q) { w.push("(u.name LIKE ? OR u.email LIKE ?)"); a.push(`%${opts.q}%`, `%${opts.q}%`); }
  a.push(Math.min(opts.limit ?? 100, 500));
  return all(
    `SELECT u.id,u.name,u.email,u.role,u.status,u.balance,u.is_seller,u.country,u.created_at,
            (SELECT COUNT(*) FROM orders o WHERE o.buyer_id=u.id) AS orders,
            (SELECT COALESCE(SUM(total),0) FROM orders o WHERE o.buyer_id=u.id) AS spent
       FROM users u WHERE ${w.join(" AND ")}
      ORDER BY u.created_at DESC LIMIT ?`,
    a as never
  );
};

export const adminSellers = (status?: string) =>
  all(
    `SELECT sp.*, u.name, u.email, u.status AS user_status,
            (SELECT COUNT(*) FROM offers o WHERE o.seller_id=sp.user_id) AS offers,
            (SELECT status FROM seller_verifications v WHERE v.user_id=sp.user_id
              ORDER BY submitted_at DESC LIMIT 1) AS kyc_status
       FROM seller_profiles sp
       JOIN users u ON u.id=sp.user_id
      ${status && status !== "all" ? "WHERE sp.status=?" : ""}
      ORDER BY sp.rank_order, sp.total_sales DESC`,
    status && status !== "all" ? [status] : []
  );

export const adminVerifications = (status = "pending") =>
  all(
    `SELECT v.*, u.name AS user_name, u.email, sp.store_name
       FROM seller_verifications v
       JOIN users u ON u.id=v.user_id
       LEFT JOIN seller_profiles sp ON sp.user_id=v.user_id
      ${status !== "all" ? "WHERE v.status=?" : ""}
      ORDER BY v.submitted_at DESC`,
    status !== "all" ? [status] : []
  );

/* ============================== orders ============================= */

export const adminOrders = (opts: { status?: string; q?: string; limit?: number }) => {
  const w: string[] = ["1=1"];
  const a: unknown[] = [];
  if (opts.status && opts.status !== "all") { w.push("o.status=?"); a.push(opts.status); }
  if (opts.q) { w.push("(o.code LIKE ? OR u.email LIKE ?)"); a.push(`%${opts.q}%`, `%${opts.q}%`); }
  a.push(Math.min(opts.limit ?? 100, 500));
  return all(
    `SELECT o.*, u.name AS buyer_name, u.email AS buyer_email,
            (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id=o.id) AS items,
            (SELECT oi.title FROM order_items oi WHERE oi.order_id=o.id LIMIT 1) AS first_title
       FROM orders o JOIN users u ON u.id=o.buyer_id
      WHERE ${w.join(" AND ")}
      ORDER BY o.created_at DESC LIMIT ?`,
    a as never
  );
};

export const adminDeliveryLogs = (limit = 100) =>
  all(
    `SELECT oi.id, oi.title, oi.status, oi.delivered_at, o.code,
            sp.store_name, u.name AS buyer_name
       FROM order_items oi
       JOIN orders o ON o.id=oi.order_id
       LEFT JOIN seller_profiles sp ON sp.user_id=oi.seller_id
       JOIN users u ON u.id=o.buyer_id
      WHERE oi.delivered_at IS NOT NULL
      ORDER BY oi.delivered_at DESC LIMIT ?`,
    [limit]
  );

/* ============================= finance ============================= */

export const adminWithdrawals = (status = "all") =>
  all(
    `SELECT w.*, u.name, u.email, sp.store_name, sp.available_bal
       FROM withdrawals w
       JOIN users u ON u.id=w.seller_id
       LEFT JOIN seller_profiles sp ON sp.user_id=w.seller_id
      ${status !== "all" ? "WHERE w.status=?" : ""}
      ORDER BY w.created_at DESC`,
    status !== "all" ? [status] : []
  );

export const adminTransactions = (limit = 150) =>
  all(
    `SELECT t.*, u.name, u.email FROM transactions t
       JOIN users u ON u.id=t.user_id
      ORDER BY t.created_at DESC LIMIT ?`,
    [limit]
  );

export const adminWallets = () =>
  all(
    `SELECT u.id, u.name, u.email, u.balance,
            COALESCE(sp.available_bal,0) AS available_bal,
            COALESCE(sp.pending_bal,0) AS pending_bal
       FROM users u LEFT JOIN seller_profiles sp ON sp.user_id=u.id
      WHERE u.balance > 0 OR sp.available_bal > 0 OR sp.pending_bal > 0
      ORDER BY (u.balance + COALESCE(sp.available_bal,0)) DESC LIMIT 100`
  );

export const adminCommission = () =>
  all(
    `SELECT sp.store_name, sp.commission_pct,
            COUNT(oi.id) AS orders,
            COALESCE(SUM(oi.line_total),0) AS gross,
            COALESCE(SUM(oi.commission_amt),0) AS commission
       FROM seller_profiles sp
       LEFT JOIN order_items oi ON oi.seller_id=sp.user_id
      GROUP BY sp.user_id ORDER BY commission DESC`
  );

/* ======================== disputes & support ======================= */

export const adminDisputes = (status = "all") =>
  all(
    `SELECT d.*, b.name AS buyer_name, s.name AS seller_name, sp.store_name, o.code AS order_code
       FROM disputes d
       JOIN users b ON b.id=d.buyer_id
       JOIN users s ON s.id=d.seller_id
       LEFT JOIN seller_profiles sp ON sp.user_id=d.seller_id
       LEFT JOIN orders o ON o.id=d.order_id
      ${status !== "all" ? "WHERE d.status=?" : ""}
      ORDER BY d.created_at DESC`,
    status !== "all" ? [status] : []
  );

export const adminTickets = (status = "all") =>
  all(
    `SELECT t.*, u.name, u.email,
            (SELECT body FROM ticket_messages m WHERE m.ticket_id=t.id ORDER BY created_at LIMIT 1) AS first_msg
       FROM tickets t JOIN users u ON u.id=t.user_id
      ${status !== "all" ? "WHERE t.status=?" : ""}
      ORDER BY t.created_at DESC`,
    status !== "all" ? [status] : []
  );

/* ====================== message monitoring ========================= */

export const adminThreads = (opts: { flaggedOnly?: boolean; q?: string }) => {
  const w: string[] = ["1=1"];
  const a: unknown[] = [];
  if (opts.flaggedOnly) w.push("(SELECT COUNT(*) FROM messages m WHERE m.thread_id=t.id AND m.flagged=1) > 0");
  if (opts.q) { w.push("(bu.email LIKE ? OR sp.store_name LIKE ?)"); a.push(`%${opts.q}%`, `%${opts.q}%`); }
  return all(
    `SELECT t.id, t.order_id, t.updated_at,
            bu.name AS buyer_name, bu.email AS buyer_email, bu.id AS buyer_id,
            su.name AS seller_name, sp.store_name, su.id AS seller_id,
            (SELECT COUNT(*) FROM messages m WHERE m.thread_id=t.id) AS msg_count,
            (SELECT COUNT(*) FROM messages m WHERE m.thread_id=t.id AND m.flagged=1) AS flag_count,
            (SELECT body FROM messages m WHERE m.thread_id=t.id ORDER BY created_at DESC LIMIT 1) AS last_body
       FROM threads t
       JOIN users bu ON bu.id=t.buyer_id
       JOIN users su ON su.id=t.seller_id
       LEFT JOIN seller_profiles sp ON sp.user_id=t.seller_id
      WHERE ${w.join(" AND ")}
      ORDER BY flag_count DESC, t.updated_at DESC LIMIT 100`,
    a as never
  );
};

export const adminThreadMessages = (threadId: string) =>
  all(
    `SELECT m.*, u.name AS sender_name, u.role AS sender_role
       FROM messages m JOIN users u ON u.id=m.sender_id
      WHERE m.thread_id=? ORDER BY m.created_at`,
    [threadId]
  );

export const adminFlaggedMessages = (limit = 100) =>
  all(
    `SELECT m.*, u.name AS sender_name, u.email AS sender_email, m.thread_id
       FROM messages m JOIN users u ON u.id=m.sender_id
      WHERE m.flagged=1 ORDER BY m.admin_reviewed, m.created_at DESC LIMIT ?`,
    [limit]
  );

/* ============================ marketing ============================ */

export const adminCoupons = () => all(`SELECT * FROM coupons ORDER BY created_at DESC`);
export const adminAnnouncements = () => all(`SELECT * FROM announcements ORDER BY created_at DESC`);
export const adminCmsBlocks = () => all(`SELECT * FROM cms_blocks ORDER BY key`);

/* ============================== system ============================= */

export const adminRoles = () =>
  all(
    `SELECT r.*, (SELECT COUNT(*) FROM admin_users au WHERE au.role_id=r.id) AS members
       FROM admin_roles r ORDER BY r.name`
  );

export const adminAdmins = () =>
  all(
    `SELECT u.id, u.name, u.email, r.name AS role_name, r.id AS role_id
       FROM users u
       LEFT JOIN admin_users au ON au.user_id=u.id
       LEFT JOIN admin_roles r ON r.id=au.role_id
      WHERE u.role='admin' ORDER BY u.created_at`
  );

export const adminSettings = () => all<{ key: string; value: string }>(`SELECT key, value FROM settings`);

export const adminActivity = (limit = 100) =>
  all(
    `SELECT a.*, u.name, u.email FROM audit_logs a
       LEFT JOIN users u ON u.id=a.actor_id
      ORDER BY a.created_at DESC LIMIT ?`,
    [limit]
  );

/* ============================= reports ============================= */

export const reportTopProducts = (limit = 20) =>
  all(
    `SELECT oi.title, COUNT(*) AS orders, SUM(oi.line_total) AS revenue,
            SUM(oi.commission_amt) AS commission
       FROM order_items oi GROUP BY oi.title
      ORDER BY revenue DESC LIMIT ?`,
    [limit]
  );

export const reportTopSellers = (limit = 20) =>
  all(
    `SELECT sp.store_name, sp.rating, COUNT(oi.id) AS orders,
            COALESCE(SUM(oi.line_total),0) AS revenue,
            COALESCE(SUM(oi.commission_amt),0) AS commission
       FROM seller_profiles sp
       LEFT JOIN order_items oi ON oi.seller_id=sp.user_id
      GROUP BY sp.user_id ORDER BY revenue DESC LIMIT ?`,
    [limit]
  );

export const reportCategoryRevenue = () =>
  all(
    `SELECT c.name, COUNT(oi.id) AS orders, COALESCE(SUM(oi.line_total),0) AS revenue
       FROM order_items oi
       JOIN products p ON p.id=oi.product_id
       JOIN categories c ON c.slug=p.category_slug
      GROUP BY c.slug ORDER BY revenue DESC`
  );

/* ==================== option lists, media & banners ==================== */

export type OptionRow = {
  id: string; list_key: string; value: string; label: string;
  sort_order: number; active: number;
};

export const adminOptions = (listKey?: string) =>
  listKey
    ? all<OptionRow>(
        `SELECT * FROM option_lists WHERE list_key=? ORDER BY sort_order, label`,
        [listKey]
      )
    : all<OptionRow>(`SELECT * FROM option_lists ORDER BY list_key, sort_order, label`);

/** Active options grouped by list — used to build the product-form dropdowns. */
export async function optionGroups(): Promise<Record<string, OptionRow[]>> {
  const rows = await all<OptionRow>(
    `SELECT * FROM option_lists WHERE active=1 ORDER BY sort_order, label`
  );
  const out: Record<string, OptionRow[]> = {};
  rows.forEach((r) => {
    (out[r.list_key] ??= []).push(r);
  });
  return out;
}

export const adminMedia = (kind?: string, limit = 200) =>
  kind && kind !== "all"
    ? all(
        `SELECT id,kind,name,mime,size,ref_key,created_at FROM media
          WHERE kind=? ORDER BY created_at DESC LIMIT ?`,
        [kind, limit]
      )
    : all(
        `SELECT id,kind,name,mime,size,ref_key,created_at FROM media
          ORDER BY created_at DESC LIMIT ?`,
        [limit]
      );

export const adminBanners = (placement?: string) =>
  placement && placement !== "all"
    ? all(`SELECT * FROM banners WHERE placement=? ORDER BY sort_order, created_at`, [placement])
    : all(`SELECT * FROM banners ORDER BY placement, sort_order, created_at`);

export const adminNavLinks = () =>
  all<{
    id: string; section: string; label: string; href: string;
    placement: string; sort_order: number; active: number;
  }>(`SELECT * FROM nav_links ORDER BY placement, section, sort_order, label`);
