/** Seeds the admin-managed footer links. Re-runnable; skips existing rows. */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@libsql/client";
import { makeDb } from "./db-url.mjs";
import { randomUUID } from "crypto";

const db = makeDb(createClient, { quiet: true });

const COLS: [string, [string, string][]][] = [
  ["Marketplace", [
    ["Accounts", "/c/accounts"], ["Top Up", "/c/top-up"], ["Currency", "/c/currency"],
    ["Boosting", "/c/boosting"], ["Subscription", "/c/subscriptions"], ["Items", "/c/items"],
  ]],
  ["Company", [
    ["About Us", "/p/about-us"], ["How It Works", "/p/how-it-works"],
    ["Become a Seller", "/dashboard/become-seller"], ["Seller Rules", "/p/seller-rules"],
    ["Fees", "/p/fees"], ["Contact Us", "/p/contact"],
  ]],
  ["Support", [
    ["Help Center", "/support"], ["Live Support", "/support"],
    ["Order Status", "/dashboard/orders"], ["Refund Policy", "/p/refund-policy"],
    ["Dispute Policy", "/p/dispute-policy"], ["Buyer Protection", "/p/buyer-protection"],
  ]],
  ["Legal", [
    ["Terms & Conditions", "/p/terms"], ["Privacy Policy", "/p/privacy"],
    ["Cookie Policy", "/p/cookie-policy"], ["DMCA / Copyright", "/p/dmca"],
  ]],
];

let n = 0;
for (const [section, links] of COLS) {
  for (let i = 0; i < links.length; i++) {
    const [label, href] = links[i];
    const ex = await db.execute({
      sql: `SELECT id FROM nav_links WHERE section=? AND label=? AND placement='footer'`,
      args: [section, label],
    });
    if (ex.rows.length) continue;
    await db.execute({
      sql: `INSERT INTO nav_links (id,section,label,href,placement,sort_order,active)
            VALUES (?,?,?,?,'footer',?,1)`,
      args: ["nav_" + randomUUID().slice(0, 12), section, label, href, i],
    });
    n++;
  }
}
console.log(`✓ nav links — ${n} created`);
