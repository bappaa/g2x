"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { all, one, run, tx, nid } from "../db";
import { requireSeller } from "../session";

export type R = { ok: boolean; error?: string; id?: string };

import { mail } from "../mail";
import { escrowHoldHours } from "../escrow";
import { scheduleSubscriptions } from "../subscription";
import { getWallet, WITHDRAW_SQL } from "../wallet";
import { RESERVED_FIELD_KEYS } from "../queries";
import { ensureSchema } from "../ensure-schema";

async function notify(userId: string, title: string, body: string, href: string, kind = "order") {
  await run(
    `INSERT INTO notifications (id,user_id,title,body,href,kind) VALUES (?,?,?,?,?,?)`,
    [nid("ntf_"), userId, title, body, href, kind]
  );
}

const num = (v: FormDataEntryValue | null | undefined, def = 0) => {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : def;
};

/* ============================= offers ============================= */

export async function saveOfferAction(form: FormData): Promise<R> {
  const s = await requireSeller();

  const id = String(form.get("id") ?? "").trim();
  const productId = String(form.get("productId") ?? "").trim();
  const price = num(form.get("price"));
  const oldPrice = num(form.get("oldPrice"));
  const stock = Math.floor(num(form.get("stock")));
  const deliveryTime = String(form.get("deliveryTime") ?? "").trim();
  const deliveryMethod = String(form.get("deliveryMethod") ?? "").trim();
  const loginMethod = String(form.get("loginMethod") ?? "").trim();
  const region = String(form.get("region") ?? "").trim();
  const platform = String(form.get("platform") ?? "").trim();
  const instructions = String(form.get("instructions") ?? "").trim();
  const status = String(form.get("status") ?? "active");
  const featured = form.get("featured") ? 1 : 0;
  const pinned = form.get("pinned") ? 1 : 0;

  const custom: Record<string, string> = {};
  Array.from(form.keys()).forEach((k) => {
    if (k.startsWith("cf_")) custom[k.slice(3)] = String(form.get(k));
  });

  if (!productId) return { ok: false, error: "Select a product first." };
  if (!(price > 0)) return { ok: false, error: "Price must be greater than 0." };
  if (oldPrice && oldPrice <= price)
    return { ok: false, error: "Old price should be higher than the selling price." };
  if (stock < 0) return { ok: false, error: "Stock cannot be negative." };
  if (!deliveryTime) return { ok: false, error: "Delivery time is required." };

  const product = await one<{ name: string }>(`SELECT name FROM products WHERE id=? AND status='active'`, [productId]);
  if (!product) return { ok: false, error: "That product no longer exists." };

  const finalStatus = stock <= 0 && status === "active" ? "out_of_stock" : status;

  if (id) {
    const owned = await one(`SELECT id FROM offers WHERE id=? AND seller_id=?`, [id, s.id]);
    if (!owned) return { ok: false, error: "Offer not found." };
    await run(
      `UPDATE offers SET product_id=?, title=?, price=?, old_price=?, stock=?, delivery_time=?,
              delivery_method=?, login_method=?, region=?, platform=?, instructions=?,
              custom_fields=?, status=?, featured=?, pinned=?, updated_at=datetime('now')
        WHERE id=? AND seller_id=?`,
      [productId, product.name, price, oldPrice || null, stock, deliveryTime, deliveryMethod || null,
       loginMethod || null, region || null, platform || null, instructions || null,
       JSON.stringify(custom), finalStatus, featured, pinned, id, s.id]
    );
  } else {
    const dupe = await one(`SELECT id FROM offers WHERE seller_id=? AND product_id=?`, [s.id, productId]);
    if (dupe) return { ok: false, error: "You already have an offer on this product. Edit it instead." };
    await run(
      `INSERT INTO offers (id,seller_id,product_id,title,price,old_price,stock,delivery_time,
              delivery_method,login_method,region,platform,instructions,custom_fields,
              status,featured,pinned)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [nid("off_"), s.id, productId, product.name, price, oldPrice || null, stock, deliveryTime,
       deliveryMethod || null, loginMethod || null, region || null, platform || null,
       instructions || null, JSON.stringify(custom), finalStatus, featured, pinned]
    );
  }

  revalidatePath("/seller/offers");
  return { ok: true };
}

/**
 * Create an offer from the multi-step sell wizard.
 *
 * Distinct from `saveOfferAction` (the quick inline editor) because the wizard
 * collects the richer, admin-configured payload: images, per-account
 * credentials, volume discounts and whatever `field_templates` the admin
 * defined for the category. Validation mirrors the client so a crafted request
 * cannot bypass it.
 */
export async function createOfferAction(form: FormData): Promise<R> {
  const s = await requireSeller();
  // Git deploys do not migrate; make sure the Phase-19 columns exist first.
  await ensureSchema();

  const productId = String(form.get("productId") ?? "").trim();
  const gameSlug = String(form.get("gameSlug") ?? "").trim();
  const categorySlug = String(form.get("categorySlug") ?? "").trim();

  /**
   * Two inventory models:
   *  - `products`  — admin-defined SKUs (currency, top-ups, items…). The seller
   *                  picks one and competes on price.
   *  - `listings`  — free-form, one-of-a-kind (accounts, boosting). There is no
   *                  product to pick, so the seller describes it themselves.
   */
  const freeForm = !productId;

  let product: { name: string; category_slug: string } | null = null;
  if (!freeForm) {
    product = await one<{ name: string; category_slug: string }>(
      `SELECT name, category_slug FROM products WHERE id=? AND status='active'`,
      [productId]
    );
    if (!product) return { ok: false, error: "That product no longer exists." };
  } else {
    if (!gameSlug || !categorySlug)
      return { ok: false, error: "Missing game or category." };
    const g = await one(`SELECT slug FROM games WHERE slug=? AND status='active'`, [gameSlug]);
    if (!g) return { ok: false, error: "That game no longer exists." };
    product = { name: "", category_slug: categorySlug };
  }

  const cfg = await one<{
    needs_title: number; needs_credentials: number; allow_volume_discount: number;
  }>(
    `SELECT needs_title, needs_credentials, allow_volume_discount
       FROM categories WHERE slug=?`,
    [product!.category_slug]
  ).catch(() => null);

  const price = num(form.get("price"));
  const stock = Math.max(0, Math.floor(num(form.get("stock"))));
  const minQty = Math.max(1, Math.floor(num(form.get("minQty")) || 1));
  const title = String(form.get("title") ?? "").trim() || product?.name || "";
  const description = String(form.get("description") ?? "").trim();
  const deliveryTime = String(form.get("deliveryTime") ?? "").trim();
  const deliveryMethod = String(form.get("deliveryMethod") ?? "").trim();
  const region = String(form.get("region") ?? "").trim();
  const platform = String(form.get("platform") ?? "").trim();
  const loginMethod = String(form.get("loginMethod") ?? "").trim();
  const instructions = String(form.get("instructions") ?? "").trim();
  const autoDelivery = String(form.get("autoDelivery") ?? "1") === "1" ? 1 : 0;

  if (!(price > 0)) return { ok: false, error: "Price must be greater than 0." };
  if (!deliveryTime) return { ok: false, error: "Delivery time is required." };
  if (cfg?.needs_title && !String(form.get("title") ?? "").trim())
    return { ok: false, error: "Offer title is required." };

  // Admin-defined fields for this category, re-validated server-side.
  const templates = await all<{ label: string; field_key: string; required: number }>(
    `SELECT label, field_key, required FROM field_templates
      WHERE category_slug=? AND lower(field_key) NOT IN (${RESERVED_FIELD_KEYS.map(() => "?").join(",")})`,
    [product!.category_slug, ...RESERVED_FIELD_KEYS]
  );
  const custom: Record<string, string> = {};
  Array.from(form.keys()).forEach((k) => {
    if (k.startsWith("cf_")) custom[k.slice(3)] = String(form.get(k));
  });
  for (const t of templates) {
    if (t.required && !String(custom[t.field_key] ?? "").trim())
      return { ok: false, error: `${t.label} is required.` };
  }

  const parseJson = <T,>(key: string, fallback: T): T => {
    try {
      const v = JSON.parse(String(form.get(key) ?? ""));
      return (v ?? fallback) as T;
    } catch {
      return fallback;
    }
  };

  const images = parseJson<string[]>("images", []).filter(
    (d) => typeof d === "string" && d.startsWith("data:image/")
  );
  const volume = cfg?.allow_volume_discount
    ? parseJson<{ qty: number; pct: number }[]>("volumeDiscounts", []).filter(
        (v) => Number(v.qty) > 0 && Number(v.pct) > 0 && Number(v.pct) < 100
      )
    : [];

  let accounts: unknown[] = [];
  if (cfg?.needs_credentials && autoDelivery) {
    accounts = parseJson<Record<string, string>[]>("accounts", []);
    // Gift cards store the code in `login` and need nothing else.
    const isGiftCard = product!.category_slug === "gift-cards";
    const bad = accounts.findIndex((a) => {
      const r = a as Record<string, string>;
      const noCode = !String(r?.login ?? "").trim();
      return isGiftCard ? noCode : noCode || !String(r?.password ?? "").trim();
    });
    if (bad >= 0)
      return {
        ok: false,
        error: isGiftCard
          ? `Gift Card #${bad + 1} needs a code.`
          : `Account #${bad + 1} needs a login and password.`,
      };
  }

  const finalStock = cfg?.needs_credentials && autoDelivery ? Math.max(1, accounts.length) : stock;
  const status = finalStock <= 0 ? "out_of_stock" : "active";

  if (freeForm) {
    /**
     * Two very different "free-form" cases.
     *
     * Accounts and Boosting are genuinely one-of-a-kind, so they live in
     * `listings` — that is what those category grids read.
     *
     * Everything else (Currency, Items, Top Up, Gift Cards, Subscriptions) is
     * rendered from `products` + `offers`. Writing a listing row for those was
     * a dead end: the seller's offer saved successfully and then never appeared
     * anywhere on the site, because those pages never look at `listings`.
     *
     * So for a product-backed category the seller's own item becomes a real
     * product (reusing an identical one if a seller already created it, so the
     * catalog does not fill with duplicates) and the offer hangs off it. The
     * result is a normal, comparable product page that the admin can edit.
     */
    const LISTING_CATEGORIES = ["accounts", "boosting"];

    if (LISTING_CATEGORIES.includes(categorySlug)) {
      /**
       * Carry the automatic-delivery payload.
       *
       * `listings` previously stored only the basics, so an account sold as
       * "Automatic" lost its pre-filled credentials and behaved as manual —
       * while subscriptions (which use `offers`) worked. Both tables now hold
       * the same delivery fields.
       */
      await run(
        `INSERT INTO listings
                (id,seller_id,game_slug,category_slug,title,description,image,price,stock,
                 delivery_time,status,auto_delivery,accounts_data,images,delivery_method,
                 instructions,min_qty,custom_fields)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          nid("lst_"), s.id, gameSlug, categorySlug, title.slice(0, 160),
          description || null, images[0] ?? null, price, finalStock,
          deliveryTime, status === "out_of_stock" ? "paused" : "active",
          autoDelivery,
          accounts.length ? JSON.stringify(accounts) : null,
          JSON.stringify(images),
          deliveryMethod || null,
          instructions || null,
          minQty,
          JSON.stringify(custom),
        ]
      );
    } else {
      // Reuse an existing product with the same name in this game+category.
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || nid("p");

      let target = await one<{ id: string }>(
        `SELECT id FROM products
          WHERE game_slug=? AND category_slug=? AND lower(name)=lower(?) AND status='active'`,
        [gameSlug, categorySlug, title.slice(0, 160)]
      );

      if (!target) {
        const newId = nid("prd_");
        await run(
          `INSERT INTO products
                  (id,slug,game_slug,category_slug,name,image,base_price,region,platform,
                   delivery_method,delivery_time,status)
           VALUES (?,?,?,?,?,?,?,?,?,?,?, 'active')`,
          [
            newId,
            `${slug}-${newId.slice(-6)}`,
            gameSlug,
            categorySlug,
            title.slice(0, 160),
            images[0] ?? "/art/coins.png",
            price,
            region || "Global",
            platform || "All",
            deliveryMethod || null,
            deliveryTime,
          ]
        );
        target = { id: newId };
      }

      // Keep the game visible under this category, or the product is orphaned.
      await run(
        `INSERT OR IGNORE INTO game_categories (game_slug, category_slug) VALUES (?,?)`,
        [gameSlug, categorySlug]
      );

      await run(
        `INSERT INTO offers (id,seller_id,product_id,title,description,price,stock,min_qty,
                delivery_time,delivery_method,login_method,region,platform,instructions,
                custom_fields,images,volume_discounts,accounts_data,auto_delivery,status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          nid("off_"), s.id, target.id, title.slice(0, 160), description || null,
          price, finalStock, minQty, deliveryTime,
          deliveryMethod || null, loginMethod || null, region || null, platform || null,
          instructions || null, JSON.stringify(custom), JSON.stringify(images),
          JSON.stringify(volume), accounts.length ? JSON.stringify(accounts) : null,
          autoDelivery, status,
        ]
      );
    }
  } else {
    const offerId = nid("off_");
    try {
      await run(
        `INSERT INTO offers (id,seller_id,product_id,title,description,price,stock,min_qty,
                delivery_time,delivery_method,login_method,region,platform,instructions,
                custom_fields,images,volume_discounts,accounts_data,auto_delivery,status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          offerId, s.id, productId, title.slice(0, 160), description || null,
          price, finalStock, minQty, deliveryTime,
          deliveryMethod || null, loginMethod || null, region || null, platform || null,
          instructions || null, JSON.stringify(custom), JSON.stringify(images),
          JSON.stringify(volume), accounts.length ? JSON.stringify(accounts) : null,
          autoDelivery, status,
        ]
      );
    } catch (e) {
      // If the Phase-19 columns are still absent, publish the offer with the
      // long-standing columns rather than losing the seller's work.
      if (!/no such column/i.test(String((e as Error)?.message ?? ""))) throw e;
      await run(
        `INSERT INTO offers (id,seller_id,product_id,title,price,stock,delivery_time,
                delivery_method,login_method,region,platform,instructions,custom_fields,status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          offerId, s.id, productId, title.slice(0, 160), price, finalStock, deliveryTime,
          deliveryMethod || null, loginMethod || null, region || null, platform || null,
          instructions || null, JSON.stringify(custom), status,
        ]
      );
    }
  }

  revalidatePath("/seller/offers");
  revalidatePath("/seller");
  // A new offer changes the public product page's cheapest price.
  revalidateTag("catalog");
  return { ok: true };
}

