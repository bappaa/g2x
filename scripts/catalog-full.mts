/**
 * G2X.GG — full client-supplied catalog.
 * Adds every game the client listed under Currency / Top Up / Items / Accounts.
 * Idempotent: re-running only upserts. Run with:  npm run db:catalog
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });
import { createClient } from "@libsql/client";
import { makeDb } from "./db-url.mjs";

const db = makeDb(createClient, { quiet: true });

const nid = (p = "") => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\+/g, " plus ")
    .replace(/:/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/* ------------------------------------------------------------------ */
/* The client's list, verbatim, grouped by category.                   */
/* ------------------------------------------------------------------ */

const CURRENCY = [
  "Old School RuneScape Gold", "RuneScape 3 Gold", "World of Warcraft Gold",
  "WoW Classic Era Gold", "WoW Mists of Pandaria Gold", "Lost Ark Gold",
  "Warframe Platinum", "New World Gold", "Pets Go Diamonds", "Fisch C$",
  "Pet Simulator 99 Gems", "Toilet Tower Defense Gems", "Blade Ball Tokens",
  "Anime Defenders Gems", "Anime Defenders Trait Crystal", "Grow a Garden Sheckles",
  "Creatures of Sonaria", "Tap Simulator", "Fix It Up", "Dragon Adventures",
  "Royale High", "Escape Tsunami For Brainrots", "Growtopia Locks",
  "Grow a Garden Tokens", "Grow a Garden 2 Sheckles", "Death Ball Gems",
];

const TOPUP = [
  "Fortnite V-Bucks", "FC26 Points", "Spotify", "Roblox", "Sniper Duels",
  "BloxStrike", "Bite by Night", "99 Nights in the Forest", "Pokemon Go",
  "Crunchyroll", "Amazon", "ChatGPT", "Forza Horizon 6", "Run a Restaurant",
];

const ITEMS = [
  "Old School RuneScape", "RuneScape 3", "Roblox", "Adopt Me", "Anime Defenders",
  "Blade Ball Items", "Blox Fruits Items", "Murder Mystery 2", "Pets Go",
  "Pet Simulator 99", "Roblox Limiteds", "Roblox Rivals", "Roblox Anime Reborn",
  "Bubble Gum Simulator INFINITY", "Grow a Garden", "Dead Rails", "Anime Last Stand",
  "Hunty Zombie", "Garden Tower Defense", "TYPE://SOUL", "Ink Game",
  "All Star Tower Defense X", "Build a Zoo", "Plants vs Brainrots", "Anime Eternal",
  "Fish It!", "Steal a Brainrot", "Raise Animals", "Creatures of Sonaria", "The Forge",
  "Attack on Titan Revolution", "Murderers VS Sheriffs DUELS",
  "Anime Fighting Simulator: Endless", "Volleyball Legends", "Jujutsu Infinite",
  "Jujutsu: Zero", "Bee Swarm Simulator", "Hypershot", "Tap Simulator", "Da Hood",
  "Escape Tsunami For Brainrots", "Baddies", "Devil Hunter", "Break a Lucky Block",
  "Spongebob Tower Defense", "Escape Waves For Lucky Blocks", "Catch And Tame",
  "Spin A Baddie", "Anime Paradox", "Survive Lava for Brainrots", "Case Paradise",
  "Abyss", "Knockout", "Garden Horizons", "Sailor Piece", "Bizarre Lineage",
  "Bloodlines", "Anime Tactical Simulator", "War Tycoon", "Swing Obby for Brainrots",
  "Be a Lucky Block", "Re:Rangers X", "Flee the Facility", "KAIZEN", "Sol's RNG",
  "King Legacy", "bridger: WESTERN", "Sorcerer Tower Defense", "A Universal Time",
  "Summon Heroes", "Anime Card Clash", "Universal Tower Defense", "Kick a Lucky Block",
  "Slime RNG", "Anime Apocalypse", "Noob Tower Defense", "Anime Warriors 3",
  "BloxStrike", "Wizard Alchemy", "Sniper Arena", "Mini War", "Build a Ring Farm",
  "Broken Blade", "+1 Speed Keyboard Escape", "Grow a Garden 2", "Anime Squadron",
  "VV: Ultimatum", "Anime Astral Simulator", "Evomon", "Storage Hunters",
  "Spin a Soccer Card", "Gakuran", "Anime Expeditions", "Mine a Mountain",
  "Haze Seas", "RNG Heroes", "Anime Card Farm", "Drag Drive Simulator",
  "Shindo Life", "Capybaras vs Plants", "San Diego Border Roleplay",
  "Roll Anime to Fight", "Steal an Egg", "Deepwoken", "BedWars", "Anime Origins",
  "Fight in a School", "Knife Duels", "Iron Soul: Dungeon", "Murder Duels",
  "Greedy Growers", "Tower Defense Simulator", "Muscle Legends", "Fish an Anime RNG",
  "Grand Blue",
];

