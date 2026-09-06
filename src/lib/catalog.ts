/* ------------------------------------------------------------------
   G2X.GG catalog model
   Admin creates: Game -> Category -> Product (denomination) + template
   Sellers create: Offers (price / stock / delivery) against a Product
------------------------------------------------------------------- */

export type Game = {
  slug: string;
  name: string;
  logo: string; // brand icon key or /art path
  art?: string;
  categories: CategorySlug[];
  accent: string;
};

export type CategorySlug =
  | "top-up"
  | "currency"
  | "accounts"
  | "items"
  | "boosting"
  | "subscriptions";

export const categories: {
  slug: CategorySlug;
  name: string;
  blurb: string;
  icon: string;
}[] = [
  { slug: "top-up", name: "Top Up", blurb: "Instant in-game top up", icon: "zap" },
  { slug: "currency", name: "Currency", blurb: "Coins, cash & gems", icon: "coins" },
  { slug: "accounts", name: "Accounts", blurb: "Verified game accounts", icon: "user" },
  { slug: "items", name: "Items", blurb: "Skins, passes & crates", icon: "package" },
  { slug: "boosting", name: "Boosting", blurb: "Rank up faster", icon: "rocket" },
  { slug: "subscriptions", name: "Subscriptions", blurb: "Premium memberships", icon: "crown" },
];

export const games: Game[] = [
  {
    slug: "pokemon-go",
    name: "Pokemon Go",
    logo: "/art/pokemongo.png",
    accent: "#f2c744",
    categories: ["top-up", "currency", "items", "accounts"],
  },
  {
    slug: "8-ball-pool",
    name: "8 Ball Pool",
    logo: "/art/8ball.png",
    accent: "#f5b301",
    categories: ["currency", "accounts", "items", "top-up"],
  },
  {
    slug: "bgmi",
    name: "BGMI",
    logo: "/art/bgmi.png",
    accent: "#e0a53a",
    categories: ["top-up", "accounts", "boosting", "items"],
  },
  {
    slug: "free-fire",
    name: "Free Fire",
    logo: "/art/freefire.png",
    accent: "#ff6a2b",
    categories: ["top-up", "currency", "accounts", "items"],
  },
  {
    slug: "valorant",
    name: "Valorant",
    logo: "valorant",
    accent: "#fa4454",
    categories: ["top-up", "accounts", "boosting", "items"],
  },
  {
    slug: "gta-v",
    name: "GTA V",
    logo: "/art/gta.png",
    accent: "#79b027",
    categories: ["currency", "accounts", "items"],
  },
  {
    slug: "roblox",
    name: "Roblox",
    logo: "roblox",
    accent: "#c8cbd0",
    categories: ["currency", "top-up", "accounts"],
  },
  {
    slug: "genshin-impact",
    name: "Genshin Impact",
    logo: "/art/genshin.png",
    accent: "#6ec7ff",
    categories: ["top-up", "accounts", "boosting"],
  },
  {
    slug: "clash-of-clans",
    name: "Clash of Clans",
    logo: "/art/coc.png",
    accent: "#ffb02e",
    categories: ["accounts", "top-up", "boosting"],
  },
  {
    slug: "call-of-duty-mobile",
    name: "Call of Duty Mobile",
    logo: "/art/codm.png",
    accent: "#8fa3b0",
    categories: ["top-up", "accounts", "boosting"],
  },
  {
    slug: "league-of-legends",
    name: "League of Legends",
    logo: "/art/lol.png",
    accent: "#c8963c",
    categories: ["boosting", "accounts", "top-up"],
  },
  {
    slug: "apex-legends",
    name: "Apex Legends",
    logo: "/art/apex.png",
    accent: "#da2f47",
    categories: ["boosting", "accounts", "top-up"],
  },
  {
    slug: "steam",
    name: "Steam",
    logo: "steam",
    accent: "#66c0f4",
    categories: ["top-up"],
  },
  {
    slug: "playstation",
    name: "PlayStation",
    logo: "playstation",
    accent: "#0070d1",
    categories: ["top-up"],
  },
];

