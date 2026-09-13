import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@libsql/client";
import { makeDb } from "./db-url.mjs";

const db = makeDb(createClient, { quiet: true });

const LISTS: Record<string, string[]> = {
  login_method: [
    "No login required",
    "Player ID + Zone ID",
    "Player ID only",
    "Username + Password",
    "Email + Password",
    "Facebook login",
    "Google login",
    "Apple ID",
    "Riot ID",
    "Steam login",
    "Epic Games login",
    "Garena account",
    "Mihoyo / HoYoverse account",
    "UID + Server",
    "Character name + Server",
    "Redeem code (no login)",
  ],
  delivery_method: [
    "Instant code",
    "Auto delivery",
    "Manual delivery",
    "In-game trade",
    "In-game mail",
    "Account transfer",
    "Direct top-up",
    "Gift link",
    "Email delivery",
    "Face to face trade",
    "Auction house",
    "Mailbox delivery",
  ],
  region: [
    "Global",
    "India",
    "United States",
    "Canada",
    "United Kingdom",
    "Europe",
    "Germany",
    "France",
    "Italy",
    "Spain",
    "Netherlands",
    "Poland",
    "Turkey",
    "Russia / CIS",
    "Brazil",
    "Latin America",
    "Mexico",
    "Argentina",
    "Middle East",
    "United Arab Emirates",
    "Saudi Arabia",
    "Africa",
    "South Africa",
    "Nigeria",
    "Egypt",
    "Asia",
    "Southeast Asia",
    "Singapore",
    "Malaysia",
    "Indonesia",
    "Philippines",
    "Thailand",
    "Vietnam",
    "Japan",
    "South Korea",
    "China",
    "Hong Kong",
    "Taiwan",
    "Australia",
    "New Zealand",
    "North America",
    "South America",
    "Oceania",
  ],
  platform: [
    "All",
    "PC",
    "Steam",
    "Epic Games",
    "Battle.net",
    "Origin / EA App",
    "Ubisoft Connect",
    "GOG",
    "Riot Client",
    "Mobile",
    "Android",
    "iOS",
    "PlayStation",
    "PlayStation 4",
    "PlayStation 5",
    "Xbox",
    "Xbox One",
    "Xbox Series X|S",
    "Nintendo Switch",
    "Cross-platform",
    "Browser",
    "VR",
  ],
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

let n = 0;
let skip = 0;
for (const [listKey, values] of Object.entries(LISTS)) {
  for (let i = 0; i < values.length; i++) {
    const label = values[i];
    const value = slug(label);
    const ex = await db.execute({
      sql: `SELECT id FROM option_lists WHERE list_key=? AND value=?`,
      args: [listKey, value],
    });
    if (ex.rows.length) {
      skip++;
      continue;
    }
    await db.execute({
      sql: `INSERT INTO option_lists (id,list_key,value,label,sort_order,active) VALUES (?,?,?,?,?,1)`,
      args: [`opt_${listKey}_${value}`.slice(0, 60), listKey, value, label, i],
    });
    n++;
  }
}

console.log(`✓ option lists — ${n} created, ${skip} already present`);
