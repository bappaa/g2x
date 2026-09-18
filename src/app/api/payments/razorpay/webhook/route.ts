import { NextRequest, NextResponse } from "next/server";
import { getRazorpayConfig, verifyWebhookSignature } from "@/lib/razorpay";
import { run } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    const signature = req.headers.get("x-razorpay-signature") || "";

    const cfg = await getRazorpayConfig();
    if (!cfg) return NextResponse.json({ ok: false, error: "Not configured" }, { status: 500 });

    const secret = cfg.webhookSecret || cfg.keySecret;
    if (!secret) return NextResponse.json({ ok: false, error: "No webhook secret" }, { status: 500 });

    const valid = verifyWebhookSignature({ body: raw, signature, secret });
    if (!valid) {
      console.warn("[razorpay webhook] invalid signature");
      return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 400 });
    }

    let event: Record<string, unknown>;
    try { event = JSON.parse(raw); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }

    const type = (event as { event?: string }).event || "";
    // Handle payment.captured, order.paid
    if (type.includes("payment") || type.includes("order")) {
      const payment = (event as { payload?: { payment?: { entity?: { order_id?: string; id?: string } }; order?: { entity?: { id?: string } } } }).payload?.payment?.entity;
      const order = (event as { payload?: { order?: { entity?: { id?: string } } } }).payload?.order?.entity;
      const razorpay_order_id = payment?.order_id || order?.id;
      const razorpay_payment_id = payment?.id;

      if (razorpay_order_id) {
        // mark intent as captured if exists
        await run(`UPDATE razorpay_intents SET status='captured' WHERE razorpay_order_id=? AND status!='verified'`, [razorpay_order_id]).catch(() => {});
        // if order already created, ensure payment ids are stored
        if (razorpay_payment_id) {
          await run(`UPDATE orders SET razorpay_payment_id=COALESCE(razorpay_payment_id, ?), payment_status='paid' WHERE razorpay_order_id=?`, [razorpay_payment_id, razorpay_order_id]).catch(() => {});
          await run(`UPDATE transactions SET razorpay_payment_id=COALESCE(razorpay_payment_id, ?) WHERE razorpay_order_id=?`, [razorpay_payment_id, razorpay_order_id]).catch(() => {});
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    console.error("[razorpay webhook]", e);
    return NextResponse.json({ ok: false, error: (e as Error)?.message }, { status: 500 });
  }
}
