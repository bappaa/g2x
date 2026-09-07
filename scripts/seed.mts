/**
 * G2X.GG database bootstrap + seed.
 *   npm run db:push   -> create schema
 *   npm run db:seed   -> schema + catalog + demo accounts
 *
 * Uses TURSO_DATABASE_URL / TURSO_AUTH_TOKEN when present,
 * otherwise a local file:./g2x.db so it runs anywhere.
 */
import { createClient } from "@libsql/client";
import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "dotenv";
import { makeDb } from "./db-url.mjs";

config({ path: ".env.local" });
config({ path: ".env" });

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const db = makeDb(createClient);

const seedOnly = process.argv.includes("--schema-only");
const nid = (p = "") => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);


/* ------------------------------ schema ------------------------------ */
const sql = readFileSync(join(root, "src/lib/schema.sql"), "utf8");
for (const stmt of sql.split(";").map((s) => s.trim()).filter(Boolean)) {
  await db.execute(stmt);
}
console.log("✓ schema applied");

if (seedOnly) {
  console.log("✓ done (schema only)");
  process.exit(0);
}

/* ------------------------------ catalog ----------------------------- */
const { games, categories, products } = await import("../src/lib/catalog");

for (const c of categories) {
  await db.execute({
    sql: `INSERT INTO categories (slug,name,blurb,icon,sort_order) VALUES (?,?,?,?,?)
          ON CONFLICT(slug) DO UPDATE SET name=excluded.name, blurb=excluded.blurb,
                                          sort_order=excluded.sort_order`,
    args: [c.slug, c.name, c.blurb, c.icon, c.order ?? 0],
  });
}

