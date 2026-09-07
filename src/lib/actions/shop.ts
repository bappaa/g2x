"use server";

import { revalidatePath } from "next/cache";
import { all, one, run, tx, nid } from "../db";
import { requireUser, getSessionUser } from "../session";
import { getCart } from "../queries";
import { moderateMessage } from "../moderation";

export type R = {
  ok: boolean;
  error?: string;
  id?: string;
  code?: string;
  warning?: string;
  needsKyc?: boolean;
  /** Set on a SUCCESSFUL payment that now obliges the buyer to verify. */
  verifyAfter?: { threshold: number; reason: string };
};

const SERVICE_FEE = 0.02;

import { mail } from "../mail";
import { gatewayByCode, feeFor, limitError } from "../gateways";
import { kycDueFor, markKycDue, kycThreshold } from "../buyer-kyc";
import { ensureSchema } from "../ensure-schema";
import { rateLimit } from "../ratelimit";

async function notify(userId: string, title: string, body: string, href: string, kind = "order") {
  await run(
    `INSERT INTO notifications (id,user_id,title,body,href,kind) VALUES (?,?,?,?,?,?)`,
    [nid("ntf_"), userId, title, body, href, kind]
  );
}

/* ============================== cart ============================== */

export async function addToCartAction(input: {
  offerId?: string;
  listingId?: string;
  qty?: number;
  region?: string;
  deliveryMethod?: string;
}): Promise<R> {
  const u = await getSessionUser();
  if (!u) return { ok: false, error: "AUTH" };

  const qty = Math.max(1, Math.min(99, input.qty ?? 1));

  if (input.offerId) {
    const o = await one<{ stock: number; status: string }>(
      `SELECT stock, status FROM offers WHERE id=?`,
      [input.offerId]
    );
    if (!o || o.status !== "active") return { ok: false, error: "This offer is no longer available." };
    if (o.stock < qty) return { ok: false, error: "Not enough stock left for this offer." };
  }
  if (input.listingId) {
    const l = await one<{ stock: number; status: string }>(
      `SELECT stock, status FROM listings WHERE id=?`,
      [input.listingId]
    );
    if (!l || l.status !== "active" || l.stock < 1)
      return { ok: false, error: "This listing is no longer available." };
  }

  const existing = await one<{ id: string; qty: number }>(
    `SELECT id, qty FROM cart_items WHERE user_id=? AND
       COALESCE(offer_id,'') = ? AND COALESCE(listing_id,'') = ?`,
    [u.id, input.offerId ?? "", input.listingId ?? ""]
  );

  const optRegion = input.region?.slice(0, 60) ?? null;
  const optDelivery = input.deliveryMethod?.slice(0, 60) ?? null;

  if (existing)
    await run(`UPDATE cart_items SET qty=?, opt_region=?, opt_delivery=? WHERE id=?`, [
      existing.qty + qty, optRegion, optDelivery, existing.id,
    ]);
  else
    await run(
      `INSERT INTO cart_items (id,user_id,offer_id,listing_id,qty,opt_region,opt_delivery)
       VALUES (?,?,?,?,?,?,?)`,
      [nid("crt_"), u.id, input.offerId ?? null, input.listingId ?? null, qty, optRegion, optDelivery]
    );

  revalidatePath("/cart");
  return { ok: true };
}

export async function setCartQtyAction(key: string, qty: number): Promise<R> {
  const u = await requireUser();
  if (qty < 1) return removeCartAction(key);
  await run(`UPDATE cart_items SET qty=? WHERE id=? AND user_id=?`, [Math.min(99, qty), key, u.id]);
  revalidatePath("/cart");
  return { ok: true };
}

export async function removeCartAction(key: string): Promise<R> {
  const u = await requireUser();
  await run(`DELETE FROM cart_items WHERE id=? AND user_id=?`, [key, u.id]);
  revalidatePath("/cart");
  return { ok: true };
}

export async function clearCartAction(): Promise<R> {
  const u = await requireUser();
  await run(`DELETE FROM cart_items WHERE user_id=?`, [u.id]);
  revalidatePath("/cart");
  return { ok: true };
}

/* ============================ checkout ============================ */