export const gameBySlug = (s: string) => games.find((g) => g.slug === s);

/* ---------------------------- Products --------------------------- */

export type Product = {
  id: string;
  slug: string;
  game: string; // game slug
  category: CategorySlug;
  name: string;
  image: string;
  from: number;
  popular?: boolean;
  deliveryMethod: string;
  deliveryTime: string;
  region: string;
  platform: string;
  meta?: Record<string, string>;
};

const P = (p: Product) => p;

export const products: Product[] = [
  /* -------- Pokemon Go : Top Up / PokeCoins -------- */
  P({ id: "pg-100", slug: "100-pokecoins", game: "pokemon-go", category: "top-up", name: "100 PokeCoins", image: "/art/coins.png", from: 0.79, deliveryMethod: "UID Login", deliveryTime: "5 – 30 min", region: "Global", platform: "Android / iOS" }),
  P({ id: "pg-550", slug: "550-pokecoins", game: "pokemon-go", category: "top-up", name: "550 PokeCoins", image: "/art/coins.png", from: 2.49, popular: true, deliveryMethod: "UID Login", deliveryTime: "5 – 30 min", region: "Global", platform: "Android / iOS" }),
  P({ id: "pg-1200", slug: "1200-pokecoins", game: "pokemon-go", category: "top-up", name: "1,200 PokeCoins", image: "/art/coins.png", from: 4.99, deliveryMethod: "UID Login", deliveryTime: "5 – 30 min", region: "Global", platform: "Android / iOS" }),
  P({ id: "pg-2500", slug: "2500-pokecoins", game: "pokemon-go", category: "top-up", name: "2,500 PokeCoins", image: "/art/coins.png", from: 9.49, deliveryMethod: "UID Login", deliveryTime: "5 – 30 min", region: "Global", platform: "Android / iOS" }),
  P({ id: "pg-5200", slug: "5200-pokecoins", game: "pokemon-go", category: "top-up", name: "5,200 PokeCoins", image: "/art/coins.png", from: 16.49, deliveryMethod: "UID Login", deliveryTime: "5 – 30 min", region: "Global", platform: "Android / iOS" }),
  P({ id: "pg-14500", slug: "14500-pokecoins", game: "pokemon-go", category: "top-up", name: "14,500 PokeCoins", image: "/art/coins.png", from: 49.99, deliveryMethod: "UID Login", deliveryTime: "5 – 30 min", region: "Global", platform: "Android / iOS" }),
  P({ id: "pg-raid", slug: "remote-raid-pass", game: "pokemon-go", category: "items", name: "Remote Raid Pass", image: "/art/item-pass.png", from: 0.99, deliveryMethod: "UID Login", deliveryTime: "10 – 40 min", region: "Global", platform: "Android / iOS" }),
  P({ id: "pg-battle", slug: "premium-battle-pass", game: "pokemon-go", category: "items", name: "Premium Battle Pass", image: "/art/item-pass.png", from: 1.99, deliveryMethod: "UID Login", deliveryTime: "10 – 40 min", region: "Global", platform: "Android / iOS" }),
  P({ id: "pg-egg", slug: "egg-incubator", game: "pokemon-go", category: "items", name: "Egg Incubator", image: "/art/item-crate.png", from: 0.79, deliveryMethod: "UID Login", deliveryTime: "10 – 40 min", region: "Global", platform: "Android / iOS" }),

  /* -------- 8 Ball Pool : Currency -------- */
  P({ id: "8b-1m", slug: "1m-coins", game: "8-ball-pool", category: "currency", name: "1M Coins", image: "/art/coins.png", from: 2.99, deliveryMethod: "In-game ID", deliveryTime: "5 – 30 min", region: "Global", platform: "Android / iOS" }),
  P({ id: "8b-10m", slug: "10m-coins", game: "8-ball-pool", category: "currency", name: "10M Coins", image: "/art/coins.png", from: 24.99, popular: true, deliveryMethod: "In-game ID", deliveryTime: "5 – 30 min", region: "Global", platform: "Android / iOS" }),
  P({ id: "8b-50m", slug: "50m-coins", game: "8-ball-pool", category: "currency", name: "50M Coins", image: "/art/coins.png", from: 109.99, deliveryMethod: "In-game ID", deliveryTime: "5 – 30 min", region: "Global", platform: "Android / iOS" }),
  P({ id: "8b-100m", slug: "100m-coins", game: "8-ball-pool", category: "currency", name: "100M Coins", image: "/art/coins.png", from: 199.99, deliveryMethod: "In-game ID", deliveryTime: "5 – 30 min", region: "Global", platform: "Android / iOS" }),
  P({ id: "8b-500m", slug: "500m-coins", game: "8-ball-pool", category: "currency", name: "500M Coins", image: "/art/coins.png", from: 899.99, deliveryMethod: "In-game ID", deliveryTime: "10 – 40 min", region: "Global", platform: "Android / iOS" }),
  P({ id: "8b-1b", slug: "1b-coins", game: "8-ball-pool", category: "currency", name: "1B Coins", image: "/art/coins.png", from: 1699.99, deliveryMethod: "In-game ID", deliveryTime: "10 – 40 min", region: "Global", platform: "Android / iOS" }),
  P({ id: "8b-cash", slug: "8bp-cash", game: "8-ball-pool", category: "currency", name: "Cash", image: "/art/cash.png", from: 3.49, deliveryMethod: "In-game ID", deliveryTime: "5 – 30 min", region: "Global", platform: "Android / iOS" }),
  P({ id: "8b-gold", slug: "golden-shot", game: "8-ball-pool", category: "items", name: "Golden Shot", image: "/art/item-crate.png", from: 1.49, deliveryMethod: "In-game ID", deliveryTime: "5 – 30 min", region: "Global", platform: "Android / iOS" }),
  P({ id: "8b-pass", slug: "pool-pass", game: "8-ball-pool", category: "items", name: "Pool Pass", image: "/art/item-pass.png", from: 4.99, deliveryMethod: "In-game ID", deliveryTime: "5 – 30 min", region: "Global", platform: "Android / iOS" }),
  P({ id: "8b-spin", slug: "spin-and-win", game: "8-ball-pool", category: "items", name: "Spin & Win", image: "/art/item-crate.png", from: 0.99, deliveryMethod: "In-game ID", deliveryTime: "5 – 30 min", region: "Global", platform: "Android / iOS" }),

  /* -------- BGMI : Top Up (UC) -------- */
  P({ id: "bg-60", slug: "60-uc", game: "bgmi", category: "top-up", name: "60 UC", image: "/art/uc.png", from: 0.49, deliveryMethod: "UID Top Up", deliveryTime: "5 min – 1 hour", region: "India", platform: "Android / iOS" }),
  P({ id: "bg-325", slug: "325-uc", game: "bgmi", category: "top-up", name: "325 UC", image: "/art/uc.png", from: 1.99, deliveryMethod: "UID Top Up", deliveryTime: "5 min – 1 hour", region: "India", platform: "Android / iOS" }),
  P({ id: "bg-660", slug: "660-uc", game: "bgmi", category: "top-up", name: "660 UC", image: "/art/uc.png", from: 3.99, popular: true, deliveryMethod: "UID Top Up", deliveryTime: "5 min – 1 hour", region: "India", platform: "Android / iOS" }),
  P({ id: "bg-1800", slug: "1800-uc", game: "bgmi", category: "top-up", name: "1800 UC", image: "/art/uc.png", from: 9.99, deliveryMethod: "UID Top Up", deliveryTime: "5 min – 1 hour", region: "India", platform: "Android / iOS" }),
  P({ id: "bg-3850", slug: "3850-uc", game: "bgmi", category: "top-up", name: "3850 UC", image: "/art/uc.png", from: 19.99, deliveryMethod: "UID Top Up", deliveryTime: "5 min – 1 hour", region: "India", platform: "Android / iOS" }),
  P({ id: "bg-8100", slug: "8100-uc", game: "bgmi", category: "top-up", name: "8100 UC", image: "/art/uc.png", from: 39.99, deliveryMethod: "UID Top Up", deliveryTime: "5 min – 1 hour", region: "India", platform: "Android / iOS" }),

  /* -------- Free Fire -------- */
  P({ id: "ff-100", slug: "100-diamonds", game: "free-fire", category: "top-up", name: "100 Diamonds", image: "/art/diamond.png", from: 0.89, deliveryMethod: "UID Top Up", deliveryTime: "5 – 30 min", region: "Global", platform: "Android / iOS" }),
  P({ id: "ff-310", slug: "310-diamonds", game: "free-fire", category: "top-up", name: "310 Diamonds", image: "/art/diamond.png", from: 2.59, popular: true, deliveryMethod: "UID Top Up", deliveryTime: "5 – 30 min", region: "Global", platform: "Android / iOS" }),
  P({ id: "ff-1060", slug: "1060-diamonds", game: "free-fire", category: "top-up", name: "1060 Diamonds", image: "/art/diamond.png", from: 8.49, deliveryMethod: "UID Top Up", deliveryTime: "5 – 30 min", region: "Global", platform: "Android / iOS" }),
  P({ id: "ff-2180", slug: "2180-diamonds", game: "free-fire", category: "top-up", name: "2180 Diamonds", image: "/art/diamond.png", from: 16.99, deliveryMethod: "UID Top Up", deliveryTime: "5 – 30 min", region: "Global", platform: "Android / iOS" }),

  /* -------- Valorant -------- */
  P({ id: "vp-475", slug: "475-vp", game: "valorant", category: "top-up", name: "475 VP", image: "/art/vp.png", from: 4.49, deliveryMethod: "Account Login", deliveryTime: "10 – 40 min", region: "Global", platform: "PC" }),
  P({ id: "vp-1000", slug: "1000-vp", game: "valorant", category: "top-up", name: "1000 VP", image: "/art/vp.png", from: 9.49, popular: true, deliveryMethod: "Account Login", deliveryTime: "10 – 40 min", region: "Global", platform: "PC" }),
  P({ id: "vp-2050", slug: "2050-vp", game: "valorant", category: "top-up", name: "2050 VP", image: "/art/vp.png", from: 18.99, deliveryMethod: "Account Login", deliveryTime: "10 – 40 min", region: "Global", platform: "PC" }),

  /* -------- Roblox -------- */
  P({ id: "rb-400", slug: "400-robux", game: "roblox", category: "currency", name: "400 Robux", image: "/art/robux.png", from: 4.29, deliveryMethod: "Gamepass", deliveryTime: "5 – 30 min", region: "Global", platform: "All" }),
  P({ id: "rb-800", slug: "800-robux", game: "roblox", category: "currency", name: "800 Robux", image: "/art/robux.png", from: 8.29, popular: true, deliveryMethod: "Gamepass", deliveryTime: "5 – 30 min", region: "Global", platform: "All" }),
  P({ id: "rb-1700", slug: "1700-robux", game: "roblox", category: "currency", name: "1700 Robux", image: "/art/robux.png", from: 17.49, deliveryMethod: "Gamepass", deliveryTime: "5 – 30 min", region: "Global", platform: "All" }),

  /* -------- GTA V -------- */
  P({ id: "gta-1m", slug: "1m-gta-cash", game: "gta-v", category: "currency", name: "1M GTA Cash", image: "/art/cash.png", from: 3.99, popular: true, deliveryMethod: "In-game Drop", deliveryTime: "15 – 60 min", region: "Global", platform: "PC" }),
  P({ id: "gta-10m", slug: "10m-gta-cash", game: "gta-v", category: "currency", name: "10M GTA Cash", image: "/art/cash.png", from: 24.99, deliveryMethod: "In-game Drop", deliveryTime: "15 – 60 min", region: "Global", platform: "PC" }),

  /* -------- Steam / PlayStation wallets -------- */
  P({ id: "st-10", slug: "steam-wallet-10", game: "steam", category: "top-up", name: "Steam Wallet $10", image: "/art/wallet.png", from: 10.4, deliveryMethod: "Code", deliveryTime: "Instant", region: "Global", platform: "PC" }),
  P({ id: "st-25", slug: "steam-wallet-25", game: "steam", category: "top-up", name: "Steam Wallet $25", image: "/art/wallet.png", from: 25.9, popular: true, deliveryMethod: "Code", deliveryTime: "Instant", region: "Global", platform: "PC" }),
  P({ id: "ps-25", slug: "psn-25", game: "playstation", category: "top-up", name: "PSN Card $25", image: "/art/wallet.png", from: 25.5, deliveryMethod: "Code", deliveryTime: "Instant", region: "US", platform: "PS4 / PS5" }),
];

