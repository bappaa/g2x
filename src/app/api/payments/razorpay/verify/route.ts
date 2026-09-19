/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getRazorpayConfig, verifyPaymentSignature } from "@/lib/razorpay";
import { run, one, tx, nid, all } from "@/lib/db";
import { gatewayByCode, feeFor } from "@/lib/gateways";
import { getCart } from "@/lib/queries";
import { kycDueFor, markKycDue, kycThreshold } from "@/lib/buyer-kyc";
import { mail } from "@/lib/mail";
import { ensureSchema } from "@/lib/ensure-schema";
import { escrowHoldHours } from "@/lib/escrow";
import { scheduleSubscriptions } from "@/lib/subscription";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

async function notify(userId: string, title: string, body: string, href: string, kind = "order") {
  await run(
    `INSERT INTO notifications (id,user_id,title,body,href,kind) VALUES (?,?,?,?,?,?)`,
    [nid("ntf_"), userId, title, body, href, kind]
  );
}

function credentialsFor(raw: string | null): string | null {
  if (!raw) return null;
  let sets: unknown;
  try { sets = JSON.parse(raw); } catch { return null; }
  if (!Array.isArray(sets) || !sets.length) return null;
  const set = sets[0] as Record<string, string> | undefined;
  if (!set) return null;
  const F: [string, string][] = [
    ["login", "Login / Username"],
    ["password", "Password"],
    ["url", "URL"],
    ["emailLogin", "Email login"],
    ["emailPassword", "Email password"],
    ["twoFaLogin", "2FA login"],
    ["twoFaPassword", "2FA password"],
    ["extra", "Additional details"],
  ];
  const out = F.filter(([k]) => String(set[k] ?? "").trim()).map(([k, label]) => ({ label, value: String(set[k]).trim() }));
  return out.length ? JSON.stringify(out) : null;
}