export async function placeOrderAction(form: {
  paymentMethod: string;
  uid: string;
  note?: string;
}): Promise<R> {
  const u = await requireUser();
  const items = await getCart(u.id);
  if (!items.length) return { ok: false, error: "Your cart is empty." };
  if (!form.uid?.trim())
    return { ok: false, error: "Enter your in-game UID / login ID for delivery." };

  // server-side revalidation of price & stock (docs requirement)
  for (const it of items) {
    if (it.qty > it.stock)
      return { ok: false, error: `"${it.title}" only has ${it.stock} left in stock.` };
  }

  const subtotal = +items.reduce((t, i) => t + i.price * i.qty, 0).toFixed(2);
  const fee = +(subtotal * SERVICE_FEE).toFixed(2);

  // Gateway fee is resolved server-side from the admin's configuration.
  const gw = await gatewayByCode(form.paymentMethod);
  if (!gw) return { ok: false, error: "That payment method is not available." };
  const gwFee = feeFor(subtotal + fee, gw);
  const total = +(subtotal + fee + gwFee).toFixed(2);

  /**
   * Identity check is POST-payment. We only work out here whether this order
   * will oblige the buyer to verify; the order itself is never blocked. The
   * flag is written after the money has actually moved.
   */
  const willOweKyc = await kycDueFor(u.id, total);

  const rlOrder = await rateLimit(`checkout:${u.id}`, 12, 60 * 60);
  if (!rlOrder.ok) return { ok: false, error: "Too many orders in a short time. Please wait a few minutes." };

  const limit = limitError(total, gw);
  if (limit) return { ok: false, error: limit };

  if (gw.code === "wallet") {
    const bal = await one<{ balance: number }>(`SELECT balance FROM users WHERE id=?`, [u.id]);
    if (Number(bal?.balance ?? 0) < total)
      return { ok: false, error: "Insufficient wallet balance. Top up or choose another method." };
  }

  const orderId = nid("ord_");
  const code = "G2X" + Math.floor(100000 + Math.random() * 899999);

  const stmts: { sql: string; args: unknown[] }[] = [
    {
      sql: `INSERT INTO orders (id,code,buyer_id,subtotal,fee,total,status,payment_method,
                                payment_status,delivery_uid,buyer_note,gateway_fee,gateway_code)
            VALUES (?,?,?,?,?,?,'processing',?,'paid',?,?,?,?)`,
      args: [
        orderId, code, u.id, subtotal, fee, total, gw.name,
        form.uid.trim(), form.note ?? null, gwFee, gw.code,
      ],
    },
  ];

  for (const it of items) {
    const prof = await one<{ commission_pct: number }>(
      `SELECT commission_pct FROM seller_profiles WHERE user_id=?`,
      [it.seller_id]
    );
    const pct = Number(prof?.commission_pct ?? 8);
    const line = +(it.price * it.qty).toFixed(2);
    const commission = +((line * pct) / 100).toFixed(2);
    const net = +(line - commission).toFixed(2);

    stmts.push({
      sql: `INSERT INTO order_items
              (id,order_id,offer_id,listing_id,product_id,seller_id,title,subtitle,image,href,
               unit_price,qty,line_total,commission_pct,commission_amt,seller_net,delivery_time,
               opt_region,opt_delivery,status)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'processing')`,
      args: [
        nid("oit_"), orderId, it.offer_id, it.listing_id, it.product_id, it.seller_id,
        it.title, it.sub, it.image, it.href, it.price, it.qty, line, pct, commission, net,
        it.delivery, it.opt_region ?? null, it.opt_delivery ?? null,
      ],
    });

    if (it.offer_id)
      stmts.push({
        sql: `UPDATE offers SET stock = MAX(0, stock - ?), sold_count = sold_count + ?,
                status = CASE WHEN stock - ? <= 0 THEN 'out_of_stock' ELSE status END
              WHERE id=?`,
        args: [it.qty, it.qty, it.qty, it.offer_id],
      });
    if (it.listing_id)
      stmts.push({
        sql: `UPDATE listings SET stock = MAX(0, stock - ?),
                status = CASE WHEN stock - ? <= 0 THEN 'out_of_stock' ELSE status END
              WHERE id=?`,
        args: [it.qty, it.qty, it.listing_id],
      });

    // seller pending balance (escrow)
    stmts.push({
      sql: `UPDATE seller_profiles SET pending_bal = pending_bal + ? WHERE user_id=?`,
      args: [net, it.seller_id],
    });
  }

  ["Order Placed", "Payment Confirmed", "Seller Processing"].forEach((label, i) =>
    stmts.push({
      sql: `INSERT INTO order_events (id,order_id,label,actor,created_at)
            VALUES (?,?,?, 'system', datetime('now', '+' || ? || ' seconds'))`,
      args: [nid("evt_"), orderId, label, i],
    }));

  if (gw.code === "wallet") {
    stmts.push({
      sql: `UPDATE users SET balance = balance - ? WHERE id=?`,
      args: [total, u.id],
    });
    stmts.push({
      sql: `INSERT INTO transactions (id,user_id,type,amount,reference,order_id)
            VALUES (?,?, 'purchase', ?, ?, ?)`,
      args: [nid("txn_"), u.id, -total, `Order ${code}`, orderId],
    });
  }

  stmts.push({ sql: `DELETE FROM cart_items WHERE user_id=?`, args: [u.id] });

  await tx(stmts as never);

  await notify(u.id, `Order ${code} confirmed`, "The seller has been notified and is delivering now.", `/dashboard/orders/${code}`);
  const sellers = Array.from(new Set(items.map((i) => i.seller_id)));
  for (const s of sellers)
    await notify(s, "New order received", `Order ${code} — please deliver as soon as possible.`, `/seller/orders`);

  // automated transactional email — billing@ to the buyer, seller@ to each seller
  if (u.email)
    await mail.orderConfirmed(u.email, {
      code,
      total: `$${Number(total).toFixed(2)}`,
      items: items.length,
      method: gw.name,
    });

  for (const sid of sellers) {
    const su = await one<{ email: string }>(`SELECT email FROM users WHERE id=?`, [sid]);
    const mine = items.filter((i) => i.seller_id === sid);
    const gross = mine.reduce((a, b) => a + b.price * b.qty, 0);
    const prof = await one<{ commission_pct: number }>(
      `SELECT commission_pct FROM seller_profiles WHERE user_id=?`,
      [sid]
    );
    const net = gross * (1 - Number(prof?.commission_pct ?? 8) / 100);
    if (su?.email) {
      await mail.newSale(su.email, {
        code,
        title: mine[0]?.title ?? "your listing",
        net: `$${net.toFixed(2)}`,
      });
      // Immediate call-to-action so the seller can fulfil right away.
      await mail.actionRequired(su.email, {
        code,
        title: mine[0]?.title ?? "your listing",
        qty: mine.reduce((a, b) => a + b.qty, 0),
        uid: form.uid.trim(),
        deadline: "24 hours",
      });
    }
  }

  /**
   * Payment is done — now collect the identity check. We flag the account and
   * hand the client a `verifyAfter` payload so it can route the buyer to the
   * verification tab straight after the confirmation screen.
   */
  let verifyAfter: R["verifyAfter"];
  if (willOweKyc) {
    const reason = `Order ${code} ($${total.toFixed(2)})`;
    await markKycDue(u.id, reason);
    await notify(
      u.id,
      "Verify your identity",
      `Thanks for your order. Because it was $${total.toFixed(2)}, please confirm your identity to keep your account fully active.`,
      "/dashboard/verification",
      "system"
    );
    verifyAfter = { threshold: await kycThreshold(), reason };
    revalidatePath("/dashboard/verification");
  }

  revalidatePath("/dashboard/orders");
  revalidatePath("/seller/orders");
  return { ok: true, code, verifyAfter };
}

