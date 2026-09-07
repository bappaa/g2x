"use server";

import { revalidatePath } from "next/cache";
import { one, run, tx, nid } from "../db";
import { requireSeller } from "../session";

export type R = { ok: boolean; error?: string; id?: string };

import { mail } from "../mail";
import { escrowHoldHours } from "../escrow";

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
  ] as never);

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
  const prof = await one<{ available_bal: number }>(
    `SELECT available_bal FROM seller_profiles WHERE user_id=?`, [s.id]
  );
  const avail = Number(prof?.available_bal ?? 0);
  const amt = Math.round(form.amount * 100) / 100;

  if (!(amt >= 10)) return { ok: false, error: "Minimum withdrawal is $10.00." };
  if (amt > avail) return { ok: false, error: `You can withdraw up to $${avail.toFixed(2)}.` };
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