for (const [i, g] of games.entries()) {
  await db.execute({
    sql: `INSERT INTO games (slug,name,logo,accent,sort_order) VALUES (?,?,?,?,?)
          ON CONFLICT(slug) DO UPDATE SET name=excluded.name, logo=excluded.logo`,
    args: [g.slug, g.name, g.logo, g.accent, i],
  });
  for (const c of g.categories) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO game_categories (game_slug,category_slug) VALUES (?,?)`,
      args: [g.slug, c],
    });
  }
}
console.log(`✓ ${games.length} games, ${categories.length} categories`);

for (const p of products) {
  await db.execute({
    sql: `INSERT INTO products
            (id,slug,game_slug,category_slug,name,image,base_price,
             delivery_method,delivery_time,region,platform,popular)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(id) DO UPDATE SET
            name=excluded.name, image=excluded.image, base_price=excluded.base_price`,
    args: [
      p.id, p.slug, p.game, p.category, p.name, p.image, p.from,
      p.deliveryMethod, p.deliveryTime, p.region, p.platform, p.popular ? 1 : 0,
    ],
  });
}
console.log(`✓ ${products.length} products`);

/* --------------------------- subscriptions -------------------------- */
const subBrands = [
  ["netflix", "Netflix", "netflix"],
  ["spotify", "Spotify", "spotify"],
  ["disney-plus", "Disney+", "disneyplus"],
  ["amazon-prime", "Amazon Prime", "prime"],
  ["youtube-premium", "YouTube Premium", "youtube"],
  ["crunchyroll", "Crunchyroll", "crunchyroll"],
  ["discord-nitro", "Discord Nitro", "discord"],
  ["apple-music", "Apple Music", "applemusic"],
  ["xbox-game-pass", "Xbox Game Pass", "xbox"],
];
const subTiers = [["Premium", 1.35], ["Standard", 1.0]];
const subMonths = [1, 3, 6, 12];

for (const [i, [slug, name, icon]] of subBrands.entries()) {
  await db.execute({
    sql: `INSERT INTO games (slug,name,logo,accent,sort_order) VALUES (?,?,?,?,?)
          ON CONFLICT(slug) DO UPDATE SET name=excluded.name, logo=excluded.logo`,
    args: [slug, name, icon, "#8b3dff", 100 + i],
  });
  await db.execute({
    sql: `INSERT OR IGNORE INTO game_categories (game_slug,category_slug) VALUES (?, 'subscriptions')`,
    args: [slug],
  });
  for (const [tier, mult] of subTiers) {
    for (const m of subMonths) {
      const base = +(2.35 * mult * m * (1 - Math.min(m, 12) * 0.02)).toFixed(2);
      await db.execute({
        sql: `INSERT INTO products
                (id,slug,game_slug,category_slug,name,image,base_price,
                 delivery_method,delivery_time,region,platform,popular)
              VALUES (?,?,?, 'subscriptions',?,?,?, 'Account Details', 'Instant', 'Global', 'All', ?)
              ON CONFLICT(id) DO UPDATE SET base_price=excluded.base_price`,
        args: [
          `sub-${slug}-${String(tier).toLowerCase()}-${m}`,
          `${String(tier).toLowerCase()}-${m}-month`,
          slug,
          `${name} ${tier} - ${m} Month${m > 1 ? "s" : ""}`,
          "/art/item-pass.png",
          base,
          m === 1 && tier === "Premium" ? 1 : 0,
        ],
      });
    }
  }
}
console.log(`\u2713 ${subBrands.length} subscription brands + ${subBrands.length * 8} plans`);

/* --------------------------- field templates ------------------------ */
const templates = [
  ["top-up", "Package Name", "package_name", "text", 1, 1],
  ["top-up", "Price", "price", "number", 1, 1],
  ["top-up", "Stock", "stock", "number", 1, 1],
  ["top-up", "Region", "region", "dropdown", 1, 1],
  ["top-up", "Platform", "platform", "dropdown", 1, 1],
  ["top-up", "Delivery Method", "delivery_method", "dropdown", 1, 1],
  ["top-up", "Delivery Time", "delivery_time", "text", 1, 1],
  ["top-up", "Login Method", "login_method", "dropdown", 1, 0],
  ["top-up", "UID / Player ID", "uid", "text", 1, 1],
  ["top-up", "Delivery Instructions", "instructions", "textarea", 0, 0],
  ["currency", "Amount", "amount", "text", 1, 1],
  ["currency", "Price", "price", "number", 1, 1],
  ["currency", "Stock", "stock", "number", 1, 1],
  ["currency", "Delivery Method", "delivery_method", "dropdown", 1, 1],
  ["currency", "Delivery Time", "delivery_time", "text", 1, 1],
  ["accounts", "Account Level", "level", "number", 1, 1],
  ["accounts", "Outfits / Skins", "outfits", "number", 0, 1],
  ["accounts", "Tier", "tier", "dropdown", 1, 1],
  ["accounts", "Email Access", "email_access", "switch", 1, 1],
  ["accounts", "Ban History", "ban_history", "switch", 0, 1],
  ["boosting", "Current Rank", "rank_from", "dropdown", 1, 1],
  ["boosting", "Target Rank", "rank_to", "dropdown", 1, 1],
  ["boosting", "ETA", "eta", "text", 1, 1],
  ["items", "Item Name", "item_name", "text", 1, 1],
  ["items", "Delivery Time", "delivery_time", "text", 1, 1],
  ["subscriptions", "Plan", "plan", "dropdown", 1, 1],
  ["subscriptions", "Duration (months)", "months", "number", 1, 1],
  ["subscriptions", "Warranty", "warranty", "text", 0, 1],
];
await db.execute("DELETE FROM field_templates");
for (const [i, t] of templates.entries()) {
  await db.execute({
    sql: `INSERT INTO field_templates
            (id,category_slug,label,field_key,field_type,required,show_frontend,sort_order)
          VALUES (?,?,?,?,?,?,?,?)`,
    args: [nid("fld_"), t[0], t[1], t[2], t[3], t[4], t[5], i],
  });
}
console.log(`✓ ${templates.length} template fields`);

/* ---------------------------- demo accounts ------------------------- */
const hash = await bcrypt.hash("Password123!", 12);

const accounts = [
  { id: "usr_demo_buyer", name: "Aman Verma", email: "buyer@g2x.gg", role: "buyer", seller: 0, balance: 250 },
  { id: "usr_demo_seller", name: "Rohit Singh", email: "seller@g2x.gg", role: "seller", seller: 1, balance: 40 },
  { id: "usr_demo_admin", name: "G2X Admin", email: "admin@g2x.gg", role: "admin", seller: 0, balance: 0 },
];

for (const a of accounts) {
  await db.execute({
    sql: `INSERT INTO users (id,name,email,password_hash,provider,role,is_seller,balance,country)
          VALUES (?,?,?,?,'email',?,?,?,'India')
          ON CONFLICT(email) DO UPDATE SET
            password_hash=excluded.password_hash, role=excluded.role,
            is_seller=excluded.is_seller, balance=excluded.balance`,
    args: [a.id, a.name, a.email, hash, a.role, a.seller, a.balance],
  });
}

await db.execute({
  sql: `INSERT INTO seller_profiles
          (user_id,store_name,slug,description,primary_cat,level,verified,status,
           rating,total_sales,total_orders,commission_pct,available_bal,pending_bal,approved_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
        ON CONFLICT(user_id) DO UPDATE SET status='active', verified=1`,
  args: [
    "usr_demo_seller", "QuickTopup Store", "quicktopup",
    "Fast and reliable top-ups, currency and accounts. Average delivery under 10 minutes.",
    "Top Up", "Top Seller", 1, "active", 98.7, 34520, 1250, 8, 1245.5, 320.75,
  ],
});
console.log("✓ demo accounts (buyer / seller / admin)");

/* ------------------- demo seller offers on real products ------------ */
const subProducts = (await db.execute("SELECT * FROM products WHERE category_slug='subscriptions'")).rows.map((r) => ({
  id: r.id, from: Number(r.base_price), name: r.name,
  deliveryMethod: r.delivery_method, region: r.region, platform: r.platform, category: "subscriptions",
}));
const pickable = [
  ...products.filter((p) => ["top-up", "currency", "items"].includes(p.category)),
  ...subProducts,
];
await db.execute({ sql: "DELETE FROM offers WHERE seller_id = ?", args: ["usr_demo_seller"] });
let made = 0;
for (const p of pickable.slice(0, 30)) {
  await db.execute({
    sql: `INSERT INTO offers
            (id,seller_id,product_id,title,price,old_price,stock,delivery_time,
             delivery_method,region,platform,instructions,status,featured,sold_count)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      nid("off_"), "usr_demo_seller", p.id, p.name,
      +(p.from * 1.04).toFixed(2), +(p.from * 1.25).toFixed(2),
      Math.floor(80 + Math.random() * 400),
      ["5 - 10 min", "10 - 20 min", "5 - 15 min", "Instant"][made % 4],
      p.deliveryMethod, p.region, p.platform,
      "Enter your UID correctly. No refund for a wrong UID.",
      "active", made < 4 ? 1 : 0, Math.floor(Math.random() * 400),
    ],
  });
  made++;
}