/* ======================= buyer order actions ======================= */

export async function confirmReceiptAction(code: string): Promise<R> {
  const u = await requireUser();
  const order = await one<{ id: string; status: string }>(
    `SELECT id, status FROM orders WHERE code=? AND buyer_id=?`,
    [code, u.id]
  );
  if (!order) return { ok: false, error: "Order not found." };
  if (order.status !== "delivered")
    return { ok: false, error: "You can only confirm an order after it is delivered." };

  const items = await all<{ id: string; seller_id: string; seller_net: number }>(
    `SELECT id, seller_id, seller_net FROM order_items WHERE order_id=?`,
    [order.id]
  );

  const stmts: { sql: string; args: unknown[] }[] = [
    { sql: `UPDATE orders SET status='completed', updated_at=datetime('now') WHERE id=?`, args: [order.id] },
    { sql: `UPDATE order_items SET status='completed' WHERE order_id=?`, args: [order.id] },
    {
      sql: `INSERT INTO order_events (id,order_id,label,actor) VALUES (?,?, 'Completed', 'buyer')`,
      args: [nid("evt_"), order.id],
    },
  ];

  // release escrow: pending -> available
  for (const it of items) {
    stmts.push({
      sql: `UPDATE seller_profiles
               SET pending_bal = MAX(0, pending_bal - ?),
                   available_bal = available_bal + ?,
                   total_sales = total_sales + ?,
                   total_orders = total_orders + 1
             WHERE user_id=?`,
      args: [it.seller_net, it.seller_net, it.seller_net, it.seller_id],
    });
    stmts.push({
      sql: `INSERT INTO transactions (id,user_id,type,amount,reference,order_id)
            VALUES (?,?, 'sale', ?, ?, ?)`,
      args: [nid("txn_"), it.seller_id, it.seller_net, `Order ${code} released`, order.id],
    });
  }

  await tx(stmts as never);
  for (const sellerId of Array.from(new Set(items.map((i) => i.seller_id)))) {
    await notify(
      sellerId,
      "Payment released",
      `Buyer confirmed order ${code}. Funds moved to your available balance.`,
      "/seller/finance"
    );
    const sellerNet = items
      .filter((i) => i.seller_id === sellerId)
      .reduce((a, b) => a + Number(b.seller_net ?? 0), 0);
    const su = await one<{ email: string }>(`SELECT email FROM users WHERE id=?`, [sellerId]);
    if (su?.email)
      await mail.paymentReleased(su.email, { code, net: `$${sellerNet.toFixed(2)}` });
  }

  // buyer receipt
  {
    const bu = await one<{ email: string }>(`SELECT email FROM users WHERE id=?`, [u.id]);
    if (bu?.email)
      await mail.orderCompleted(bu.email, { code, title: `Order ${code}` });
  }

  revalidatePath(`/dashboard/orders/${code}`);
  revalidatePath("/seller/finance");
  return { ok: true };
}

