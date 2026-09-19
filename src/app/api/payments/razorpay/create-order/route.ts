/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getCart } from "@/lib/queries";
import { gatewayByCode, feeFor } from "@/lib/gateways";
import { getRazorpayConfig, createRazorpayOrder } from "@/lib/razorpay";
import { run, nid, all } from "@/lib/db";
import { CURRENCIES } from "@/lib/i18n";

export const dynamic = "force-dynamic";

async function getRateFor(currency: string): Promise<number> {
  const code = currency.toUpperCase();
  try {
    const rows = await all<{ key: string; value: string }>(`SELECT key, value FROM settings WHERE key LIKE 'fx_%'`);
    for (const r of rows) {
      if (r.key.toUpperCase() === `FX_${code}`) {
        const n = Number(r.value);
        if (Number.isFinite(n) && n > 0) return n;
      }
    }
  } catch {}
  const def = CURRENCIES.find((c) => c.code === code);
  return def?.rate || 1;
}

export async function POST(req: NextRequest) {
  try {
    const u = await getSessionUser();
    if (!u) return NextResponse.json({ ok: false, error: "AUTH" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const purpose = (body.purpose || "checkout") as "checkout" | "topup";
    const gatewayCode = body.gateway_code || "razorpay";

    const cfg = await getRazorpayConfig();
    if (!cfg) return NextResponse.json({ ok: false, error: "Razorpay not configured" }, { status: 500 });

    let amountUSD = 0;
    let meta: Record<string, string> = {};
    let couponDiscount = 0;
    let couponCode: string | null = null;

    if (purpose === "topup") {
      const raw = Number(body.amount);
      if (!(raw > 0) || raw > 5000) return NextResponse.json({ ok: false, error: "Invalid amount" }, { status: 400 });
      const gw = await gatewayByCode(gatewayCode);
      if (!gw) return NextResponse.json({ ok: false, error: "Gateway not available" }, { status: 400 });
      const fee = feeFor(raw, gw);
      amountUSD = Math.round((raw + fee) * 100) / 100;
      meta = { userId: u.id, purpose: "topup", raw: String(raw), fee: String(fee), usd: String(amountUSD) };
    } else {
      const items = await getCart(u.id);
      if (!items.length) return NextResponse.json({ ok: false, error: "Cart empty" }, { status: 400 });

      // --- Mixed category block ---
      const cats = Array.from(new Set((items as any[]).map((i) => (i.category_slug || "").toLowerCase()).filter(Boolean)));
      if (cats.length > 1) {
        return NextResponse.json({ ok: false, error: `Mixed categories (${cats.join(", ")}) — checkout one category at a time.` }, { status: 400 });
      }
      const NO_DETAILS_CATS = ["accounts", "gift-cards", "giftcards", "subscriptions", "subscription"];
      const isAccountOnly = cats.length > 0 && cats.every((c) => NO_DETAILS_CATS.includes(c));

      // Validate per-game delivery details
      const deliveryDetails = (body.deliveryDetails || {}) as Record<string, string>;
      const singleUid = String(body.uid || "").trim();
      const groups = new Map<string, { game_name: string; category_slug: string }>();
      for (const it of items as any[]) {
        const gSlug = it.game_slug || "unknown";
        if (!groups.has(gSlug)) groups.set(gSlug, { game_name: it.game_name || gSlug, category_slug: (it.category_slug || "").toLowerCase() });
      }
      if (!isAccountOnly) {
        for (const [gSlug, g] of groups.entries()) {
          if (NO_DETAILS_CATS.includes(g.category_slug)) continue;
          const val = (deliveryDetails[gSlug] || singleUid || "").trim();
          if (!val) {
            return NextResponse.json({ ok: false, error: `Delivery details required for ${g.game_name}` }, { status: 400 });
          }
        }
      }

      let subtotal = +items.reduce((t, i) => t + i.price * i.qty, 0).toFixed(2);
      const rawCoupon = String(body.couponCode || "").trim().toUpperCase();
      if (rawCoupon) {
        // Validate coupon inline
        const { one: oneDb } = await import("@/lib/db");
        const c = await oneDb(`SELECT * FROM coupons WHERE UPPER(code)=?`, [rawCoupon]) as any;
        if (!c || c.status !== "active") {
          return NextResponse.json({ ok: false, error: "Invalid coupon." }, { status: 400 });
        }
        const now = new Date().toISOString().slice(0,10);
        if (c.start_date && now < String(c.start_date).slice(0,10)) return NextResponse.json({ ok: false, error: "Coupon not started." }, { status: 400 });
        if (c.end_date && now > String(c.end_date).slice(0,10)) return NextResponse.json({ ok: false, error: "Coupon expired." }, { status: 400 });
        if (c.min_order > 0 && subtotal < c.min_order) return NextResponse.json({ ok: false, error: `Min order $${Number(c.min_order).toFixed(2)} required.` }, { status: 400 });
        const applies = String(c.applies_to||"all").toLowerCase();
        if (applies !== "all") {
          if (applies.startsWith("game:")) {
            const gs = applies.slice(5);
            if (!(items as any[]).some((it:any)=>(it.game_slug||"").toLowerCase()===gs)) return NextResponse.json({ ok: false, error: `Coupon only for ${gs}.` }, { status: 400 });
          } else if (applies.startsWith("category:")) {
            const cat = applies.slice(9);
            if (!(items as any[]).some((it:any)=>(it.category_slug||"").toLowerCase()===cat)) return NextResponse.json({ ok: false, error: `Coupon only for ${cat}.` }, { status: 400 });
          }
        }
        if (c.usage_limit>0 && c.used_count>=c.usage_limit) return NextResponse.json({ ok: false, error: "Coupon limit reached." }, { status: 400 });
        const perUser = await oneDb(`SELECT COUNT(*) AS n FROM coupon_uses WHERE coupon_id=? AND user_id=?`, [c.id, u.id]) as any;
        if (c.usage_per_user>0 && Number(perUser?.n??0)>=c.usage_per_user) return NextResponse.json({ ok: false, error: "You already used this coupon." }, { status: 400 });
        if (c.discount_type === "percent") couponDiscount = +(subtotal * (c.discount_value/100)).toFixed(2);
        else couponDiscount = +c.discount_value.toFixed(2);
        couponDiscount = Math.min(couponDiscount, subtotal);
        subtotal = +(subtotal - couponDiscount).toFixed(2);
        couponCode = c.code;
      }

      const fee = +(subtotal * 0.02).toFixed(2);
      const gw = await gatewayByCode(gatewayCode);
      if (!gw) return NextResponse.json({ ok: false, error: "Gateway not available" }, { status: 400 });
      const gwFee = feeFor(subtotal + fee, gw);
      amountUSD = +(subtotal + fee + gwFee).toFixed(2);
      meta = { userId: u.id, purpose: "checkout", subtotal: String(subtotal), fee: String(fee), gwFee: String(gwFee), usd: String(amountUSD), coupon: couponCode||"", discount: String(couponDiscount) };
    }

    const chargeCurrency = (cfg.currency || "INR").toUpperCase();
    const rate = await getRateFor(chargeCurrency);
    const amountCharge = chargeCurrency === "USD" ? amountUSD : Math.round(amountUSD * rate * 100) / 100;

    const receipt = `g2x_${purpose}_${u.id.slice(0, 8)}_${Date.now()}`;

    const rzpOrder = await createRazorpayOrder({
      amount: amountCharge,
      currency: chargeCurrency,
      receipt,
      notes: { ...meta, gateway: gatewayCode, charge: String(amountCharge) },
    });

    if (!rzpOrder) return NextResponse.json({ ok: false, error: "Failed to create Razorpay order" }, { status: 500 });

    const intentId = nid("rzp_");
    await run(
      `INSERT INTO razorpay_intents (id,user_id,razorpay_order_id,amount,currency,purpose,status,gateway_code,meta)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [intentId, u.id, rzpOrder.id, amountCharge, rzpOrder.currency, purpose, "created", gatewayCode, JSON.stringify({ ...meta, uid: body.uid || "", deliveryDetails: body.deliveryDetails || {}, couponCode: couponCode||"", discount: String(couponDiscount), note: body.note || "", charge: String(amountCharge), rate: String(rate) })]
    ).catch(() => {});

    return NextResponse.json({
      ok: true,
      razorpayOrderId: rzpOrder.id,
      amount: amountCharge,
      amountUSD,
      currency: rzpOrder.currency,
      keyId: cfg.keyId,
      intentId,
      rate,
    });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: (e as Error)?.message || "Failed" }, { status: 500 });
  }
}