/* competing sellers so the buyer offer table is populated */
const rivals = [
  ["usr_rival_1", "PokeStore", "pokestore", 99.6],
  ["usr_rival_2", "GameXpress", "gamexpress", 98.7],
  ["usr_rival_3", "CoinMaster", "coinmaster", 99.3],
  ["usr_rival_4", "FastPoke", "fastpoke", 98.5],
];
for (const [uid, store, slug, rating] of rivals) {
  await db.execute({
    sql: `INSERT INTO users (id,name,email,password_hash,provider,role,is_seller,country)
          VALUES (?,?,?,?,'email','seller',1,'India')
          ON CONFLICT(email) DO NOTHING`,
    args: [uid, store, `${slug}@g2x.gg`, hash],
  });
  await db.execute({
    sql: `INSERT INTO seller_profiles
            (user_id,store_name,slug,level,verified,status,rating,total_orders,approved_at)
          VALUES (?,?,?,'Verified Seller',1,'active',?,?,datetime('now'))
          ON CONFLICT(user_id) DO UPDATE SET status='active'`,
    args: [uid, store, slug, rating, Math.floor(2000 + Math.random() * 9000)],
  });
  await db.execute({ sql: "DELETE FROM offers WHERE seller_id=?", args: [uid] });
  for (const p of pickable) {
    if (Math.random() > 0.72) continue;
    await db.execute({
      sql: `INSERT INTO offers
              (id,seller_id,product_id,title,price,stock,delivery_time,delivery_method,
               region,platform,status,sold_count)
            VALUES (?,?,?,?,?,?,?,?,?,?,'active',?)`,
      args: [
        nid("off_"), uid, p.id, p.name,
        +(p.from * (1 + Math.random() * 0.3)).toFixed(2),
        Math.floor(40 + Math.random() * 300),
        ["5 - 10 min", "10 - 20 min", "15 - 30 min", "5 - 15 min"][Math.floor(Math.random() * 4)],
        p.deliveryMethod, p.region, p.platform,
        Math.floor(Math.random() * 900),
      ],
    });
  }
}