export async function openDisputeAction(code: string, reason: string): Promise<R> {
  const u = await requireUser();
  if (reason.trim().length < 10)
    return { ok: false, error: "Please describe the problem in at least 10 characters." };

  const order = await one<{ id: string; total: number }>(
    `SELECT id, total FROM orders WHERE code=? AND buyer_id=?`,
    [code, u.id]
  );
  if (!order) return { ok: false, error: "Order not found." };

  const item = await one<{ seller_id: string }>(
    `SELECT seller_id FROM order_items WHERE order_id=? LIMIT 1`,
    [order.id]
  );
  const id = nid("dsp_");
  const dcode = "DSP" + Math.floor(10000 + Math.random() * 89999);

  await tx([
    {
      sql: `INSERT INTO disputes (id,code,order_id,buyer_id,seller_id,amount,reason,status)
            VALUES (?,?,?,?,?,?,?, 'open')`,
      args: [id, dcode, order.id, u.id, item?.seller_id ?? "", order.total, reason.trim()],
    },
    {
      sql: `INSERT INTO dispute_messages (id,dispute_id,sender,body) VALUES (?,?, 'buyer', ?)`,
      args: [nid("dmg_"), id, reason.trim()],
    },
    { sql: `UPDATE orders SET status='disputed' WHERE id=?`, args: [order.id] },
    { sql: `UPDATE order_items SET status='disputed' WHERE order_id=?`, args: [order.id] },
  ] as never);

  if (item?.seller_id)
    await notify(item.seller_id, "Dispute opened", `Order ${code} — respond within 24 hours.`, "/seller/disputes");
    const [bMail, sMail] = await Promise.all([
      one<{ email: string }>(`SELECT email FROM users WHERE id=?`, [u.id]),
      one<{ email: string }>(`SELECT email FROM users WHERE id=?`, [item?.seller_id ?? ""]),
    ]);
    if (bMail?.email)
      await mail.disputeOpened(bMail.email, { code: dcode, order: code, reason: reason.trim(), forSeller: false });
    if (sMail?.email)
      await mail.disputeOpened(sMail.email, { code: dcode, order: code, reason: reason.trim(), forSeller: true });

  revalidatePath("/dashboard/disputes");
  return { ok: true, code: dcode };
}

export async function disputeReplyAction(disputeCode: string, body: string): Promise<R> {
  const u = await requireUser();
  const d = await one<{ id: string; buyer_id: string; seller_id: string }>(
    `SELECT id, buyer_id, seller_id FROM disputes WHERE code=?`,
    [disputeCode]
  );
  if (!d) return { ok: false, error: "Dispute not found." };
  const sender = d.buyer_id === u.id ? "buyer" : d.seller_id === u.id ? "seller" : null;
  if (!sender) return { ok: false, error: "Not allowed." };
  if (!body.trim()) return { ok: false, error: "Message is empty." };

  await run(`INSERT INTO dispute_messages (id,dispute_id,sender,body) VALUES (?,?,?,?)`, [
    nid("dmg_"), d.id, sender, body.trim(),
  ]);
  await run(`UPDATE disputes SET status='under_review' WHERE id=? AND status='open'`, [d.id]);

  revalidatePath("/dashboard/disputes");
  revalidatePath("/seller/disputes");
  return { ok: true };
}

export async function submitReviewAction(input: {
  orderCode: string;
  sellerId: string;
  stars: number;
  body: string;
}): Promise<R> {
  const u = await requireUser();
  const order = await one<{ id: string }>(`SELECT id FROM orders WHERE code=? AND buyer_id=?`, [
    input.orderCode, u.id,
  ]);
  if (!order) return { ok: false, error: "Order not found." };

  const dupe = await one(`SELECT id FROM reviews WHERE order_id=? AND seller_id=?`, [
    order.id, input.sellerId,
  ]);
  if (dupe) return { ok: false, error: "You already reviewed this order." };

  await run(
    `INSERT INTO reviews (id,order_id,buyer_id,seller_id,stars,body,status)
     VALUES (?,?,?,?,?,?, 'published')`,
    [nid("rev_"), order.id, u.id, input.sellerId, Math.max(1, Math.min(5, input.stars)), input.body.trim()]
  );

  const agg = await one<{ avg: number }>(
    `SELECT AVG(stars) AS avg FROM reviews WHERE seller_id=? AND status='published'`,
    [input.sellerId]
  );
  await run(`UPDATE seller_profiles SET rating=? WHERE user_id=?`, [
    +(((Number(agg?.avg ?? 5)) / 5) * 100).toFixed(1), input.sellerId,
  ]);

  await notify(input.sellerId, "New review received", `${input.stars}★ on order ${input.orderCode}.`, "/seller/reviews");
  revalidatePath("/dashboard/reviews");
  return { ok: true };
}

/* ============================ wallet ============================= */

