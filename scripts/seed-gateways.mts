/** Seeds the default payment gateways. Re-runnable. */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@libsql/client";
import { makeDb } from "./db-url.mjs";
import { randomUUID } from "crypto";

const db = makeDb(createClient, { quiet: true });

const ROWS = [
  { code: "wallet", name: "G2X Wallet",  logo: "",          pct: 0,   fixed: 0,    topup: 0, checkout: 1, note: "Pay from your G2X balance — no gateway fee." },
  { code: "card",   name: "Card",        logo: "visa",      pct: 2.9, fixed: 0.30, topup: 1, checkout: 1, note: "Visa / Mastercard / Amex" },
  { code: "upi",    name: "UPI",         logo: "upi",       pct: 0,   fixed: 0,    topup: 1, checkout: 1, note: "Instant bank transfer (India)" },
  { code: "paypal", name: "PayPal",      logo: "paypal",    pct: 3.4, fixed: 0.35, topup: 1, checkout: 1, note: "" },
  { code: "crypto", name: "Crypto",      logo: "",          pct: 1.0, fixed: 0,    topup: 1, checkout: 1, note: "BTC / ETH / USDT" },
];

let n = 0;
for (let i = 0; i < ROWS.length; i++) {
  const r = ROWS[i];
  const ex = await db.execute({ sql: `SELECT id FROM payment_gateways WHERE code=?`, args: [r.code] });
  if (ex.rows.length) continue;
  await db.execute({
    sql: `INSERT INTO payment_gateways
            (id,code,name,logo,fee_percent,fee_fixed,min_amount,max_amount,enabled,for_topup,for_checkout,sort_order,note)
          VALUES (?,?,?,?,?,?,?,?,1,?,?,?,?)`,
    args: ["pg_" + randomUUID().slice(0, 12), r.code, r.name, r.logo, r.pct, r.fixed, 0, 0, r.topup, r.checkout, i, r.note],
  });
  n++;
}
console.log(`✓ payment gateways — ${n} created, ${ROWS.length - n} already present`);
