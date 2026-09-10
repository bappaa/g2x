/**
 * Refresh FX rates from the live feed into `settings.fx_<CODE>`.
 *
 *   npm run fx:refresh
 *
 * The site already self-heals (a stale read triggers a background sync), so
 * this exists for two cases: seeding the rates right after a deploy, and
 * running on a cron for hosts that freeze between requests. Safe to run often.
 * Currencies pinned by the admin in Settings are never touched.
 *
 * Note: this cannot import src/lib/fx.ts because that module is `server-only`,
 * so the fetch + upsert logic is mirrored here against the same tables.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@libsql/client";
import { makeDb } from "./db-url.mjs";

const db = makeDb(createClient, { quiet: true });

const CODES = ["INR", "CAD", "AUD", "EUR", "GBP", "JPY", "BRL", "SGD", "CHF", "SEK"];

const FEEDS = [
  {
    name: "exchangerate-api",
    url: "https://open.er-api.com/v6/latest/USD",
    pick: (j: any) => (j?.result === "success" ? j.rates : null),
  },
  {
    name: "frankfurter",
    url: "https://api.frankfurter.dev/v1/latest?base=USD",
    pick: (j: any) => j?.rates ?? null,
  },
];

async function fetchRates() {
  for (const f of FEEDS) {
    try {
      const res = await fetch(f.url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;
      const raw = f.pick(await res.json());
      if (!raw) continue;
      const rates: Record<string, number> = {};
      for (const c of CODES) {
        const v = raw[c];
        if (typeof v === "number" && Number.isFinite(v) && v > 0) rates[c] = v;
      }
      if (Object.keys(rates).length >= 3) return { rates, source: f.name };
    } catch {
      /* next provider */
    }
  }
  return null;
}

async function upsert(key: string, value: string) {
  await db.execute({
    sql: `INSERT INTO settings (key,value) VALUES (?,?)
          ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
    args: [key, value],
  });
}

const got = await fetchRates();
if (!got) {
  console.error("✗ could not reach any FX provider — stored rates left as-is");
  process.exit(1);
}

const manualRow = await db.execute({
  sql: `SELECT value FROM settings WHERE key='fx_manual'`,
  args: [],
});
const manual = new Set(
  String(manualRow.rows[0]?.value ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
);

let n = 0;
for (const [code, rate] of Object.entries(got.rates)) {
  if (manual.has(code)) {
    console.log(`  ${code}  skipped (admin override)`);
    continue;
  }
  await upsert(`fx_${code}`, String(rate));
  console.log(`  ${code}  1 USD = ${rate}`);
  n++;
}

await upsert("fx_updated_at", String(Date.now()));
await upsert("fx_source", got.source);

console.log(`\n✓ FX updated — ${n} rates from ${got.source}`);