export const productsOf = (game: string, category?: CategorySlug) =>
  products.filter((p) => p.game === game && (!category || p.category === category));

export const findProduct = (game: string, slug: string) =>
  products.find((p) => p.game === game && p.slug === slug);

/* ----------------------------- Offers ---------------------------- */

export type Offer = {
  id: string;
  seller: string;
  sellerLogo: string;
  price: number;
  stock: number;
  delivery: string;
  rating: number;
  reviews: string;
  badge?: "Top Seller" | "Verified" | "Recommended";
};

const sellersPool = [
  { seller: "PokeStore", rating: 99.6, reviews: "12.4K", badge: "Top Seller" as const },
  { seller: "PokeMaster", rating: 98.9, reviews: "8.7K", badge: "Verified" as const },
  { seller: "GoCoins Store", rating: 99.2, reviews: "9.1K", badge: "Recommended" as const },
  { seller: "FastPoke", rating: 98.5, reviews: "6.2K" },
  { seller: "Legendary Store", rating: 97.8, reviews: "4.6K" },
  { seller: "CoinMaster", rating: 99.3, reviews: "15.2K", badge: "Top Seller" as const },
  { seller: "PoolStore", rating: 98.8, reviews: "9.1K" },
  { seller: "8BP King", rating: 99.1, reviews: "7.8K", badge: "Verified" as const },
  { seller: "Pro Coins", rating: 98.6, reviews: "5.3K" },
  { seller: "The Pool Shop", rating: 97.9, reviews: "4.2K" },
  { seller: "QuickTopup", rating: 98.1, reviews: "3.9K" },
  { seller: "GameXpress", rating: 98.7, reviews: "11.3K", badge: "Recommended" as const },
];

