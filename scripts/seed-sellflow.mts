/**
 * SELLER FORM SPEC
 * ================
 * Encodes the client's per-category field specification: which blocks each
 * category shows, what the unit is called, how it is fulfilled, and the
 * category-specific dropdowns sellers must fill in.
 *
 * Everything written here is admin-editable afterwards (Categories -> Sell flow,
 * and Dropdown Options / Field Templates). This just establishes the correct
 * starting point instead of every category inheriting one generic form.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@libsql/client";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL?.trim() || "file:./g2x.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const nid = (p: string) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/* ------------------------------------------------------------------ */
/* Category configuration                                              */
/* ------------------------------------------------------------------ */

type Cfg = {
  unit: string;
  title: 0 | 1;
  images: 0 | 1;
  creds: 0 | 1;
  qty: 0 | 1;
  volume: 0 | 1;
  /** both | auto | manual */
  fulfilment: string;
  deliveryMethod: 0 | 1;
  region: 0 | 1;
  platform: 0 | 1;
  loginMethod: 0 | 1;
  commission: number;
  notice?: string;
  noticeTitle?: string;
};

const CATEGORIES: Record<string, Cfg> = {
  // 1. Sell Game Currency — Region, description, delivery method, qty, price/1K, volume.
  currency: {
    unit: "K", title: 0, images: 0, creds: 0, qty: 1, volume: 1,
    fulfilment: "manual", deliveryMethod: 1, region: 1, platform: 0,
    loginMethod: 0, commission: 5,
  },

  // Top Up — inferred to match currency, but per-unit and region/platform aware
  // (a top-up is tied to a store region and a device platform).
  "top-up": {
    unit: "unit", title: 0, images: 0, creds: 0, qty: 1, volume: 1,
    fulfilment: "manual", deliveryMethod: 1, region: 1, platform: 1,
    loginMethod: 1, commission: 5,
  },

  // 2 & 3. Game Accounts — title, photos, credential vault, auto OR manual.
  accounts: {
    unit: "account", title: 1, images: 1, creds: 1, qty: 1, volume: 0,
    fulfilment: "both", deliveryMethod: 0, region: 0, platform: 0,
    loginMethod: 0, commission: 10,
    noticeTitle: "5 Day money hold system",
    notice:
      "In order to protect our customers from account recovery fraud, we've placed a 5 day insurance policy for account sales, during which, should the buyer face any issues regarding loss or alteration of his recently purchased account, they would be able to dispute the purchase and resolve the issue with the seller or request a refund.",
  },

  // 4. Game Items — title, photos, delivery time, in-game delivery, qty, volume.
  items: {
    unit: "unit", title: 1, images: 1, creds: 0, qty: 1, volume: 1,
    fulfilment: "manual", deliveryMethod: 1, region: 0, platform: 0,
    loginMethod: 0, commission: 15,
  },

  // 5. Gift Cards — code vault, auto or manual, price per gift card.
  "gift-cards": {
    unit: "gift card", title: 1, images: 0, creds: 1, qty: 1, volume: 0,
    fulfilment: "both", deliveryMethod: 0, region: 1, platform: 0,
    loginMethod: 0, commission: 10,
  },

  subscriptions: {
    unit: "month", title: 1, images: 1, creds: 1, qty: 1, volume: 1,
    fulfilment: "both", deliveryMethod: 0, region: 1, platform: 0,
    loginMethod: 0, commission: 10,
  },

  boosting: {
    unit: "service", title: 1, images: 1, creds: 0, qty: 1, volume: 0,
    fulfilment: "manual", deliveryMethod: 0, region: 1, platform: 1,
    loginMethod: 1, commission: 15,
  },
};

/* ------------------------------------------------------------------ */
/* Option lists                                                        */
/* ------------------------------------------------------------------ */

/** Exactly the delivery windows the client specified. */
const DELIVERY_TIMES = [
  "20 min", "1 H", "5 H", "12 H",
  "1 day", "2 days", "3 days", "7 days", "14 days", "30 days",
];

