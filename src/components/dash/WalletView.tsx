"use client";
import { useMoney } from "@/components/LocaleProvider";
import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Wallet, Plus, Loader2, Check } from "lucide-react";
import { Btn, Tag, Section, Empty } from "@/components/ui";
import { AnyLogo } from "@/components/BrandIcon";
import { when, label } from "@/lib/fmt";
import Link from "next/link";
import { topUpWalletAction } from "@/lib/actions/shop";
import { feeFor, limitError, type GatewayView } from "@/lib/gateway-fees";

const AMOUNTS = [10, 25, 50, 100, 250, 500];
const MAX_TOPUP = 5000;

type T = { id: string; type: string; amount: number; reference: string; created_at: string };

export default function WalletView({
  balance, txns, gateways,
}: {
  balance: number; txns: T[]; gateways: GatewayView[];
}) {
  const money = useMoney();
  const router = useRouter();
  const [amt, setAmt] = useState(50);
  const [custom, setCustom] = useState("");        // free-text custom amount
  const [method, setMethod] = useState(gateways[0]?.code ?? "card");
  const [pending, start] = useTransition();
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");
  const [kycBlocked, setKycBlocked] = useState(false);

  const gw = gateways.find((g) => g.code === method) ?? null;
  const fee = feeFor(amt, gw);
  const total = Math.round((amt + fee) * 100) / 100;
  const limitMsg = limitError(amt, gw);
  const invalid = !(amt > 0) || amt > MAX_TOPUP || !!limitMsg;

  /** Accepts a typed custom amount, clamped and rounded to cents. */
  const onCustom = (raw: string) => {
    const clean = raw.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
    setCustom(clean);
    const n = Number(clean);
    if (Number.isFinite(n) && n > 0) setAmt(Math.round(n * 100) / 100);
    else setAmt(0);
  };

  const pickPreset = (a: number) => {
    setAmt(a);
    setCustom("");
  };

  /**
   * Guards against the double-credit bug from two directions:
   *  1. `busy` is a ref, so it flips synchronously — a second click landing in
   *     the same tick (before React re-renders with `pending`) is dropped.
   *     The `disabled` prop alone could not catch that.
   *  2. `idemKey` is generated once per attempt and reused on retries, so if a
   *     request does reach the server twice the UNIQUE index rejects the
   *     duplicate instead of crediting the wallet again.
   */
  const busy = useRef(false);
  const idemKey = useRef<string>("");

  const topUp = () => {
    if (busy.current) return;
    busy.current = true;
    if (!idemKey.current) {
      idemKey.current =
        globalThis.crypto?.randomUUID?.() ??
        `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    start(async () => {
      setErr("");
      setKycBlocked(false);
      try {
        const r = await topUpWalletAction(amt, method, idemKey.current);
        if (!r.ok) {
          setKycBlocked(!!r.needsKyc);
          setErr(r.error || "Top-up failed.");
          return;
        }
        idemKey.current = "";   // success -> next top-up gets a fresh key
        setOk(true);
        setCustom("");

        // Funds are in. If the deposit crossed the identity threshold, collect
        // the verification now rather than having blocked the payment earlier.
        if (r.verifyAfter) {
          router.push("/dashboard/verification?after=topup");
          return;
        }

        setTimeout(() => setOk(false), 2200);
        router.refresh();
      } finally {
        busy.current = false;
      }
    });
  };

  const inflow = txns.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const outflow = txns.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0);

  return (
    <div className="space-y-4">
      <h1 className="text-[18px] font-black sm:text-[22px] tracking-tight">Wallet</h1>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-fuchsia-700 p-6 text-white"
          >
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
            <div className="flex items-center gap-2 text-[11.5px] opacity-80">
              <Wallet size={14} /> Available Balance
            </div>
            <div className="mt-1 text-[38px] font-black leading-none">{money(balance)}</div>
            <div className="mt-4 flex gap-6 text-[11.5px]">
              <div>
                <div className="opacity-70">Total added</div>
                <div className="text-[15px] font-bold">{money(inflow)}</div>
              </div>
              <div>
                <div className="opacity-70">Total spent</div>
                <div className="text-[15px] font-bold">{money(outflow)}</div>
              </div>
            </div>
          </motion.div>

          <Section title="Recent Wallet Activity">
            {txns.length === 0 ? (
              <Empty title="Nothing yet" sub="Add funds to check out faster next time." />
            ) : (
              <div className="space-y-2">
                {txns.slice(0, 10).map((t) => (
                  <div key={t.id} className="flex items-center gap-3 rounded-lg soft p-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-1 text-[12.5px] font-semibold">{t.reference}</div>
                      <div className="text-[10.5px] muted">{when(t.created_at)}</div>
                    </div>
                    <Tag tone={t.amount >= 0 ? "green" : "slate"}>{label(t.type)}</Tag>
                    <div className={`w-[80px] text-right text-[13px] font-bold ${t.amount >= 0 ? "text-emerald-400" : ""}`}>
                      {t.amount >= 0 ? "+" : "−"}
                      {money(Math.abs(t.amount))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        <div className="rounded-2xl panel p-4 sm:p-5 lg:sticky lg:top-[150px] lg:self-start">
          <h3 className="text-[14px] font-bold">Add Funds</h3>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {AMOUNTS.map((a) => (
              <button
                key={a}
                onClick={() => pickPreset(a)}
                className={`rounded-lg border py-2 text-[12.5px] font-bold transition ${
                  amt === a && !custom
                    ? "border-brand-500 bg-brand-500/15 text-brand-400"
                    : "border-[var(--line)] soft hover:border-brand-500/50"
                }`}
              >
                ${a}
              </button>
            ))}
          </div>

          {/* custom amount */}
          <div className="mt-2">
            <label className="mb-1 block text-[11px] font-medium muted">Or enter a custom amount</label>
            <div
              className={`flex items-center gap-1 rounded-lg border px-3 transition ${
                custom ? "border-brand-500 bg-brand-500/10" : "border-[var(--line)] soft"
              }`}
            >
              <span className="text-[15px] font-bold muted">$</span>
              <input
                value={custom}
                onChange={(e) => onCustom(e.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                aria-label="Custom top-up amount"
                className="w-full bg-transparent py-2 text-[15px] font-bold outline-none"
              />
            </div>
          </div>

          {/* payment methods — admin managed */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            {gateways.map((m) => (
              <button
                key={m.code}
                onClick={() => setMethod(m.code)}
                title={m.note || m.name}
                className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[12px] font-medium transition ${
                  method === m.code ? "border-brand-500 bg-brand-500/10" : "border-[var(--line)] soft hover:border-brand-500/50"
                }`}
              >
                {m.logo ? (
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-white/90">
                    <AnyLogo logo={m.logo} size={13} />
                  </span>
                ) : null}
                <span className="min-w-0 truncate text-left">{m.name}</span>
              </button>
            ))}
          </div>

          {/* live fee breakdown */}
          {amt > 0 && (
            <div className="mt-3 space-y-1 rounded-lg soft p-3 text-[11.5px]">
              <div className="flex justify-between">
                <span className="muted">Amount</span>
                <span className="font-semibold">{money(amt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="muted">
                  {gw?.name ?? "Gateway"} fee
                  {gw && (gw.feePercent > 0 || gw.feeFixed > 0) && (
                    <span className="ml-1 opacity-70">
                      ({gw.feePercent > 0 ? `${gw.feePercent}%` : ""}
                      {gw.feePercent > 0 && gw.feeFixed > 0 ? " + " : ""}
                      {gw.feeFixed > 0 ? `$${gw.feeFixed.toFixed(2)}` : ""})
                    </span>
                  )}
                </span>
                <span className={fee > 0 ? "font-semibold text-amber-400" : "font-semibold text-emerald-400"}>
                  {fee > 0 ? money(fee) : "Free"}
                </span>
              </div>
              <div className="flex justify-between border-t border-[var(--line)] pt-1">
                <span className="font-semibold">You pay</span>
                <span className="text-[13px] font-black text-brand-400">{money(total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="muted">Credited to wallet</span>
                <span className="font-semibold text-emerald-400">{money(amt)}</span>
              </div>
            </div>
          )}

          {limitMsg && (
            <div className="mt-2 rounded-lg bg-amber-500/10 px-3 py-2 text-[11.5px] text-amber-400">{limitMsg}</div>
          )}
          {amt > MAX_TOPUP && (
            <div className="mt-2 rounded-lg bg-amber-500/10 px-3 py-2 text-[11.5px] text-amber-400">
              Maximum top-up is ${MAX_TOPUP.toLocaleString("en-US")}.
            </div>
          )}

          {err && !kycBlocked && (
            <div className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-[11.5px] text-rose-400">{err}</div>
          )}
          {kycBlocked && (
            <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <div className="text-[11.5px] text-amber-300">{err}</div>
              <Link
                href="/dashboard/verification"
                className="mt-2.5 flex h-9 items-center justify-center rounded-lg bg-amber-500 text-[12.5px] font-bold text-black transition active:scale-[.98]"
              >
                Verify my identity
              </Link>
            </div>
          )}

          <Btn
            className="mt-3 flex w-full items-center justify-center gap-2"
            disabled={pending || invalid}
            onClick={topUp}
          >
            {pending ? <Loader2 size={13} className="animate-spin" /> : ok ? <Check size={13} /> : <Plus size={13} />}
            {ok ? "Funds added!" : amt > 0 ? `Pay ${money(total)}` : "Enter an amount"}
          </Btn>
          <p className="mt-2 text-[10.5px] muted">
            Demo mode — payments are simulated and credited instantly.
          </p>
        </div>
      </div>
    </div>
  );
}
