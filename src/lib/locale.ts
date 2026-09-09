import "server-only";
import { cookies } from "next/headers";
import { all } from "./db";
import { runAfter } from "./after";
import {
  DEFAULT_LANG, DEFAULT_CURRENCY, LANG_COOKIE, CUR_COOKIE,
  isLang, isCurrency, getCurrency, formatMoney, translator,
  type LangCode, type CurrencyCode,
} from "./i18n";

/** Reads the visitor's language + currency from cookies (set by LocaleProvider). */
export function getLocale(): { lang: LangCode; currency: CurrencyCode } {
  const jar = cookies();
  const l = jar.get(LANG_COOKIE)?.value ?? "";
  const c = jar.get(CUR_COOKIE)?.value ?? "";
  return {
    lang: isLang(l) ? l : DEFAULT_LANG,
    currency: isCurrency(c) ? c : DEFAULT_CURRENCY,
  };
}

/**
 * Fire-and-forget staleness check. Deliberately NOT awaited by callers: if the
 * rates are older than the refresh window we start a background sync and let
 * the current request finish with the values we already have. A single
 * in-flight promise is kept so a burst of concurrent renders triggers one
 * fetch, not one per request.
 */
let inflight: Promise<unknown> | null = null;

function maybeRefresh(rows: { key: string; value: string }[]) {
  const stamp = Number(rows.find((r) => r.key === "fx_updated_at")?.value ?? 0);
  const stale = !stamp || Date.now() - stamp > 60 * 60 * 1000;
  if (!stale || inflight) return;

  runAfter(() => {
    inflight = import("./fx")
      .then((m) => m.refreshRates())
      .catch(() => null)
      .finally(() => {
        inflight = null;
      });
    return inflight;
  });
}

/**
 * Live + admin-editable FX rates, stored as settings rows `fx_<CODE>`.
 *
 * Reads are always DB-only so a page render never waits on the network. When
 * the stored rates go stale a refresh is kicked off in the background (see
 * lib/fx.ts); this request still serves the previous values and the next one
 * picks up the fresh numbers. Anything missing falls back to the static table
 * in i18n.ts, so the site always has a usable rate.
 */
export async function getRates(): Promise<Record<string, number>> {
  try {
    const rows = await all<{ key: string; value: string }>(
      `SELECT key, value FROM settings WHERE key LIKE 'fx_%'`
    );
    void maybeRefresh(rows);
    const out: Record<string, number> = {};
    rows.forEach((r) => {
      /**
       * The `fx_` prefix is also used for bookkeeping rows (`fx_updated_at`,
       * `fx_source`, `fx_manual`). Only accept keys shaped like a real
       * currency code, otherwise `fx_updated_at` would be parsed as a rate for
       * a currency called "UPDATED_AT".
       */
      const code = r.key.slice(3).toUpperCase();
      if (!/^[A-Z]{3}$/.test(code)) return;

      const n = Number(r.value);
      if (Number.isFinite(n) && n > 0) out[code] = n;
    });
    return out;
  } catch {
    return {};
  }
}

/** Server-side `t()` + `money()` for use inside server components. */
export async function serverLocale() {
  const { lang, currency } = getLocale();
  const rates = await getRates();
  const cur = getCurrency(currency);
  return {
    lang,
    currency: cur,
    rates,
    t: translator(lang),
    money: (usd: number | null | undefined) => formatMoney(usd, cur, rates[cur.code]),
  };
}