export async function offerStatusAction(id: string, status: string): Promise<R> {
  const s = await requireSeller();
  await run(`UPDATE offers SET status=?, updated_at=datetime('now') WHERE id=? AND seller_id=?`, [status, id, s.id]);
  revalidatePath("/seller/offers");
  return { ok: true };
}

export async function offerStockAction(id: string, stock: number): Promise<R> {
  const s = await requireSeller();
  const n = Math.max(0, Math.floor(stock));
  await run(
    `UPDATE offers SET stock=?,
        status = CASE WHEN ?=0 THEN 'out_of_stock'
                      WHEN status='out_of_stock' THEN 'active' ELSE status END,
        updated_at=datetime('now')
      WHERE id=? AND seller_id=?`,
    [n, n, id, s.id]
  );
  revalidatePath("/seller/offers");
  return { ok: true };
}

export async function deleteOfferAction(id: string): Promise<R> {
  const s = await requireSeller();
  await run(`DELETE FROM offers WHERE id=? AND seller_id=?`, [id, s.id]);
  revalidatePath("/seller/offers");
  return { ok: true };
}

export async function duplicateOfferAction(id: string): Promise<R> {
  const s = await requireSeller();
  const o = await one<Record<string, unknown>>(`SELECT * FROM offers WHERE id=? AND seller_id=?`, [id, s.id]);
  if (!o) return { ok: false, error: "Offer not found." };
  await run(
    `INSERT INTO offers (id,seller_id,product_id,title,price,old_price,stock,delivery_time,
            delivery_method,login_method,region,platform,instructions,custom_fields,status)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'draft')`,
    [nid("off_"), s.id, o.product_id, o.title, o.price, o.old_price, o.stock, o.delivery_time,
     o.delivery_method, o.login_method, o.region, o.platform, o.instructions,
     o.custom_fields] as never
  );
  revalidatePath("/seller/offers");
  return { ok: true };
}

