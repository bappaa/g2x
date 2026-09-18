import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getCart } from "@/lib/queries";
import { gatewayByCode, feeFor } from "@/lib/gateways";
import { getRazorpayConfig, createRazorpayOrder } from "@/lib/razorpay";
import { run, nid } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const u = await getSessionUser();
    if (!u) return NextResponse.json({ ok: false, error: "AUTH" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const purpose = (body.purpose || "checkout") as "checkout" | "topup";
    const gatewayCode = body.gateway_code || "razorpay";

    const cfg = await getRazorpayConfig();
    if (!cfg) return NextResponse.json({ ok: false, error: "Razorpay not configured" }, { status: 500 });

    let amount = 0;
    let meta: Record<string, string> = {};

    if (purpose === "topup") {
      const raw = Number(body.amount);
      if (!(raw > 0) || raw > 5000) return NextResponse.json({ ok: false, error: "Invalid amount" }, { status: 400 });
      const gw = await gatewayByCode(gatewayCode);
      if (!gw) return NextResponse.json({ ok: false, error: "Gateway not available" }, { status: 400 });
      const fee = feeFor(raw, gw);
      amount = Math.round((raw + fee) * 100) / 100;
      meta = { userId: u.id, purpose: "topup", raw: String(raw), fee: String(fee) };
    } else {
      // checkout – compute from cart server-side, never trust client total
      const items = await getCart(u.id);
      if (!items.length) return NextResponse.json({ ok: false, error: "Cart empty" }, { status: 400 });
      const subtotal = +items.reduce((t, i) => t + i.price * i.qty, 0).toFixed(2);
      const fee = +(subtotal * 0.02).toFixed(2);
      const gw = await gatewayByCode(gatewayCode);
      if (!gw) return NextResponse.json({ ok: false, error: "Gateway not available" }, { status: 400 });
      const gwFee = feeFor(subtotal + fee, gw);
      amount = +(subtotal + fee + gwFee).toFixed(2);
      meta = { userId: u.id, purpose: "checkout", subtotal: String(subtotal), fee: String(fee), gwFee: String(gwFee) };
    }

    const receipt = `g2x_${purpose}_${u.id.slice(0, 8)}_${Date.now()}`;

    const rzpOrder = await createRazorpayOrder({
      amount,
      currency: cfg.currency,
      receipt,
      notes: { ...meta, gateway: gatewayCode },
    });

    if (!rzpOrder) return NextResponse.json({ ok: false, error: "Failed to create Razorpay order" }, { status: 500 });

    // store intent for webhook/verify correlation
    const intentId = nid("rzp_");
    await run(
      `INSERT INTO razorpay_intents (id,user_id,razorpay_order_id,amount,currency,purpose,status,gateway_code,meta)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [intentId, u.id, rzpOrder.id, amount, rzpOrder.currency, purpose, "created", gatewayCode, JSON.stringify({ ...meta, uid: body.uid || "", note: body.note || "" })]
    ).catch(() => {});

    return NextResponse.json({
      ok: true,
      razorpayOrderId: rzpOrder.id,
      amount,
      currency: rzpOrder.currency,
      keyId: cfg.keyId,
      intentId,
    });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: (e as Error)?.message || "Failed" }, { status: 500 });
  }
}