/* deterministic pseudo-random so SSR & client match */
function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function offersFor(product: Product, count = 5): Offer[] {
  const rnd = seeded(product.id);
  const picked = [...sellersPool].sort(() => rnd() - 0.5).slice(0, count);
  return picked
    .map((s, i) => ({
      id: `${product.id}-o${i}`,
      seller: s.seller,
      sellerLogo: s.seller.slice(0, 2).toUpperCase(),
      price: +(product.from * (1 + i * 0.045 + rnd() * 0.05)).toFixed(2),
      stock: Math.floor(50 + rnd() * 250),
      delivery: ["5 – 10 min", "10 – 20 min", "5 – 15 min", "15 – 30 min", "Instant"][
        Math.floor(rnd() * 5)
      ],
      rating: s.rating,
      reviews: s.reviews,
      badge: s.badge,
    }))
    .sort((a, b) => a.price - b.price);
}

/* --------------------------- Accounts ---------------------------- */

export type AccountListing = {
  id: string;
  game: string;
  title: string;
  level: number;
  outfits: number;
  tier: "Low End" | "Mid End" | "High End";
  price: number;
  seller: string;
  rating: number;
  image: string;
  popular?: boolean;
};

const accTiers: AccountListing["tier"][] = ["Low End", "Mid End", "High End"];