export async function bulkOfferAction(ids: string[], op: string, value?: number): Promise<R> {
  const s = await requireSeller();
  if (!ids.length) return { ok: false, error: "Select at least one offer." };
  const marks = ids.map(() => "?").join(",");

  if (op === "activate" || op === "pause") {
    await run(
      `UPDATE offers SET status=?, updated_at=datetime('now')
        WHERE seller_id=? AND id IN (${marks})`,
      [op === "activate" ? "active" : "paused", s.id, ...ids]
    );
  } else if (op === "delete") {
    await run(`DELETE FROM offers WHERE seller_id=? AND id IN (${marks})`, [s.id, ...ids]);
  } else if (op === "stock") {
    await run(
      `UPDATE offers SET stock=?, status=CASE WHEN ?=0 THEN 'out_of_stock' ELSE 'active' END
        WHERE seller_id=? AND id IN (${marks})`,
      [Math.max(0, value ?? 0), Math.max(0, value ?? 0), s.id, ...ids]
    );
  } else if (op === "price_pct") {
    const pct = value ?? 0;
    await run(
      `UPDATE offers SET price = ROUND(price * (1 + ?/100.0), 2), updated_at=datetime('now')
        WHERE seller_id=? AND id IN (${marks})`,
      [pct, s.id, ...ids]
    );
  }
  revalidatePath("/seller/offers");
  return { ok: true };
}

