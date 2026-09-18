import "server-only";
import crypto from "node:crypto";
import { one } from "./db";

/**
 * Razorpay integration – server-only.
 *
 * Two credential sources (priority):
 * 1) payment_gateways.config JSON where code='razorpay' (admin-configured)
 * 2) env vars RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET
 *
 * The gateway config JSON shape: { key_id, key_secret, webhook_secret, currency }
 */

type RazorpayConfig = {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  currency: string;
};

export async function getRazorpayConfig(): Promise<RazorpayConfig | null> {
  let keyId = process.env.RAZORPAY_KEY_ID || "";
  let keySecret = process.env.RAZORPAY_KEY_SECRET || "";
  let webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
  let currency = process.env.RAZORPAY_CURRENCY || "INR";

  try {
    const row = await one<{ config: string | null; note: string | null }>(
      `SELECT config, note FROM payment_gateways WHERE code='razorpay' LIMIT 1`
    );
    if (row?.config) {
      try {
        const cfg = JSON.parse(row.config);
        if (cfg.key_id) keyId = cfg.key_id;
        if (cfg.keyId) keyId = cfg.keyId;
        if (cfg.key_secret) keySecret = cfg.key_secret;
        if (cfg.keySecret) keySecret = cfg.keySecret;
        if (cfg.webhook_secret) webhookSecret = cfg.webhook_secret;
        if (cfg.webhookSecret) webhookSecret = cfg.webhookSecret;
        if (cfg.currency) currency = cfg.currency;
      } catch {}
    }
    // also allow note to hold JSON if config column not yet present
    if ((!keyId || !keySecret) && row?.note) {
      try {
        const cfg = JSON.parse(row.note);
        if (cfg.key_id && !keyId) keyId = cfg.key_id;
        if (cfg.key_secret && !keySecret) keySecret = cfg.key_secret;
        if (cfg.webhook_secret && !webhookSecret) webhookSecret = cfg.webhook_secret;
      } catch {}
    }
  } catch {}

  if (!keyId || !keySecret) return null;
  return { keyId, keySecret, webhookSecret, currency: currency || "INR" };
}

export async function createRazorpayOrder(opts: {
  amount: number; // in major units (e.g. dollars/rupees) – we convert to paise
  currency?: string;
  receipt?: string;
  notes?: Record<string, string>;
}): Promise<{ id: string; amount: number; currency: string } | null> {
  const cfg = await getRazorpayConfig();
  if (!cfg) throw new Error("Razorpay not configured. Add keys in Admin → Gateways or env.");

  const currency = (opts.currency || cfg.currency || "INR").toUpperCase();
  // Razorpay expects amount in smallest currency unit (paise for INR, cents for USD)
  const amountSmall = Math.round(opts.amount * 100);

  const auth = Buffer.from(`${cfg.keyId}:${cfg.keySecret}`).toString("base64");

  const body = {
    amount: amountSmall,
    currency,
    receipt: opts.receipt || `rcpt_${Date.now()}`,
    notes: opts.notes || {},
  };

  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as { error?: { description?: string; code?: string } })?.error?.description || (data as { error?: { description?: string; code?: string } })?.error?.code || res.statusText;
    throw new Error(`Razorpay order failed: ${msg}`);
  }

  return {
    id: (data as { id: string }).id,
    amount: (data as { amount: number }).amount,
    currency: (data as { currency: string }).currency,
  };
}

export function verifyPaymentSignature(opts: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  secret: string;
}): boolean {
  const payload = `${opts.razorpay_order_id}|${opts.razorpay_payment_id}`;
  const expected = crypto.createHmac("sha256", opts.secret).update(payload).digest("hex");
  return expected === opts.razorpay_signature;
}

export function verifyWebhookSignature(opts: {
  body: string; // raw body string
  signature: string;
  secret: string;
}): boolean {
  const expected = crypto.createHmac("sha256", opts.secret).update(opts.body).digest("hex");
  return expected === opts.signature;
}

export async function fetchRazorpayPayment(paymentId: string) {
  const cfg = await getRazorpayConfig();
  if (!cfg) return null;
  const auth = Buffer.from(`${cfg.keyId}:${cfg.keySecret}`).toString("base64");
  const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) return null;
  return res.json();
}
