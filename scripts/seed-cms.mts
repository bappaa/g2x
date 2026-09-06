/**
 * Seeds the cms_blocks rows that drive the homepage.
 * Safe to re-run: existing rows are left untouched so admin edits survive.
 * Run with: npm run db:cms
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@libsql/client";
import { makeDb } from "./db-url.mjs";

const db = makeDb(createClient, { quiet: true });

type Row = {
  key: string; title?: string; subtitle?: string; body?: string; image?: string;
  cta_label?: string; cta_href?: string; data?: unknown;
};

const BLOCKS: Row[] = [
  {
    key: "hero",
    title: "Your Ultimate",
    subtitle: "Gaming Marketplace",
    body: "Buy & sell gaming accounts, coins, items, top-ups, boosting, subscription & more at the best prices.",
    image: "/art/hero.png",
    cta_label: "Explore Games",
    cta_href: "/c/top-up",
    data: [
      { icon: "zap", label: "Instant Delivery" },
      { icon: "shield", label: "Secure Payment" },
      { icon: "star", label: "24/7 Support" },
      { icon: "coins", label: "Best Prices" },
      { cta2: "How It Works", cta2href: "/p/how-it-works" },
    ],
  },
  { key: "popular_games", title: "POPULAR CATEGORIES" },
  { key: "popular_accounts", title: "Popular Accounts" },
  { key: "popular_currency", title: "Popular Currency" },
  { key: "popular_topup", title: "Popular Top Up" },
  { key: "popular_items", title: "Popular Items" },
  { key: "popular_boosting", title: "Popular Boosting" },
  { key: "popular_subscriptions", title: "Popular Subscriptions" },
  {
    key: "trust",
    title: "Why G2X",
    data: [
      { icon: "shield", value: "Trusted Escrow", label: "Sellers paid only on delivery" },
      { icon: "sparkles", value: "Best Value", label: "Compare every seller offer" },
      { icon: "trophy", value: "Verified Sellers", label: "ID-checked before listing" },
    ],
  },
  { key: "reviews", title: "WHAT OUR CUSTOMERS SAY" },
  { key: "featured_offers", title: "Featured Offers" },
  { key: "featured_sellers", title: "Top Sellers" },
  { key: "faq", title: "Frequently Asked Questions" },
  { key: "announcement_bar", title: "" },
  { key: "promo_banner", title: "" },
];

let created = 0;
for (const b of BLOCKS) {
  const ex = await db.execute({ sql: `SELECT key FROM cms_blocks WHERE key=?`, args: [b.key] });
  if (ex.rows.length) continue;
  await db.execute({
    sql: `INSERT INTO cms_blocks (key,title,subtitle,body,image,cta_label,cta_href,data,active)
          VALUES (?,?,?,?,?,?,?,?,1)`,
    args: [
      b.key, b.title ?? "", b.subtitle ?? "", b.body ?? "", b.image ?? "",
      b.cta_label ?? "", b.cta_href ?? "",
      b.data ? JSON.stringify(b.data) : null,
    ],
  });
  created++;
}
console.log(`✓ cms blocks — ${created} created, ${BLOCKS.length - created} already present`);
