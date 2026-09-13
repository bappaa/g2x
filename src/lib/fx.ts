import "server-only";
import { all, run } from "./db";
import { CURRENCIES } from "./i18n";

/**
 * LIVE EXCHANGE RATES
 * ===================
 * Prices are stored in USD and converted at render time. Until now the
 * conversion used the hard-coded `rate` values in i18n.ts, which drift out of
 * date (INR was pinned at 88.5 while the market sat near 94.5 — buyers were
 * being quoted ~6% under the real price).
 *
 * This module refreshes those rates from a free, key-less FX feed and stores
 * them as `settings` rows named `fx_<CODE>`, which is exactly the shape
 * `getRates()` in locale.ts already reads. So nothing downstream changes: the
 * whole site picks the new numbers up automatically.
 *
 * Design rules:
 *  - Never block a page render on the network. Rendering always reads the DB;
 *    refreshing happens out of band and on a cadence.
 *  - Never leave the site without rates. Any failure keeps the last-known
 *    stored values, and those in turn fall back to the static i18n table.
 *  - An admin can always win. Rates typed into Admin -> Settings -> Exchange
 *    rates are marked manual and are never overwritten by the feed.
 */

/** How old stored rates may get before we refresh them. */
const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

const STAMP_KEY = "fx_updated_at";
const SOURCE_KEY = "fx_source";
/** Comma-separated currency codes the admin has pinned by hand. */
const MANUAL_KEY = "fx_manual";

type Feed = { name: string; url: string; pick: (j: unknown) => Record<string, number> | null };

/**
 * Two independent providers. Both are free and require no API key; the second
 * is only touched if the first fails or answers with nonsense.
 */
const FEEDS: Feed[] = [
  {
    name: "exchangerate-api",
    url: "https://open.er-api.com/v6/latest/USD",
    pick: (j) => {
      const d = j as { result?: string; rates?: Record<string, number> };
      return d?.result === "success" && d.rates ? d.rates : null;
    },
  },
  {
    name: "frankfurter",
    url: "https://api.frankfurter.dev/v1/latest?base=USD",
    pick: (j) => {
      const d = j as { rates?: Record<string, number> };
      return d?.rates ?? null;
    },
  },
];

/** Currency codes we actually need, minus the USD base. */
function wanted(): string[] {
  return CURRENCIES.map((c) => c.code).filter((c) => c !== "USD");
}

/**
 * A sanity filter. A bad upstream payload should never be able to turn every
 * price on the marketplace into nonsense, so a candidate rate is only accepted
 * if it is a positive finite number in a plausible range.
 */
function sane(code: string, n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0 && n < 1_000_000 && !!code;
}

async function fetchRates(): Promise<{ rates: Record<string, number>; source: string } | null> {
  for (const feed of FEEDS) {
    try {
      const res = await fetch(feed.url, {
        // We do our own DB-backed caching, so bypass Next's fetch cache.
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
        headers: { accept: "application/json" },
      });
      if (!res.ok) continue;

      const raw = feed.pick(await res.json());
      if (!raw) continue;

      const rates: Record<string, number> = {};
      for (const code of wanted()) {
        const v = raw[code];
        if (sane(code, v)) rates[code] = v;
      }
      // Require a meaningful response, not one stray pair.
      if (Object.keys(rates).length >= 3) return { rates, source: feed.name };
    } catch {
      // Try the next provider.
    }
  }
  return null;
}

async function settingsMap(prefix: string): Promise<Record<string, string>> {
  const rows = await all<{ key: string; value: string }>(
    `SELECT key, value FROM settings WHERE key LIKE ?`,
    [`${prefix}%`]
  );
  const out: Record<string, string> = {};
  rows.forEach((r) => (out[r.key] = r.value));
  return out;
}

/** Codes the admin pinned manually — the feed must leave these alone. */
export async function manualCodes(): Promise<Set<string>> {
  const rows = await all<{ value: string }>(`SELECT value FROM settings WHERE key=?`, [MANUAL_KEY]);
  return new Set(
    (rows[0]?.value ?? "")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
  );
}

/** Marks a currency as admin-controlled (called when Settings saves an fx_ field). */
export async function pinManual(code: string) {
  const set = await manualCodes();
  set.add(code.toUpperCase());
  await run(
    `INSERT INTO settings (key,value) VALUES (?,?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
    [MANUAL_KEY, [...set].join(",")]
  );
}

/** Hands a currency back to the live feed. */
export async function unpinManual(code: string) {
  const set = await manualCodes();
  set.delete(code.toUpperCase());
  await run(
    `INSERT INTO settings (key,value) VALUES (?,?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
    [MANUAL_KEY, [...set].join(",")]
  );
}

/**
 * Refreshes `fx_<CODE>` settings from the live feed.
 * @param force ignore the 1-hour freshness window.
 * @returns what happened, for the admin screen and the cron script.
 */
export async function refreshRates(force = false): Promise<{
  ok: boolean;
  updated: number;
  skipped: string[];
  source?: string;
  reason?: string;
  at?: string;
}> {
  try {
    const meta = await settingsMap("fx_");
    const last = Number(meta[STAMP_KEY] ?? 0);
    const age = Date.now() - last;

    if (!force && last > 0 && age < MAX_AGE_MS) {
      return { ok: true, updated: 0, skipped: [], reason: "fresh", at: new Date(last).toISOString() };
    }

    const got = await fetchRates();
    if (!got) {
      // Offline / provider down: keep whatever is stored. Prices stay correct
      // as of the last successful sync rather than breaking.
      return { ok: false, updated: 0, skipped: [], reason: "all providers unreachable" };
    }

    const manual = await manualCodes();
    const skipped: string[] = [];
    let updated = 0;

    for (const [code, rate] of Object.entries(got.rates)) {
      if (manual.has(code)) {
        skipped.push(code);
        continue;
      }
      await run(
        `INSERT INTO settings (key,value) VALUES (?,?)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
        [`fx_${code}`, String(rate)]
      );
      updated++;
    }
    const now = Date.now();
    await run(
      `INSERT INTO settings (key,value) VALUES (?,?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
      [STAMP_KEY, String(now)]
    );
    await run(
      `INSERT INTO settings (key,value) VALUES (?,?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
      [SOURCE_KEY, got.source]
    );

    return { ok: true, updated, skipped, source: got.source, at: new Date(now).toISOString() };
  } catch (e) {
    return { ok: false, updated: 0, skipped: [], reason: (e as Error)?.message ?? "unknown error" };
  }
}

/** Metadata for the admin Exchange-rates panel. */
export async function fxStatus(): Promise<{
  updatedAt: string | null;
  ageLabel: string;
  source: string | null;
  manual: string[];
}> {
  const meta = await settingsMap("fx_");
  const last = Number(meta[STAMP_KEY] ?? 0);
  const manual = [...(await manualCodes())].sort();

  if (!last) return { updatedAt: null, ageLabel: "never", source: null, manual };

  const mins = Math.max(0, Math.round((Date.now() - last) / 60000));
  const ageLabel =
    mins < 1 ? "just now" : mins < 60 ? `${mins} min ago` : `${Math.round(mins / 60)} h ago`;

  return {
    updatedAt: new Date(last).toISOString(),
    ageLabel,
    source: meta[SOURCE_KEY] ?? null,
    manual,
  };
}