export async function topUpWalletAction(
  amount: number,
  method: string,
  /**
   * Client-generated idempotency key, one per top-up attempt. Two clicks (or a
   * retry, or React double-invoking the transition) send the SAME key, so only
   * the first can insert the transaction row — see the UNIQUE index below.
   */
  idemKey?: string
): Promise<R> {
  // Repair any missing additive columns before we rely on `idem_key`.
  await ensureSchema();

  const u = await requireUser();
  const amt = Math.round(amount * 100) / 100;
  if (!(amt > 0) || amt > 5000) return { ok: false, error: "Enter an amount between $1 and $5,000." };

  // Re-resolve the gateway server-side — never trust a fee sent by the client.
  const gw = await gatewayByCode(method);
  if (!gw) return { ok: false, error: "That payment method is not available." };
  const limit = limitError(amt, gw);
  if (limit) return { ok: false, error: limit };

  // Post-payment identity check: decide now, flag after the credit lands.
  const willOweKyc = await kycDueFor(u.id, amt);

  const rlTop = await rateLimit(`topup:${u.id}`, 10, 60 * 60);
  if (!rlTop.ok) return { ok: false, error: "Too many top-up attempts. Please wait a few minutes." };

  const fee = feeFor(amt, gw);
  const charged = Math.round((amt + fee) * 100) / 100;

  /**
   * DOUBLE-CREDIT FIX.
   *
   * Previously the balance UPDATE and the transaction INSERT ran with no
   * uniqueness guard, so anything that delivered the action twice — an
   * impatient double-tap landing before `pending` re-rendered, a flaky
   * connection retrying the POST, or two tabs — credited the wallet twice.
   *
   * The INSERT now carries a UNIQUE `idem_key` and runs FIRST in the batch.
   * A duplicate violates the index, the whole batch rolls back, and the
   * balance is never touched a second time. This is enforced by the database,
   * so it holds even for genuinely concurrent requests.
   */
  const key = (idemKey || "").trim().slice(0, 80) || nid("auto_");
  const scopedKey = `topup:${u.id}:${key}`;

  try {
    await tx([
      {
        sql: `INSERT INTO transactions (id,user_id,type,amount,reference,idem_key)
              VALUES (?,?, 'deposit', ?, ?, ?)`,
        args: [
          nid("txn_"),
          u.id,
          amt,
          fee > 0
            ? `Wallet top-up via ${gw.name} (charged $${charged.toFixed(2)}, fee $${fee.toFixed(2)})`
            : `Wallet top-up via ${gw.name}`,
          scopedKey,
        ],
      },
      { sql: `UPDATE users SET balance = balance + ? WHERE id=?`, args: [amt, u.id] },
    ] as never);
  } catch (e) {
    const msg = String((e as Error)?.message ?? "");

    if (/UNIQUE|constraint/i.test(msg)) {
      // Same attempt replayed — the first one already credited the wallet.
      revalidatePath("/dashboard/wallet");
      revalidatePath("/dashboard");
      return { ok: true };
    }

    /**
     * Last-resort fallback for a database that predates the idempotency
     * column and could not be patched (e.g. a read-only replica). Losing the
     * double-credit guard is bad; refusing every top-up with an opaque
     * server-side exception is worse. Credit the wallet the old way and make
     * the degradation visible in the logs.
     */
    if (/no column named idem_key|no such column: idem_key/i.test(msg)) {
      console.warn("[topUpWallet] idem_key missing — run `npm run db:migrate`.");
      await tx([
        {
          sql: `INSERT INTO transactions (id,user_id,type,amount,reference)
                VALUES (?,?, 'deposit', ?, ?)`,
          args: [
            nid("txn_"),
            u.id,
            amt,
            fee > 0
              ? `Wallet top-up via ${gw.name} (charged $${charged.toFixed(2)}, fee $${fee.toFixed(2)})`
              : `Wallet top-up via ${gw.name}`,
          ],
        },
        { sql: `UPDATE users SET balance = balance + ? WHERE id=?`, args: [amt, u.id] },
      ] as never);
    } else {
      throw e;
    }
  }

  if (u.email) {
    await mail.walletTopUp(u.email, {
      amount: `$${amt.toFixed(2)}`,
      method: gw.name,
      fee: fee > 0 ? `$${fee.toFixed(2)}` : "",
      balance: `$${(Number(u.balance ?? 0) + amt).toFixed(2)}`,
    });
  }

  // Money is in — now ask for identity if this deposit crossed the threshold.
  let verifyAfter: R["verifyAfter"];
  if (willOweKyc) {
    const reason = `Wallet top-up ($${amt.toFixed(2)})`;
    await markKycDue(u.id, reason);
    await notify(
      u.id,
      "Verify your identity",
      `Your $${amt.toFixed(2)} top-up went through. Please confirm your identity to keep your account fully active.`,
      "/dashboard/verification",
      "system"
    );
    verifyAfter = { threshold: await kycThreshold(), reason };
    revalidatePath("/dashboard/verification");
  }

  revalidatePath("/dashboard/wallet");
  revalidatePath("/dashboard");
  return { ok: true, verifyAfter };
}

/* =========================== wishlist ============================ */

export async function toggleWishAction(item: {
  id: string; title: string; sub: string; image: string; price: number; href: string;
}): Promise<R & { added?: boolean }> {
  const u = await getSessionUser();
  if (!u) return { ok: false, error: "AUTH" };

  const found = await one(`SELECT item_id FROM wishlist WHERE user_id=? AND item_id=?`, [u.id, item.id]);
  if (found) {
    await run(`DELETE FROM wishlist WHERE user_id=? AND item_id=?`, [u.id, item.id]);
    revalidatePath("/dashboard/wishlist");
    return { ok: true, added: false };
  }
  await run(
    `INSERT INTO wishlist (user_id,item_id,title,subtitle,image,price,href) VALUES (?,?,?,?,?,?,?)`,
    [u.id, item.id, item.title, item.sub, item.image, item.price, item.href]
  );
  revalidatePath("/dashboard/wishlist");
  return { ok: true, added: true };
}