export async function POST(req: NextRequest) {
  try {
    await ensureSchema();
    const u = await getSessionUser();
    if (!u) return NextResponse.json({ ok: false, error: "AUTH" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const razorpay_order_id = String(body.razorpay_order_id || "");
    const razorpay_payment_id = String(body.razorpay_payment_id || "");
    const razorpay_signature = String(body.razorpay_signature || "");
    const uidRaw = String(body.uid || "").trim();
    const note = String(body.note || "").trim();
    const idemKey = String(body.idemKey || "").trim();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
      return NextResponse.json({ ok: false, error: "Missing Razorpay fields" }, { status: 400 });

    const cfg = await getRazorpayConfig();
    if (!cfg) return NextResponse.json({ ok: false, error: "Razorpay not configured" }, { status: 500 });

    const valid = verifyPaymentSignature({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      secret: cfg.keySecret,
    });
    if (!valid) return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 400 });

    const intent = await one<{
      id: string; user_id: string; amount: number; purpose: string; meta: string | null; status: string; currency: string;
    }>(`SELECT * FROM razorpay_intents WHERE razorpay_order_id=?`, [razorpay_order_id]);

    if (!intent) return NextResponse.json({ ok: false, error: "Order intent not found" }, { status: 404 });
    if (intent.user_id !== u.id) return NextResponse.json({ ok: false, error: "Not your order" }, { status: 403 });
    if (intent.status === "verified") {
      const existing = await one<{ code: string }>(`SELECT code FROM orders WHERE razorpay_order_id=?`, [razorpay_order_id]);
      if (existing) return NextResponse.json({ ok: true, code: existing.code, already: true });
    }

    const meta = (() => { try { return JSON.parse(intent.meta || "{}"); } catch { return {}; } })() as Record<string, string>;

    if (intent.purpose === "topup") {
      const raw = Number(meta.raw || 0);
      const amt = Math.round(raw * 100) / 100;
      if (!(amt > 0)) return NextResponse.json({ ok: false, error: "Invalid topup amount" }, { status: 400 });

      const willOweKyc = await kycDueFor(u.id, amt);
      const scopedKey = `topup:${u.id}:${idemKey || razorpay_payment_id}`.slice(0, 120);

      try {
        await tx([
          {
            sql: `INSERT INTO transactions (id,user_id,type,amount,reference,idem_key,razorpay_order_id,razorpay_payment_id)
                  VALUES (?,?, 'deposit', ?, ?, ?, ?, ?)`,
            args: [nid("txn_"), u.id, amt, `Wallet top-up via Razorpay (${razorpay_payment_id})`, scopedKey, razorpay_order_id, razorpay_payment_id],
          },
          { sql: `UPDATE users SET balance = balance + ? WHERE id=?`, args: [amt, u.id] },
        ] as never);
      } catch (e: unknown) {
        const msg = String((e as Error)?.message ?? "");
        if (/UNIQUE|constraint/i.test(msg)) {
          await run(`UPDATE razorpay_intents SET status='verified', verified_at=datetime('now') WHERE id=?`, [intent.id]).catch(() => {});
          return NextResponse.json({ ok: true, already: true });
        }
        throw e;
      }

      await run(`UPDATE razorpay_intents SET status='verified', verified_at=datetime('now') WHERE id=?`, [intent.id]).catch(() => {});

      if (u.email) {
        const gw = await gatewayByCode("razorpay").catch(() => null);
        await mail.walletTopUp(u.email, {
          amount: `$${amt.toFixed(2)}`,
          method: gw?.name || "Razorpay",
          fee: "",
          balance: `$${(Number(u.balance ?? 0) + amt).toFixed(2)}`,
        });
      }

      let verifyAfter;
      if (willOweKyc) {
        await markKycDue(u.id, `Wallet top-up ($${amt.toFixed(2)}) via Razorpay`);
        verifyAfter = { threshold: await kycThreshold(), reason: `Wallet top-up ($${amt.toFixed(2)})` };
      }

      revalidatePath("/dashboard/wallet");
      revalidatePath("/dashboard");

      return NextResponse.json({ ok: true, type: "topup", amount: amt, verifyAfter });
    } else {
      const items = await getCart(u.id);
      if (!items.length) return NextResponse.json({ ok: false, error: "Cart empty" }, { status: 400 });

      // Mixed category block
      const cats = Array.from(new Set((items as any[]).map((i:any)=>(i.category_slug||"").toLowerCase()).filter(Boolean)));
      if (cats.length > 1) {
        return NextResponse.json({ ok: false, error: `Mixed categories (${cats.join(", ")}) — checkout one category at a time.` }, { status: 400 });
      }
      const NO_DETAILS_CATS = ["accounts", "gift-cards", "giftcards", "subscriptions", "subscription"];
      const isAccountOnly = cats.length>0 && cats.every((c:any)=>NO_DETAILS_CATS.includes(c));

      // Per-game delivery details
      const deliveryDetails = (body.deliveryDetails || {}) as Record<string,string>;
      const singleUid = uidRaw;
      const groups = new Map<string, { game_name: string; category_slug: string }>();
      for (const it of items as any[]) {
        const gSlug = it.game_slug || "unknown";
        if (!groups.has(gSlug)) groups.set(gSlug, { game_name: it.game_name || gSlug, category_slug: (it.category_slug||"").toLowerCase() });
      }
      let deliveryUidToStore = singleUid;
      if (!isAccountOnly) {
        const detailsMap: Record<string,string> = {};
        for (const [gSlug, g] of groups.entries()) {
          if (NO_DETAILS_CATS.includes(g.category_slug)) continue;
          const val = (deliveryDetails[gSlug] || singleUid || "").trim();
          if (!val) {
            return NextResponse.json({ ok: false, error: `Delivery details required for ${g.game_name}` }, { status: 400 });
          }
          detailsMap[gSlug] = val;
        }
        deliveryUidToStore = Object.keys(detailsMap).length > 1 ? JSON.stringify(detailsMap) : (Object.values(detailsMap)[0] || singleUid || "");
      } else {
        deliveryUidToStore = singleUid || "auto-delivery";
      }

      // Validate stock & self-buy
      for (const it of items) {
        if (it.qty > it.stock) return NextResponse.json({ ok: false, error: `"${it.title}" only has ${it.stock} left` }, { status: 400 });
        if (it.seller_id === u.id) return NextResponse.json({ ok: false, error: `"${it.title}" is your own listing` }, { status: 400 });
      }

      let subtotal = +items.reduce((t, i) => t + i.price * i.qty, 0).toFixed(2);
      let couponDiscount = 0;
      let couponCode: string | null = null;
      let couponId: string | null = null;
      const rawCoupon = String(body.couponCode || meta.coupon || meta.couponCode || "").trim().toUpperCase();
      if (rawCoupon) {
        const c = await one(`SELECT * FROM coupons WHERE UPPER(code)=?`, [rawCoupon]) as any;
        if (c && c.status === "active") {
          const now = new Date().toISOString().slice(0,10);
          const expired = (c.end_date && now > String(c.end_date).slice(0,10)) || (c.start_date && now < String(c.start_date).slice(0,10));
          if (!expired && !(c.min_order>0 && subtotal < c.min_order)) {
            if (c.discount_type === "percent") couponDiscount = +(subtotal * (c.discount_value/100)).toFixed(2);
            else couponDiscount = +c.discount_value.toFixed(2);
            couponDiscount = Math.min(couponDiscount, subtotal);
            subtotal = +(subtotal - couponDiscount).toFixed(2);
            couponCode = c.code;
            couponId = c.id;
          }
        }
      }

      const fee = +(subtotal * 0.02).toFixed(2);
      const gw = await gatewayByCode("razorpay");
      if (!gw) return NextResponse.json({ ok: false, error: "Razorpay gateway not enabled" }, { status: 400 });
      const gwFee = feeFor(subtotal + fee, gw);
      const total = +(subtotal + fee + gwFee).toFixed(2);

      // intent stores charge amount (INR) and meta.usd (USD total). Compare USD totals.
      const intentUSD = Number(meta.usd || 0);
      if (intentUSD > 0 && Math.abs(total - intentUSD) > 0.5) {
        console.warn(`[razorpay] USD mismatch intent=${intentUSD} cart=${total}`);
      }

      const willOweKyc = await kycDueFor(u.id, total);

      const orderId = nid("ord_");
      const code = "G2X" + Math.floor(100000 + Math.random() * 899999);

      let autoDelivered = false;
      const stmts: { sql: string; args: unknown[] }[] = [
        {
          sql: `INSERT INTO orders (id,code,buyer_id,subtotal,fee,total,status,payment_method,payment_status,delivery_uid,buyer_note,gateway_fee,gateway_code,razorpay_order_id,razorpay_payment_id,razorpay_signature,coupon_code,discount)
                VALUES (?,?,?,?,?,?,'processing',?,'paid',?,?,?, ?, ?, ?, ?,?,?)`,
          args: [orderId, code, u.id, subtotal, fee, total, gw.name, deliveryUidToStore, note || null, gwFee, gw.code, razorpay_order_id, razorpay_payment_id, razorpay_signature, couponCode, couponDiscount],
        },
      ];

      for (const it of items) {
        const prof = await one<{ commission_pct: number }>(`SELECT commission_pct FROM seller_profiles WHERE user_id=?`, [it.seller_id]);
        const pct = Number(prof?.commission_pct ?? 8);
        const line = +(it.price * it.qty).toFixed(2);
        const commission = +((line * pct) / 100).toFixed(2);
        const net = +(line - commission).toFixed(2);
        const creds = it.auto_delivery ? credentialsFor(it.accounts_data) : null;
        const autoNow = !!creds;
        if (autoNow) autoDelivered = true;
        stmts.push({
          sql: `INSERT INTO order_items (id,order_id,offer_id,listing_id,product_id,seller_id,title,subtitle,image,href,unit_price,qty,line_total,commission_pct,commission_amt,seller_net,delivery_time,opt_region,opt_delivery,status,credentials,delivered_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          args: [
            nid("oit_"), orderId, it.offer_id, it.listing_id, it.product_id, it.seller_id,
            it.title, it.sub, it.image, it.href, it.price, it.qty, line, pct, commission, net,
            it.delivery, it.opt_region ?? null, it.opt_delivery ?? null,
            autoNow ? "delivered" : "processing", creds,
            autoNow ? new Date().toISOString().slice(0, 19).replace("T", " ") : null,
          ],
        });
        if (it.offer_id)
          stmts.push({
            sql: `UPDATE offers SET stock = MAX(0, stock - ?), sold_count = sold_count + ?, status = CASE WHEN stock - ? <= 0 THEN 'out_of_stock' ELSE status END WHERE id=?`,
            args: [it.qty, it.qty, it.qty, it.offer_id],
          });
        if (it.listing_id)
          stmts.push({
            sql: `UPDATE listings SET stock = MAX(0, stock - ?), status = CASE WHEN stock - ? <= 0 THEN 'out_of_stock' ELSE status END WHERE id=?`,
            args: [it.qty, it.qty, it.listing_id],
          });
        stmts.push({ sql: `UPDATE seller_profiles SET pending_bal = pending_bal + ? WHERE user_id=?`, args: [net, it.seller_id] });
      }

      ["Order Placed", "Payment Confirmed", "Seller Processing"].forEach((label, i) =>
        stmts.push({
          sql: `INSERT INTO order_events (id,order_id,label,actor,created_at) VALUES (?,?,?, 'system', datetime('now', '+' || ? || ' seconds'))`,
          args: [nid("evt_"), orderId, label, i],
        })
      );

      // Transaction history for buyer — fixes missing entry in /dashboard/transactions
      stmts.push({
        sql: `INSERT INTO transactions (id,user_id,type,amount,reference,order_id,razorpay_order_id,razorpay_payment_id)
              VALUES (?,?, 'purchase', ?, ?, ?, ?, ?)`,
        args: [nid("txn_"), u.id, -total, `Order ${code} via ${gw.name}`, orderId, razorpay_order_id, razorpay_payment_id],
      });

      stmts.push({ sql: `DELETE FROM cart_items WHERE user_id=?`, args: [u.id] });

      if (couponId && couponCode) {
        stmts.push({ sql: `UPDATE coupons SET used_count = used_count + 1 WHERE id=?`, args: [couponId] });
        stmts.push({ sql: `INSERT INTO coupon_uses (id,coupon_id,user_id,order_id) VALUES (?,?,?,?)`, args: [nid("cpnuse_"), couponId, u.id, orderId] });
      }

      await tx(stmts as never);

      await run(`UPDATE razorpay_intents SET status='verified', verified_at=datetime('now') WHERE id=?`, [intent.id]).catch(() => {});

      if (autoDelivered) {
        const pending = await one<{ n: number }>(`SELECT COUNT(*) AS n FROM order_items WHERE order_id=? AND status<>'delivered'`, [orderId]);
        if (Number(pending?.n ?? 0) === 0) {
          const hours = await escrowHoldHours();
          await run(`UPDATE orders SET status='delivered', delivered_at=COALESCE(delivered_at, datetime('now')), release_at=COALESCE(release_at, datetime('now', ?)), updated_at=datetime('now') WHERE id=?`, [`+${hours} hours`, orderId]);
          await run(`INSERT INTO order_events (id,order_id,label,actor) VALUES (?,?, 'Delivered', 'system')`, [nid("evt_"), orderId]);
          await run(`INSERT INTO order_events (id,order_id,label,actor) VALUES (?,?, 'Completed', 'system')`, [nid("evt_"), orderId]);
          const o = await one<{ release_at: string | null }>(`SELECT release_at FROM orders WHERE id=?`, [orderId]);
          if (o?.release_at) await scheduleSubscriptions(orderId, o.release_at);
          if (u.email) {
            const delivered = await all<{ title: string; credentials: string | null }>(`SELECT title, credentials FROM order_items WHERE order_id=? AND credentials IS NOT NULL`, [orderId]);
            for (const d of delivered) {
              let creds: { label: string; value: string }[] = [];
              try { const parsed = JSON.parse(d.credentials ?? "[]"); if (Array.isArray(parsed)) creds = parsed; } catch {}
              await mail.orderAutoDelivered(u.email, { code, title: d.title, creds });
            }
          }
        }
      }

      await notify(u.id, `Order ${code} confirmed`, autoDelivered ? "Your details are ready — open the order to view them." : "The seller has been notified and is delivering now.", `/dashboard/orders/${code}`);
      const sellers = Array.from(new Set(items.map((i) => i.seller_id)));
      for (const s of sellers) await notify(s, "New order received", `Order ${code} — please deliver as soon as possible.`, `/seller/orders`);

      if (u.email) await mail.orderConfirmed(u.email, { code, total: `$${Number(total).toFixed(2)}`, items: items.length, method: gw.name });
      for (const sid of sellers) {
        const su = await one<{ email: string }>(`SELECT email FROM users WHERE id=?`, [sid]);
        const mine = items.filter((i) => i.seller_id === sid);
        const gross = mine.reduce((a, b) => a + b.price * b.qty, 0);
        const prof = await one<{ commission_pct: number }>(`SELECT commission_pct FROM seller_profiles WHERE user_id=?`, [sid]);
        const net = gross * (1 - Number(prof?.commission_pct ?? 8) / 100);
        if (su?.email) {
          await mail.newSale(su.email, { code, title: mine[0]?.title ?? "your listing", net: `$${net.toFixed(2)}` });
          await mail.actionRequired(su.email, { code, title: mine[0]?.title ?? "your listing", qty: mine.reduce((a, b) => a + b.qty, 0), uid: deliveryUidToStore.slice(0,500), deadline: "24 hours" });
        }
      }

      let verifyAfter;
      if (willOweKyc) {
        const reason = `Order ${code} ($${total.toFixed(2)})`;
        await markKycDue(u.id, reason);
        await notify(u.id, "Verify your identity", `Thanks for your order. Because it was $${total.toFixed(2)}, please confirm your identity to keep your account fully active.`, "/dashboard/verification", "system");
        verifyAfter = { threshold: await kycThreshold(), reason };
        revalidatePath("/dashboard/verification");
      }

      revalidatePath("/dashboard/orders");
      revalidatePath("/seller/orders");

      return NextResponse.json({ ok: true, code, verifyAfter });
    }
  } catch (e: unknown) {
    console.error("[razorpay verify]", e);
    return NextResponse.json({ ok: false, error: (e as Error)?.message || "Verification failed" }, { status: 500 });
  }
}
