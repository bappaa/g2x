"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown, Globe, Loader2 } from "lucide-react";
import { LANGUAGES, CURRENCIES, type LangCode, type CurrencyCode } from "@/lib/i18n";
import { useLocaleStrict } from "./LocaleProvider";

export default function LocaleSwitcher({ compact = false, up = false }: { compact?: boolean; up?: boolean }) {
  const { lang, currency, setLang, setCurrency, pending } = useLocaleStrict();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"lang" | "cur">("lang");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Language and currency"
        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-medium soft transition-colors hover:text-brand-400"
      >
        {pending ? (
          <Loader2 size={13} className="animate-spin" />
        ) : compact ? (
          <Globe size={13} />
        ) : (
          <span className="text-[13px] leading-none">{active.flag}</span>
        )}
        <span className="hidden sm:inline">{active.short}</span>
        <span className="muted">·</span>
        <span>{currency.code}</span>
        <ChevronDown size={11} className={`muted transition-transform ${open !== up ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: up ? 6 : -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: up ? 6 : -6, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className={`absolute right-0 z-[80] w-[min(268px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] shadow-2xl ${up ? "bottom-full mb-2" : "mt-2"}`}
          >
            <div className="flex border-b border-[var(--line)]">
              {([
                ["lang", "Language"],
                ["cur", "Currency"],
              ] as const).map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={`flex-1 px-3 py-2 text-[11.5px] font-semibold transition-colors ${
                    tab === k ? "text-brand-400" : "muted hover:text-brand-400"
                  }`}
                >
                  {l}
                  {tab === k && (
                    <motion.span layoutId="localeTab" className="mt-1.5 block h-[2px] rounded bg-brand-500" />
                  )}
                </button>
              ))}
            </div>

            <div className="max-h-[min(300px,50vh)] overflow-y-auto p-1.5">
              {tab === "lang"
                ? LANGUAGES.map((l) => (
                    <Row
                      key={l.code}
                      active={l.code === lang}
                      onClick={() => {
                        setLang(l.code as LangCode);
                        setOpen(false);
                      }}
                      left={<span className="text-[14px] leading-none">{l.flag}</span>}
                      label={l.label}
                      right={l.short}
                    />
                  ))
                : CURRENCIES.map((c) => (
                    <Row
                      key={c.code}
                      active={c.code === currency.code}
                      onClick={() => {
                        setCurrency(c.code as CurrencyCode);
                        setOpen(false);
                      }}
                      left={
                        <span className="w-[26px] text-center font-mono text-[11px] font-bold text-brand-400">
                          {c.symbol}
                        </span>
                      }
                      label={c.label}
                      right={c.code}
                    />
                  ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({
  active, onClick, left, label, right,
}: {
  active: boolean; onClick: () => void; left: React.ReactNode; label: string; right: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12px] transition-colors ${
        active ? "bg-brand-600/15 font-semibold text-brand-400" : "hover:bg-brand-600/10"
      }`}
    >
      {left}
      <span className="flex-1 truncate">{label}</span>
      <span className="text-[10px] muted">{right}</span>
      {active && <Check size={12} className="text-brand-400" />}
    </button>
  );
}