const ACCOUNTS = [
  "League of Legends Accounts", "Adopt Me", "Anime Defenders", "Valorant", "Roblox",
  "Clash of Clans", "Brawl Stars", "Fisch", "Overwatch 2", "Anime Vanguards",
  "Call of Duty", "Fortnite", "Rainbow Six Siege", "Grand Theft Auto 5", "Dead Rails",
  "Grow a Garden", "All Star Tower Defense X", "Steal a Brainrot", "Blox Fruits",
  "The Forge", "Jailbreak", "BlockSpin", "Bee Swarm Simulator", "Sailor Piece",
  "King Legacy", "Roblox Rivals", "bridger: WESTERN", "Bloodlines (Accounts)",
  "Volleyball Legends", "Welcome to Bloxburg", "Attack on Titan Revolution",
  "Grow a Garden 2", "Murder Mystery 2", "Driving Empire", "Steal an Egg",
  "Greenville", "Dungeon Quest Reborn",
];

const GROUPS: [string, string[]][] = [
  ["currency", CURRENCY],
  ["top-up", TOPUP],
  ["items", ITEMS],
  ["accounts", ACCOUNTS],
];

/* Map well-known names to real brand icons; everything else gets generated art. */
const BRAND: Record<string, string> = {
  spotify: "spotify", roblox: "roblox", "pokemon-go": "/art/pokemongo.png",
  crunchyroll: "crunchyroll", amazon: "prime", chatgpt: "openai",
  fortnite: "epicgames", valorant: "valorant", "call-of-duty": "codm",
  "grand-theft-auto-5": "rockstargames", "league-of-legends-accounts": "leagueoflegends",
};

const ART = [
  "/art/coins.png", "/art/diamond.png", "/art/item-crate.png", "/art/item-pass.png",
  "/art/robux.png", "/art/uc.png", "/art/vp.png", "/art/cash.png", "/art/8ball.png",
  "/art/apex.png", "/art/bgmi.png", "/art/coc.png", "/art/codm.png", "/art/freefire.png",
  "/art/genshin.png", "/art/gta.png", "/art/lol.png", "/art/pokemongo.png",
];
const artFor = (slug: string) => {
  let h = 0;
  for (const c of slug) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ART[h % ART.length];
};

/* Per-category denomination presets so every game has real, buyable products. */
const PRESETS: Record<string, { name: string; price: number }[]> = {
  currency: [
    { name: "10M", price: 1.49 }, { name: "50M", price: 6.49 },
    { name: "100M", price: 11.99 }, { name: "250M", price: 27.99 },
    { name: "500M", price: 52.99 }, { name: "1B", price: 99.99 },
  ],
  "top-up": [
    { name: "Starter Pack", price: 0.99 }, { name: "Small Pack", price: 4.99 },
    { name: "Medium Pack", price: 9.99 }, { name: "Large Pack", price: 19.99 },
    { name: "Mega Pack", price: 49.99 }, { name: "Ultimate Pack", price: 99.99 },
  ],
  items: [
    { name: "Common Bundle", price: 1.99 }, { name: "Rare Bundle", price: 5.99 },
    { name: "Epic Bundle", price: 14.99 }, { name: "Legendary Bundle", price: 34.99 },
    { name: "Mythic Bundle", price: 74.99 },
  ],
  accounts: [],
};