/* ========================= notifications ========================= */

export async function markNotificationsReadAction(): Promise<R> {
  const u = await getSessionUser();
  if (!u) return { ok: false };
  await run(`UPDATE notifications SET read_flag=1 WHERE user_id=? AND read_flag=0`, [u.id]);
  revalidatePath("/dashboard/notifications");
  return { ok: true };
}

/* =========================== messaging =========================== */

export async function sendMessageAction(threadId: string, body: string): Promise<R> {
  const u = await requireUser();
  if (!body.trim()) return { ok: false, error: "Message is empty." };
  const t = await one<{ buyer_id: string; seller_id: string }>(
    `SELECT buyer_id, seller_id FROM threads WHERE id=?`, [threadId]
  );
  if (!t || (t.buyer_id !== u.id && t.seller_id !== u.id))
    return { ok: false, error: "Not allowed." };

  const mod = moderateMessage(body);

  await tx([
    {
      sql: `INSERT INTO messages (id,thread_id,sender_id,body,flagged,flag_reasons)
            VALUES (?,?,?,?,?,?)`,
      args: [
        nid("msg_"), threadId, u.id, body.trim(),
        mod.flagged ? 1 : 0,
        mod.flagged ? JSON.stringify(mod.flags) : null,
      ],
    },
    { sql: `UPDATE threads SET updated_at=datetime('now') WHERE id=?`, args: [threadId] },
  ] as never);

  // high-severity attempts to go off-platform alert the admins immediately
  if (mod.score >= 3) {
    const admins = await all<{ id: string }>(`SELECT id FROM users WHERE role='admin'`);
    for (const a of admins)
      await notify(
        a.id,
        "Message flagged for review",
        `${mod.flags.map((f) => f.label).join(", ")} — thread ${threadId}.`,
        `/admin/messages?thread=${threadId}`,
        "system"
      );
  }

  // notify the other participant by email (not the sender)
  {
    const otherId = t.buyer_id === u.id ? t.seller_id : t.buyer_id;
    const other = await one<{ email: string }>(`SELECT email FROM users WHERE id=?`, [otherId]);
    const forSeller = otherId === t.seller_id;
    if (other?.email)
      await mail.newMessage(other.email, {
        from: u.name,
        preview: body.trim().slice(0, 180),
        href: forSeller ? "/seller/messages" : "/dashboard/messages",
      });
  }

  revalidatePath("/dashboard/messages");
  revalidatePath("/seller/messages");
  revalidatePath("/admin/messages");
  return { ok: true, warning: mod.flagged ? mod.flags.map((f) => f.label).join(", ") : undefined };
}

/* ==================== chat attachments & disputes ==================== */

/** 2 MB ceiling — images are stored in the DB, so they must stay small. */
const MAX_ATTACHMENT = 2 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];

/**
 * Send an image in a chat thread.
 *
 * The file is stored in the database as a data URI rather than on disk,
 * because the serverless host has a read-only filesystem — a disk write would
 * work locally and fail in production. The trade-off is size, hence the 2 MB
 * cap and the strict image-only allowlist (never trust the client's MIME
 * string alone: the extension is re-checked too).
 */
export async function sendAttachmentAction(threadId: string, form: FormData): Promise<R> {
  const u = await requireUser();

  const t = await one<{ buyer_id: string; seller_id: string }>(
    `SELECT buyer_id, seller_id FROM threads WHERE id=?`,
    [threadId]
  );
  if (!t || (t.buyer_id !== u.id && t.seller_id !== u.id))
    return { ok: false, error: "Not allowed." };

  const file = form.get("file") as File | null;
  if (!file || file.size === 0) return { ok: false, error: "Choose an image to send." };
  if (file.size > MAX_ATTACHMENT)
    return { ok: false, error: "Images must be 2 MB or smaller." };

  const type = (file.type || "").toLowerCase();
  const nameOk = /\.(png|jpe?g|webp|gif)$/i.test(file.name || "");
  if (!ALLOWED_TYPES.includes(type) || !nameOk)
    return { ok: false, error: "Only PNG, JPEG, WEBP or GIF images are allowed." };

  const buf = Buffer.from(await file.arrayBuffer());
  const dataUri = `data:${type};base64,${buf.toString("base64")}`;

  await tx([
    {
      sql: `INSERT INTO messages
              (id,thread_id,sender_id,body,kind,attachment_name,attachment_type,attachment_size,attachment_data)
            VALUES (?,?,?,?, 'image', ?,?,?,?)`,
      args: [
        nid("msg_"), threadId, u.id, file.name.slice(0, 120),
        file.name.slice(0, 120), type, file.size, dataUri,
      ],
    },
    { sql: `UPDATE threads SET updated_at=datetime('now') WHERE id=?`, args: [threadId] },
  ] as never);

  revalidatePath("/dashboard/messages");
  revalidatePath("/seller/messages");
  revalidatePath("/admin/messages");
  return { ok: true };
}