/** Delivery methods for currency (the client's list). */
const DELIVERY_METHODS = [
  "In-game trade", "Game Pass", "Auction House", "Mail Trade",
  "Island Delivery", "Epic Gifting", "Login Method", "In-game delivery",
];

async function seedList(key: string, labels: string[]) {
  // Retire anything not in the new list, then upsert the list in order.
  await db.execute({ sql: `UPDATE option_lists SET active=0 WHERE list_key=?`, args: [key] });
  let i = 0;
  for (const label of labels) {
    const value = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    await db.execute({
      sql: `INSERT INTO option_lists (id,list_key,value,label,sort_order,active)
            VALUES (?,?,?,?,?,1)
            ON CONFLICT(id) DO UPDATE SET label=excluded.label, sort_order=excluded.sort_order, active=1`,
      args: [`opt_${key}_${value}`, key, value, label, i++],
    });
  }
  console.log(`  ${key.padEnd(16)} ${labels.length} options`);
}

/* ------------------------------------------------------------------ */
/* Category-specific extra fields                                      */
/* ------------------------------------------------------------------ */

type Tpl = { label: string; key: string; type: string; required: 0 | 1; options?: string[] };

const FIELDS: Record<string, Tpl[]> = {
  // "Original Email" — which email provider the account was registered with.
  accounts: [
    {
      label: "Original Email", key: "original_email", type: "dropdown", required: 1,
      options: ["Included — full access", "Included — no access", "Not included", "Changeable on request"],
    },
  ],
  "gift-cards": [
    { label: "Gift card region", key: "gc_region", type: "dropdown", required: 0,
      options: ["Global", "US", "EU", "UK", "Turkey", "Argentina", "India", "Brazil"] },
  ],
};

async function main() {
  console.log("[sellflow] option lists");
  await seedList("delivery_time", DELIVERY_TIMES);
  await seedList("delivery_method", DELIVERY_METHODS);

  console.log("[sellflow] categories");
  for (const [slug, c] of Object.entries(CATEGORIES)) {
    const exists = await db.execute({ sql: `SELECT slug FROM categories WHERE slug=?`, args: [slug] });
    if (!exists.rows.length) {
      // Gift Cards is new — create it at the end of the nav.
      await db.execute({
        sql: `INSERT INTO categories (slug,name,blurb,icon,sort_order,status)
              VALUES (?,?,?,?,?, 'active')`,
        args: [slug, "Gift Cards", "Codes & vouchers", "gift", 7],
      });
      console.log(`  + created category ${slug}`);
    }

    await db.execute({
      sql: `UPDATE categories
               SET unit_label=?, needs_title=?, needs_images=?, needs_credentials=?,
                   needs_quantity=?, allow_volume_discount=?, commission_pct=?,
                   fulfilment=?, show_delivery_method=?, show_region=?,
                   show_platform=?, show_login_method=?,
                   sell_notice_title=COALESCE(?, sell_notice_title),
                   sell_notice=COALESCE(?, sell_notice)
             WHERE slug=?`,
      args: [
        c.unit, c.title, c.images, c.creds, c.qty, c.volume, c.commission,
        c.fulfilment, c.deliveryMethod, c.region, c.platform, c.loginMethod,
        c.noticeTitle ?? null, c.notice ?? null, slug,
      ],
    });
    console.log(`  ${slug.padEnd(16)} unit=${c.unit.padEnd(10)} fulfil=${c.fulfilment.padEnd(7)} creds=${c.creds} vol=${c.volume}`);
  }

  console.log("[sellflow] category fields");
  for (const [slug, tpls] of Object.entries(FIELDS)) {
    await db.execute({ sql: `DELETE FROM field_templates WHERE category_slug=?`, args: [slug] });
    let i = 0;
    for (const t of tpls) {
      await db.execute({
        sql: `INSERT INTO field_templates
                (id,category_slug,label,field_key,field_type,options,required,show_frontend,sort_order)
              VALUES (?,?,?,?,?,?,?,1,?)`,
        args: [nid("fld_"), slug, t.label, t.key, t.type,
               t.options ? JSON.stringify(t.options) : null, t.required, i++],
      });
    }
    console.log(`  ${slug.padEnd(16)} ${tpls.length} field(s)`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