/* ============================ listings ============================ */

export async function saveListingAction(form: FormData): Promise<R> {
  const s = await requireSeller();
  const id = String(form.get("id") ?? "").trim();
  const game = String(form.get("game") ?? "").trim();
  const category = String(form.get("category") ?? "").trim();
  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const image = String(form.get("image") ?? "").trim() || "/art/bgmi.png";
  const price = num(form.get("price"));
  const stock = Math.floor(num(form.get("stock"), 1));
  const tier = String(form.get("tier") ?? "").trim();
  const level = Math.floor(num(form.get("level")));
  const outfits = Math.floor(num(form.get("outfits")));
  const deliveryTime = String(form.get("deliveryTime") ?? "").trim();
  const status = String(form.get("status") ?? "active");

  if (!game || !category) return { ok: false, error: "Choose a game and category." };
  if (title.length < 4) return { ok: false, error: "Title is too short." };
  if (!(price > 0)) return { ok: false, error: "Price must be greater than 0." };

  if (id) {
    const owned = await one(`SELECT id FROM listings WHERE id=? AND seller_id=?`, [id, s.id]);
    if (!owned) return { ok: false, error: "Listing not found." };
    await run(
      `UPDATE listings SET game_slug=?, category_slug=?, title=?, description=?, image=?,
              price=?, stock=?, tier=?, level=?, outfits=?, delivery_time=?, status=?
        WHERE id=? AND seller_id=?`,
      [game, category, title, description, image, price, stock, tier || null,
       level || null, outfits || null, deliveryTime || "5 - 30 min", status, id, s.id]
    );
  } else {
    await run(
      `INSERT INTO listings (id,seller_id,game_slug,category_slug,title,description,image,
              price,stock,tier,level,outfits,delivery_time,status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [nid("lst_"), s.id, game, category, title, description, image, price, stock,
       tier || null, level || null, outfits || null, deliveryTime || "5 - 30 min", status]
    );
  }
  revalidatePath("/seller/listings");
  return { ok: true };
}

export async function listingStatusAction(id: string, status: string): Promise<R> {
  const s = await requireSeller();
  await run(`UPDATE listings SET status=? WHERE id=? AND seller_id=?`, [status, id, s.id]);
  revalidatePath("/seller/listings");
  return { ok: true };
}

export async function deleteListingAction(id: string): Promise<R> {
  const s = await requireSeller();
  await run(`DELETE FROM listings WHERE id=? AND seller_id=?`, [id, s.id]);
  revalidatePath("/seller/listings");
  return { ok: true };
}

/* ============================= orders ============================= */

export async function deliverOrderAction(
  itemId: string,
  credentials: { label: string; value: string }[]
): Promise<R> {
  const s = await requireSeller();
  const item = await one<{ id: string; order_id: string; status: string; title: string }>(
    `SELECT id, order_id, status, title FROM order_items WHERE id=? AND seller_id=?`,
    [itemId, s.id]
  );
  if (!item) return { ok: false, error: "Order item not found." };
  if (!["processing", "disputed"].includes(item.status))
    return { ok: false, error: "This item cannot be delivered in its current state." };

  const clean = credentials.filter((c) => c.label.trim() && c.value.trim());
  if (!clean.length)
    return { ok: false, error: "Add at least one delivery detail (code, login, or note)." };

  const order = await one<{ code: string; buyer_id: string }>(
    `SELECT code, buyer_id FROM orders WHERE id=?`, [item.order_id]
  );

  await tx([
    {
      sql: `UPDATE order_items SET status='delivered', delivered_at=datetime('now'), credentials=?
             WHERE id=? AND seller_id=?`,
      args: [JSON.stringify(clean), itemId, s.id],
    },
    {
      /**
       * Delivery starts the escrow clock. `release_at` is stamped here — 7
       * days by default, or whatever `escrow_hold_hours` says — and a
       * background sweep releases the funds when it passes. The buyer no
       * longer has to press anything: an inactive buyer used to leave the
       * seller's money pending forever.
       */
      sql: `UPDATE orders
               SET status='delivered',
                   updated_at=datetime('now'),
                   delivered_at=COALESCE(delivered_at, datetime('now')),
                   release_at=COALESCE(release_at, datetime('now', ?))
             WHERE id=? AND NOT EXISTS (
               SELECT 1 FROM order_items WHERE order_id=? AND status='processing' AND id<>?
             )`,
      args: [`+${await escrowHoldHours()} hours`, item.order_id, item.order_id, itemId],
    },
    {
      sql: `INSERT INTO order_events (id,order_id,label,actor) VALUES (?,?, 'Delivered', 'seller')`,
      args: [nid("evt_"), item.order_id],
    },
    {
      /**
       * The buyer's tracker showed "Delivered" and then sat there for the whole
       * 7-day escrow window, which reads as an unfinished order. Once the goods
       * are handed over the purchase IS complete from the buyer's side — the
       * remaining wait is only the seller's payout hold, which is shown
       * separately. `orders.status` and the escrow timer are untouched.
       */
      sql: `INSERT INTO order_events (id,order_id,label,actor)
            SELECT ?,?, 'Completed', 'system'
             WHERE NOT EXISTS (
               SELECT 1 FROM order_items
                WHERE order_id=? AND status='processing' AND id<>?
             )`,
      args: [nid("evt_"), item.order_id, item.order_id, itemId],
    },
  ] as never);

  /**
   * A subscription is delivered over time, so its payout is spread over the
   * term instead of landing in one lump. The plan is written here, keyed to
   * the order's own `release_at`, so instalment 1 unlocks exactly when a
   * normal product would have paid out and each later month follows 30 days
   * behind. Idempotent, so re-delivering cannot double-schedule.
   */
  {
    const o = await one<{ release_at: string | null }>(
      `SELECT release_at FROM orders WHERE id=?`, [item.order_id]
    );
    if (o?.release_at) await scheduleSubscriptions(item.order_id, o.release_at);
  }

  if (order) {
    await notify(
      order.buyer_id,
      "Your order has been delivered",
      `${item.title} — open the order to view your delivery details.`,
      `/dashboard/orders/${order.code}`
    );
    const bu = await one<{ email: string }>(`SELECT email FROM users WHERE id=?`, [order.buyer_id]);
    if (bu?.email) await mail.orderDelivered(bu.email, { code: order.code, title: item.title });
  }

  revalidatePath("/seller/orders");
  return { ok: true };
}

export async function cancelOrderItemAction(itemId: string, reason: string): Promise<R> {
  const s = await requireSeller();
  const item = await one<{ order_id: string; line_total: number; seller_net: number; offer_id: string | null; listing_id: string | null; qty: number }>(
    `SELECT order_id, line_total, seller_net, offer_id, listing_id, qty
       FROM order_items WHERE id=? AND seller_id=? AND status='processing'`,
    [itemId, s.id]
  );
  if (!item) return { ok: false, error: "Item not found or already processed." };

  const order = await one<{ code: string; buyer_id: string }>(
    `SELECT code, buyer_id FROM orders WHERE id=?`, [item.order_id]
  );

  const stmts: { sql: string; args: unknown[] }[] = [
    { sql: `UPDATE order_items SET status='cancelled' WHERE id=?`, args: [itemId] },
    {
      sql: `UPDATE seller_profiles SET pending_bal = MAX(0, pending_bal - ?) WHERE user_id=?`,
      args: [item.seller_net, s.id],
    },
    // refund the buyer to wallet
    {
      sql: `UPDATE users SET balance = balance + ? WHERE id=?`,
      args: [item.line_total, order?.buyer_id],
    },
    {
      sql: `INSERT INTO transactions (id,user_id,type,amount,reference,order_id)
            VALUES (?,?, 'refund', ?, ?, ?)`,
      args: [nid("txn_"), order?.buyer_id, item.line_total, `Cancelled: ${reason}`.slice(0, 120), item.order_id],
    },
    {
      sql: `INSERT INTO order_events (id,order_id,label,actor) VALUES (?,?, 'Item cancelled by seller', 'seller')`,
      args: [nid("evt_"), item.order_id],
    },
  ];
  // restore stock
  if (item.offer_id)
    stmts.push({
      sql: `UPDATE offers SET stock = stock + ?, status=CASE WHEN status='out_of_stock' THEN 'active' ELSE status END WHERE id=?`,
      args: [item.qty, item.offer_id],
    });
  if (item.listing_id)
    stmts.push({
      sql: `UPDATE listings SET stock = stock + ?, status=CASE WHEN status='out_of_stock' THEN 'active' ELSE status END WHERE id=?`,
      args: [item.qty, item.listing_id],
    });

  await tx(stmts as never);

  if (order) {
    await notify(order.buyer_id, "Order item cancelled",
      `The seller cancelled an item on ${order.code} and you have been refunded to your wallet.`,
      `/dashboard/orders/${order.code}`);
    const bu = await one<{ email: string }>(`SELECT email FROM users WHERE id=?`, [order.buyer_id]);
    if (bu?.email)
      await mail.orderCancelled(bu.email, {
        code: order.code,
        title: `Order ${order.code}`,
        reason: reason?.trim() || "",
        refund: `$${Number(item.line_total ?? 0).toFixed(2)}`,
      });
  }

  revalidatePath("/seller/orders");
  return { ok: true };
}

/* ============================ reviews ============================= */

export async function replyReviewAction(reviewId: string, reply: string): Promise<R> {
  const s = await requireSeller();
  if (!reply.trim()) return { ok: false, error: "Reply is empty." };
  await run(`UPDATE reviews SET reply=? WHERE id=? AND seller_id=?`, [reply.trim(), reviewId, s.id]);
  revalidatePath("/seller/reviews");
  return { ok: true };
}

/* ============================ finance ============================= */

export async function requestWithdrawalAction(form: {
  amount: number; method: string; detail: string;
}): Promise<R> {
  const s = await requireSeller();
  const amt = Math.round(form.amount * 100) / 100;

  /**
   * Only *earned* money may leave the platform.
   *
   * The wallet is shared — a seller spends their earnings on the site like any
   * buyer — but topped-up money is site credit, not cash. `users.withdrawable`
   * is the earned portion, so the cap is the lower of that and the seller's
   * released `available_bal`. Without this a seller could top up by card and
   * withdraw it straight to a bank.
   */
  const wallet = await getWallet(s.id);
  const prof = await one<{ available_bal: number }>(
    `SELECT available_bal FROM seller_profiles WHERE user_id=?`, [s.id]
  );
  const avail = Math.min(Number(prof?.available_bal ?? 0), wallet.withdrawable);

  if (!(amt >= 10)) return { ok: false, error: "Minimum withdrawal is $10.00." };
  if (amt > avail)
    return {
      ok: false,
      error:
        wallet.siteCredit > 0
          ? `You can withdraw up to $${avail.toFixed(2)}. Topped-up balance ($${wallet.siteCredit.toFixed(2)}) can be spent on G2X but not withdrawn.`
          : `You can withdraw up to $${avail.toFixed(2)}.`,
    };
  if (!form.detail.trim()) return { ok: false, error: "Enter your payout details." };

  const pending = await one<{ n: number }>(
    `SELECT COUNT(*) AS n FROM withdrawals WHERE seller_id=? AND status='pending'`, [s.id]
  );
  if (Number(pending?.n ?? 0) >= 3)
    return { ok: false, error: "You already have 3 pending withdrawal requests." };

  await tx([
    {
      sql: `INSERT INTO withdrawals (id,seller_id,amount,method,detail,status)
            VALUES (?,?,?,?,?, 'pending')`,
      args: [nid("wdr_"), s.id, amt, form.method, form.detail.trim()],
    },
    {
      sql: `UPDATE seller_profiles SET available_bal = available_bal - ? WHERE user_id=?`,
      args: [amt, s.id],
    },
    {
      // Money leaving the platform also leaves the shared wallet. The WHERE
      // clause is the real guard against a concurrent double withdrawal.
      sql: WITHDRAW_SQL,
      args: [amt, amt, s.id, amt],
    },
    {
      sql: `INSERT INTO transactions (id,user_id,type,amount,reference)
            VALUES (?,?, 'withdrawal', ?, 'Withdrawal requested')`,
      args: [nid("txn_"), s.id, -amt],
    },
  ] as never);

  {
    const su = await one<{ email: string }>(`SELECT email FROM users WHERE id=?`, [s.id]);
    if (su?.email)
      await mail.withdrawalRequested(su.email, {
        amount: `$${amt.toFixed(2)}`,
        method: form.method,
      });
  }

  revalidatePath("/seller/finance");
  return { ok: true };
}

/* ============================ profile ============================= */

export async function saveStoreAction(form: FormData): Promise<R> {
  const s = await requireSeller();
  const storeName = String(form.get("storeName") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const logo = String(form.get("logo") ?? "").trim();
  const banner = String(form.get("banner") ?? "").trim();
  const payoutMethod = String(form.get("payoutMethod") ?? "").trim();
  const payoutDetail = String(form.get("payoutDetail") ?? "").trim();

  if (storeName.length < 3) return { ok: false, error: "Store name must be at least 3 characters." };
  const slug = storeName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const taken = await one(`SELECT user_id FROM seller_profiles WHERE slug=? AND user_id<>?`, [slug, s.id]);
  if (taken) return { ok: false, error: "That store name is already taken." };

  await run(
    `UPDATE seller_profiles SET store_name=?, slug=?, description=?, logo=?, banner=?,
            payout_method=?, payout_detail=? WHERE user_id=?`,
    [storeName, slug, description, logo || null, banner || null,
     payoutMethod || null, payoutDetail || null, s.id]
  );
  revalidatePath("/seller/store");
  return { ok: true };
}
