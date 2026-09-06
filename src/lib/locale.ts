import "server-only";
import { cookies } from "next/headers";
import { all } from "./db";
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
 * Admin-editable FX overrides, stored as settings rows `fx_<CODE>`.
 * Falls back to the seeded rates in i18n.ts.
 */
export async function getRates(): Promise<Record<string, number>> {
  try {
    const rows = await all<{ key: string; value: string }>(
      `SELECT key, value FROM settings WHERE key LIKE 'fx_%'`
    );
    const out: Record<string, number> = {};
    rows.forEach((r) => {
      const n = Number(r.value);
      if (Number.isFinite(n) && n > 0) out[r.key.slice(3).toUpperCase()] = n;
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