export const accountListings: AccountListing[] = games
  .filter((g) => g.categories.includes("accounts"))
  .flatMap((g, gi) =>
    Array.from({ length: 6 }).map((_, i) => {
      const rnd = seeded(g.slug + i)();
      return {
        id: `${g.slug}-acc-${i}`,
        game: g.slug,
        title: `${g.name} Account`,
        level: 40 + Math.floor(rnd * 45),
        outfits: 2 + Math.floor(rnd * 20),
        tier: accTiers[i % 3],
        price: +(9.99 + rnd * 60).toFixed(2),
        seller: sellersPool[(gi + i) % sellersPool.length].seller,
        rating: +(96 + rnd * 3.8).toFixed(0),
        image: g.logo.startsWith("/") ? g.logo : "/art/bgmi.png",
        popular: i === 1,
      };
    })
  );

/* ------------------------- Subscriptions ------------------------- */

export type SubPlan = {
  id: string;
  brand: string;
  icon: string;
  plan: string;
  months: 1 | 3 | 6 | 12;
  price: number;
  seller: string;
  rating: number;
  popular?: boolean;
};

export const subscriptionBrands = [
  { name: "Netflix", icon: "netflix" },
  { name: "Spotify", icon: "spotify" },
  { name: "Disney+", icon: "disneyplus" },
  { name: "Amazon Prime", icon: "prime" },
  { name: "YouTube Premium", icon: "youtube" },
  { name: "Crunchyroll", icon: "crunchyroll" },
  { name: "Discord Nitro", icon: "discord" },
  { name: "Apple Music", icon: "applemusic" },
  { name: "Xbox Game Pass", icon: "xbox" },
];

