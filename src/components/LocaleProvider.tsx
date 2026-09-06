"use client";

import { createContext, useContext, useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  type LangCode, type CurrencyCode, type CurrencyDef, type Dict,
  getCurrency, formatMoney, LANG_COOKIE, CUR_COOKIE,
} from "@/lib/i18n";

type Ctx = {
  lang: LangCode;
  currency: CurrencyDef;
  rates: Record<string, number>;
  /** `t(key, fallback?)` — falls back to the supplied text, then the key. */
  t: (key: string, fallback?: string) => string;
  money: (usd: number | null | undefined) => string;
  setLang: (l: LangCode) => void;
  setCurrency: (c: CurrencyCode) => void;
  pending: boolean;
};

const LocaleCtx = createContext<Ctx | null>(null);

const setCookie = (name: string, value: string) => {
  document.cookie = `${name}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
};

export default function LocaleProvider({
  lang: initialLang,
  currency: initialCurrency,
  dict,
  rates,
  children,
}: {
  lang: LangCode;
  currency: CurrencyCode;
  dict: Dict;
  rates: Record<string, number>;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [lang, setLangState] = useState<LangCode>(initialLang);
  const [curCode, setCurCode] = useState<CurrencyCode>(initialCurrency);
  const [pending, start] = useTransition();

  const currency = useMemo(() => getCurrency(curCode), [curCode]);

  const t = useCallback(
    (key: string, fallback?: string) => dict[key] ?? fallback ?? key,
    [dict]
  );

  const money = useCallback(
    (usd: number | null | undefined) => formatMoney(usd, currency, rates[currency.code]),
    [currency, rates]
  );

  const setLang = useCallback(
    (l: LangCode) => {
      setLangState(l);
      setCookie(LANG_COOKIE, l);
      document.documentElement.lang = l;
      // Re-render server components so server-rendered copy updates too.
      start(() => router.refresh());
    },
    [router]
  );

  const setCurrency = useCallback(
    (c: CurrencyCode) => {
      setCurCode(c);
      setCookie(CUR_COOKIE, c);
      start(() => router.refresh());
    },
    [router]
  );

  const value = useMemo<Ctx>(
    () => ({ lang, currency, rates, t, money, setLang, setCurrency, pending }),
    [lang, currency, rates, t, money, setLang, setCurrency, pending]
  );

  return <LocaleCtx.Provider value={value}>{children}</LocaleCtx.Provider>;
}

export function useLocale(): Ctx {
  const c = useContext(LocaleCtx);
  if (!c) throw new Error("useLocale must be used inside <LocaleProvider>");
  return c;
}

/** Convenience hook for price rendering in client components. */
export const useMoney = () => useLocale().money;
export const useT = () => useLocale().t;