/**
 * Raise a dispute from inside the chat.
 *
 * This is the same escrow-freezing action as the order page, but it also drops
 * a `dispute` system message into the thread so both sides see the red banner
 * in context, and links the thread to the dispute record.
 */
export async function openDisputeInChatAction(threadId: string, reason: string): Promise<R> {
  const u = await requireUser();
  const text = reason.trim();
  if (text.length < 10)
    return { ok: false, error: "Please describe the problem in at least 10 characters." };

  const t = await one<{ buyer_id: string; seller_id: string; order_id: string | null }>(
    `SELECT buyer_id, seller_id, order_id FROM threads WHERE id=?`,
    [threadId]
  );
  if (!t) return { ok: false, error: "Conversation not found." };
  // Only the buyer can open a dispute — the seller has no funds at risk.
  if (t.buyer_id !== u.id) return { ok: false, error: "Only the buyer can open a dispute." };

  const open = await one<{ id: string }>(
    `SELECT id FROM disputes WHERE thread_id=? AND status IN ('open','under_review')`,
    [threadId]
  );
  if (open) return { ok: false, error: "There is already an open dispute on this conversation." };

  // Prefer the thread's order; otherwise fall back to the buyer's latest one.
  const order = t.order_id
    ? await one<{ id: string; code: string; total: number }>(
        `SELECT id, code, total FROM orders WHERE (id=? OR code=?) AND buyer_id=?`,
        [t.order_id, t.order_id, u.id]
      )
    : await one<{ id: string; code: string; total: number }>(
        `SELECT o.id, o.code, o.total FROM orders o
           JOIN order_items oi ON oi.order_id=o.id
          WHERE o.buyer_id=? AND oi.seller_id=?
          ORDER BY o.created_at DESC LIMIT 1`,
        [u.id, t.seller_id]
      );
  if (!order) return { ok: false, error: "No order found to dispute for this seller." };

  const id = nid("dsp_");
  const dcode = "DSP" + Math.floor(10000 + Math.random() * 89999);

  await tx([
    {
      sql: `INSERT INTO disputes (id,code,order_id,buyer_id,seller_id,amount,reason,status,thread_id)
            VALUES (?,?,?,?,?,?,?, 'open', ?)`,
      args: [id, dcode, order.id, u.id, t.seller_id, order.total, text, threadId],
    },
    {
      sql: `INSERT INTO dispute_messages (id,dispute_id,sender,body) VALUES (?,?, 'buyer', ?)`,
      args: [nid("dmg_"), id, text],
    },
    {
      // The red banner the buyer and seller both see in the conversation.
      sql: `INSERT INTO messages (id,thread_id,sender_id,body,kind,dispute_id)
            VALUES (?,?,?,?, 'dispute', ?)`,
      args: [nid("msg_"), threadId, u.id, text, id],
    },
    { sql: `UPDATE threads SET dispute_id=?, updated_at=datetime('now') WHERE id=?`, args: [id, threadId] },
    { sql: `UPDATE orders SET status='disputed' WHERE id=?`, args: [order.id] },
    { sql: `UPDATE order_items SET status='disputed' WHERE order_id=?`, args: [order.id] },
  ] as never);

  await notify(
    t.seller_id,
    "Dispute opened",
    `Order ${order.code} — respond in the conversation.`,
    "/seller/messages"
  );

  revalidatePath("/dashboard/messages");
  revalidatePath("/seller/messages");
  revalidatePath("/dashboard/disputes");
  revalidatePath("/admin/disputes");
  return { ok: true, id };
}

/**
 * Buyer withdraws their own dispute once the seller has sorted it out.
 *
 * Deliberately buyer-only: letting a seller close a dispute against themselves
 * would defeat the purpose. The order returns to its previous state and the
 * escrow clock resumes.
 */
export async function resolveDisputeInChatAction(threadId: string): Promise<R> {
  const u = await requireUser();

  const t = await one<{ buyer_id: string; seller_id: string }>(
    `SELECT buyer_id, seller_id FROM threads WHERE id=?`,
    [threadId]
  );
  if (!t) return { ok: false, error: "Conversation not found." };
  if (t.buyer_id !== u.id)
    return { ok: false, error: "Only the buyer can close a dispute." };

  const d = await one<{ id: string; order_id: string }>(
    `SELECT id, order_id FROM disputes
      WHERE thread_id=? AND status IN ('open','under_review')
      ORDER BY created_at DESC LIMIT 1`,
    [threadId]
  );
  if (!d) return { ok: false, error: "There is no open dispute to close." };

  await tx([
    {
      sql: `UPDATE disputes SET status='resolved',
              resolution=COALESCE(resolution,'Closed by the buyer — issue resolved with the seller.')
            WHERE id=?`,
      args: [d.id],
    },
    // Restore the order: delivered items stay delivered, everything else resumes.
    {
      sql: `UPDATE orders SET status =
              CASE WHEN delivered_at IS NOT NULL THEN 'delivered' ELSE 'processing' END,
              updated_at=datetime('now')
            WHERE id=?`,
      args: [d.order_id],
    },
    {
      sql: `UPDATE order_items SET status =
              CASE WHEN delivered_at IS NOT NULL THEN 'delivered' ELSE 'processing' END
            WHERE order_id=?`,
      args: [d.order_id],
    },
    {
      sql: `INSERT INTO messages (id,thread_id,sender_id,body,kind,dispute_id)
            VALUES (?,?,?,?, 'dispute_resolved', ?)`,
      args: [nid("msg_"), threadId, u.id, "Dispute closed by the buyer.", d.id],
    },
    { sql: `UPDATE threads SET dispute_id=NULL, updated_at=datetime('now') WHERE id=?`, args: [threadId] },
  ] as never);

  await notify(
    t.seller_id,
    "Dispute closed",
    "The buyer has withdrawn their dispute. Thanks for sorting it out.",
    "/seller/messages"
  );

  revalidatePath("/dashboard/messages");
  revalidatePath("/seller/messages");
  revalidatePath("/dashboard/disputes");
  revalidatePath("/admin/disputes");
  return { ok: true };
}