export const subPlans: SubPlan[] = subscriptionBrands.flatMap((b, bi) =>
  ([1, 3, 6, 12] as const).flatMap((m) =>
    ["Premium", "Standard"].map((tier, ti) => {
      const rnd = seeded(b.name + m + ti)();
      return {
        id: `${b.name}-${tier}-${m}`.toLowerCase().replace(/\s+/g, "-"),
        brand: b.name,
        icon: b.icon,
        plan: tier,
        months: m,
        price: +((2.4 + ti * -0.5 + m * 1.05) * (1 + rnd * 0.2)).toFixed(2),
        seller: sellersPool[(bi + m) % sellersPool.length].seller,
        rating: 96 + Math.floor(rnd * 4),
        popular: m === 1 && ti === 0,
      };
    })
  )
);

/* --------------------------- Boosting ---------------------------- */

export type BoostService = {
  id: string;
  game: string;
  title: string;
  desc: string;
  from: number;
  eta: string;
};

export const boostServices: BoostService[] = [
  { id: "b1", game: "valorant", title: "Rank Boost", desc: "Iron → Radiant, any division", from: 8.99, eta: "1 – 3 days" },
  { id: "b2", game: "valorant", title: "Placement Matches", desc: "5 games, 80%+ win rate", from: 14.99, eta: "1 day" },
  { id: "b3", game: "bgmi", title: "Tier Push", desc: "Bronze → Conqueror", from: 6.49, eta: "2 – 4 days" },
  { id: "b4", game: "league-of-legends", title: "Division Boost", desc: "Solo/Duo & Flex queue", from: 11.99, eta: "1 – 3 days" },
  { id: "b5", game: "apex-legends", title: "Rank Boost", desc: "Rookie → Predator", from: 12.99, eta: "2 – 5 days" },
  { id: "b6", game: "genshin-impact", title: "Abyss Clear", desc: "Floor 12 full stars", from: 9.99, eta: "1 – 2 days" },
  { id: "b7", game: "call-of-duty-mobile", title: "Rank Boost", desc: "Up to Legendary", from: 7.99, eta: "2 – 4 days" },
  { id: "b8", game: "clash-of-clans", title: "Base Upgrade", desc: "TH upgrade & war stars", from: 5.99, eta: "3 – 7 days" },
];

export const money = (n: number) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