/* account + boosting listings */
await db.execute("DELETE FROM listings");
const accGames = games.filter((g) => g.categories.includes("accounts"));
const sellerIds = ["usr_demo_seller", ...rivals.map((r) => r[0])];
const tiers = ["Low End", "Mid End", "High End"];
for (const g of accGames) {
  for (let i = 0; i < 6; i++) {
    await db.execute({
      sql: `INSERT INTO listings
              (id,seller_id,game_slug,category_slug,title,description,image,price,stock,
               tier,level,outfits,delivery_time,status)
            VALUES (?,?,?,'accounts',?,?,?,?,1,?,?,?,'5 - 30 min','active')`,
      args: [
        nid("lst_"), sellerIds[i % sellerIds.length], g.slug,
        `${g.name} Account`,
        "Full ownership transfer with original email access. Clean ban history.",
        g.logo.startsWith("/") ? g.logo : "/art/bgmi.png",
        +(9.99 + Math.random() * 60).toFixed(2),
        tiers[i % 3], 40 + Math.floor(Math.random() * 45), 2 + Math.floor(Math.random() * 20),
      ],
    });
  }
}
const boosts = [
  ["valorant", "Rank Boost", "Iron to Radiant, any division", 8.99, "1 - 3 days"],
  ["bgmi", "Tier Push", "Bronze to Conqueror", 6.49, "2 - 4 days"],
  ["league-of-legends", "Division Boost", "Solo/Duo and Flex queue", 11.99, "1 - 3 days"],
  ["apex-legends", "Rank Boost", "Rookie to Predator", 12.99, "2 - 5 days"],
  ["genshin-impact", "Abyss Clear", "Floor 12 full stars", 9.99, "1 - 2 days"],
  ["call-of-duty-mobile", "Rank Boost", "Up to Legendary", 7.99, "2 - 4 days"],
  ["clash-of-clans", "Base Upgrade", "TH upgrade and war stars", 5.99, "3 - 7 days"],
];
for (const [i, b] of boosts.entries()) {
  const g = games.find((x) => x.slug === b[0]);
  await db.execute({
    sql: `INSERT INTO listings
            (id,seller_id,game_slug,category_slug,title,description,image,price,stock,
             delivery_time,status)
          VALUES (?,?,?,'boosting',?,?,?,?,99,?,'active')`,
    args: [
      nid("lst_"), sellerIds[i % sellerIds.length], b[0], b[1], b[2],
      g && g.logo.startsWith("/") ? g.logo : "/art/apex.png", b[3], b[4],
    ],
  });
}
console.log("✓ offers + listings seeded");

/* reviews for the demo seller */
const reviewers = ["Amit Verma", "Neha Sharma", "Karan Mehta", "Arjun Patel", "Manish Yadav"];
await db.execute({ sql: "DELETE FROM reviews WHERE seller_id=?", args: ["usr_demo_seller"] });
for (const [i, r] of reviewers.entries()) {
  await db.execute({
    sql: `INSERT INTO reviews (id,buyer_id,seller_id,stars,body,status)
          VALUES (?,?,?,?,?,'published')`,
    args: [
      nid("rev_"), "usr_demo_buyer", "usr_demo_seller", i === 4 ? 4 : 5,
      [
        "Super fast delivery and 100% legit. Got my UC within minutes!",
        "Best price on the site and the seller replied instantly.",
        "Very reliable, I order every week. Highly recommended.",
        "Smooth transaction, coins arrived in under 10 minutes.",
        "Good seller, delivery took a bit longer than stated but all fine.",
      ][i],
    ],
  });
}

await db.execute({
  sql: `INSERT INTO settings (key,value) VALUES ('commission_default','8')
        ON CONFLICT(key) DO UPDATE SET value='8'`,
});

console.log(`
──────────────────────────────────────────────
 G2X.GG seed complete ✅

 Demo logins (password for all: Password123!)
   Buyer   buyer@g2x.gg
   Seller  seller@g2x.gg
   Admin   admin@g2x.gg
──────────────────────────────────────────────
`);
process.exit(0);