export async function startThreadAction(sellerId: string, orderId?: string): Promise<R> {
  const u = await requireUser();
  const existing = await one<{ id: string }>(
    `SELECT id FROM threads WHERE buyer_id=? AND seller_id=? AND COALESCE(order_id,'')=?`,
    [u.id, sellerId, orderId ?? ""]
  );
  if (existing) return { ok: true, id: existing.id };
  const id = nid("thr_");
  await run(`INSERT INTO threads (id,buyer_id,seller_id,order_id) VALUES (?,?,?,?)`, [
    id, u.id, sellerId, orderId ?? null,
  ]);
  return { ok: true, id };
}

export async function markThreadReadAction(threadId: string) {
  const u = await getSessionUser();
  if (!u) return;
  await run(`UPDATE messages SET read_flag=1 WHERE thread_id=? AND sender_id<>?`, [threadId, u.id]);
}

/* ======================= become a seller ========================= */

export async function applySellerAction(form: {
  storeName: string; primaryCat: string; description: string;
}): Promise<R> {
  const u = await requireUser();
  if (form.storeName.trim().length < 3)
    return { ok: false, error: "Store name must be at least 3 characters." };

  const slug = form.storeName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const taken = await one(`SELECT slug FROM seller_profiles WHERE slug=? AND user_id<>?`, [slug, u.id]);
  if (taken) return { ok: false, error: "That store name is already taken." };

  await run(
    `INSERT INTO seller_profiles (user_id,store_name,slug,description,primary_cat,status)
     VALUES (?,?,?,?,?, 'pending')
     ON CONFLICT(user_id) DO UPDATE SET
       store_name=excluded.store_name, slug=excluded.slug,
       description=excluded.description, primary_cat=excluded.primary_cat`,
    [u.id, form.storeName.trim(), slug, form.description.trim(), form.primaryCat]
  );
  await run(`UPDATE users SET is_seller=1 WHERE id=?`, [u.id]);
  await notify(u.id, "Seller application received", "Our team reviews applications within 24–48 hours.", "/dashboard/become-seller", "system");
  if (u.email) await mail.sellerApplied(u.email, u.name);

  revalidatePath("/dashboard/become-seller");
  return { ok: true };
}

/** demo helper so the client can test the seller panel without an admin */
export async function selfApproveSellerAction(): Promise<R> {
  const u = await requireUser();
  await run(
    `UPDATE seller_profiles SET status='active', verified=1, approved_at=datetime('now') WHERE user_id=?`,
    [u.id]
  );
  await run(`UPDATE users SET role = CASE WHEN role='admin' THEN role ELSE 'seller' END WHERE id=?`, [u.id]);
  revalidatePath("/seller");
  revalidatePath("/dashboard/become-seller");
  return { ok: true };
}

/* ============================ support ============================ */

export async function createTicketAction(input: {
  subject: string;
  category: string;
  body: string;
}): Promise<R> {
  const u = await getSessionUser();
  if (!u) return { ok: false, error: "AUTH" };
  if (input.subject.trim().length < 4) return { ok: false, error: "Add a short subject." };
  if (input.body.trim().length < 10) return { ok: false, error: "Please describe the issue in a bit more detail." };

  const id = nid("tkt_");
  const code = "TCK" + Math.floor(10000 + Math.random() * 89999);
  await run(
    `INSERT INTO tickets (id,code,user_id,subject,category,status) VALUES (?,?,?,?,?, 'open')`,
    [id, code, u.id, input.subject.trim(), input.category]
  );
  await run(`INSERT INTO ticket_messages (id,ticket_id,sender,body) VALUES (?,?,?,?)`, [
    nid("tmg_"), id, "buyer", input.body.trim(),
  ]);
  await notify(u.id, `Ticket ${code} created`, "Our support team replies within a few hours.", "/support", "system");
  if (u.email) await mail.ticketCreated(u.email, { code, subject: input.subject.trim() });
  revalidatePath("/support");
  return { ok: true, code };
}