const DELIVERY: Record<string, [string, string]> = {
  currency: ["In-game Trade", "5 - 30 min"],
  "top-up": ["Player ID Top-up", "5 - 30 min"],
  items: ["In-game Trade", "10 - 60 min"],
  accounts: ["Account Details", "Instant"],
};

/* ------------------------------------------------------------------ */

let gameCount = 0;
let productCount = 0;
let order = 200;

for (const [cat, names] of GROUPS) {
  // make sure the category exists & is active
  await db.execute({
    sql: `UPDATE categories SET status='active' WHERE slug=?`,
    args: [cat],
  });

  for (const name of names) {
    const slug = slugify(name);
    if (!slug) continue;

    const logo = BRAND[slug] ?? artFor(slug);

    await db.execute({
      sql: `INSERT INTO games (slug,name,logo,accent,status,sort_order)
            VALUES (?,?,?,?, 'active', ?)
            ON CONFLICT(slug) DO UPDATE SET name=excluded.name, status='active'`,
      args: [slug, name, logo, "#8b3dff", order++],
    });
    gameCount++;

    await db.execute({
      sql: `INSERT OR IGNORE INTO game_categories (game_slug,category_slug) VALUES (?,?)`,
      args: [slug, cat],
    });

    const [method, time] = DELIVERY[cat];
    for (const p of PRESETS[cat]) {
      const pid = `p-${slug}-${slugify(p.name)}`;
      await db.execute({
        sql: `INSERT INTO products
                (id,slug,game_slug,category_slug,name,image,base_price,
                 delivery_method,delivery_time,region,platform,popular,status)
              VALUES (?,?,?,?,?,?,?,?,?, 'Global', 'All', ?, 'active')
              ON CONFLICT(id) DO UPDATE SET
                name=excluded.name, base_price=excluded.base_price, status='active'`,
        args: [
          pid, slugify(p.name), slug, cat, `${name} — ${p.name}`,
          artFor(slug + p.name), p.price, method, time,
          p.price >= 9.99 && p.price <= 19.99 ? 1 : 0,
        ],
      });
      productCount++;
    }
  }
  console.log(`✓ ${cat.padEnd(9)} ${names.length} games`);
}

/* Give the demo + rival sellers offers on a slice of the new products so the
   comparison table is never empty on the freshly added games. */
const sellers = ["usr_demo_seller", "usr_rival_1", "usr_rival_2", "usr_rival_3", "usr_rival_4"];
const fresh = (
  await db.execute(
    `SELECT id, base_price FROM products
      WHERE status='active' AND id LIKE 'p-%'
      ORDER BY RANDOM() LIMIT 260`
  )
).rows as unknown as { id: string; base_price: number }[];

let offerCount = 0;
for (const p of fresh) {
  const n = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const sid = sellers[(i + p.id.length) % sellers.length];
    const price = +(Number(p.base_price) * (0.86 + Math.random() * 0.22)).toFixed(2);
    try {
      await db.execute({
        sql: `INSERT INTO offers (id,seller_id,product_id,price,stock,delivery_time,
                    delivery_method,region,platform,status)
              VALUES (?,?,?,?,?,?,?, 'Global', 'All', 'active')`,
        args: [
          nid("off_"), sid, p.id, price, 50 + Math.floor(Math.random() * 900),
          ["Instant", "5 - 30 min", "10 - 60 min"][i % 3], "Instant Code",
        ],
      });
      offerCount++;
    } catch {
      /* seller already has an offer on this product */
    }
  }
}

console.log(`\n✓ ${gameCount} games, ${productCount} products, ${offerCount} offers`);
console.log("✓ full client catalog loaded");
