"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Wallet, Clock, Percent, TrendingUp, Loader2, Check } from "lucide-react";
import { Btn, Field, Section, Tag, Empty, inputCls } from "@/components/ui";
import { statusTone, label } from "@/lib/fmt";
import { requestWithdrawalAction } from "@/lib/actions/seller";
import LocalTime from "@/components/LocalTime";
import { useMoney } from "@/components/LocaleProvider";

type W = { id: string; amount: number; method: string; detail: string; status: string; created_at: string };
type T = { id: string; type: string; amount: number; reference: string; created_at: string };

export default function FinanceView({
  available, pendingBal, commissionPct, lifetimeNet, commissionPaid,
  payoutMethod, payoutDetail, withdrawals, txns,
}: {
  available: number; pendingBal: number; commissionPct: number; lifetimeNet: number;
  commissionPaid: number; payoutMethod: string; payoutDetail: string; withdrawals: W[]; txns: T[];
}) {
  const money = useMoney();
  const router = useRouter();
  const [amount, setAmount] = useState(Math.max(10, Math.floor(available)));
  const [method, setMethod] = useState(payoutMethod);
  const [detail, setDetail] = useState(payoutDetail);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();

  const cards = [
    { l: "Available", v: money(available), i: Wallet, c: "text-emerald-400" },
    { l: "In escrow", v: money(pendingBal), i: Clock, c: "text-amber-400" },
    { l: "Lifetime net", v: money(lifetimeNet), i: TrendingUp, c: "" },
    { l: `Commission (${commissionPct}%)`, v: money(commissionPaid), i: Percent, c: "" },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-[18px] font-black sm:text-[22px] tracking-tight">Finance & Payouts</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c, i) => (
          <motion.div
            key={c.l}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-2xl panel p-4"
          >
            <div className="flex items-center gap-2 text-[11px] muted">
              <c.i size={13} /> {c.l}
            </div>
            <div className={`mt-1.5 text-[19px] font-black ${c.c}`}>{c.v}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Section title="Withdrawal requests">
            {withdrawals.length === 0 ? (
              <Empty title="No withdrawals yet" sub={`Request a payout once you have ${money(10)} available.`} />
            ) : (
              <div className="space-y-2">
                {withdrawals.map((w) => (
                  <div key={w.id} className="flex items-center gap-3 rounded-lg soft p-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-semibold">{w.method}</div>
                      <div className="line-clamp-1 text-[10.5px] muted">
                        {w.detail} · <LocalTime at={w.created_at} />
                      </div>
                    </div>
                    <Tag tone={statusTone(w.status)}>{label(w.status)}</Tag>
                    <div className="w-[80px] text-right text-[13px] font-bold">{money(w.amount)}</div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Transaction history">
            {txns.length === 0 ? (
              <Empty title="No transactions yet" />
            ) : (
              <div className="space-y-1.5">
                {txns.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 border-b border-[var(--line)] py-2 last:border-0">
                    <div className="min-w-0 flex-1 text-[12px]">{t.reference}</div>
                    <Tag tone={t.amount >= 0 ? "green" : "slate"}>{label(t.type)}</Tag>
                    <div className={`w-[80px] text-right text-[12.5px] font-bold ${t.amount >= 0 ? "text-emerald-400" : ""}`}>
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
          <h3 className="text-[14px] font-bold">Request a payout</h3>
          <p className="mt-1 text-[11px] muted">Minimum {money(10)}. Processed within 1–3 business days.</p>
          <div className="mt-3 space-y-3">
            {/*
              Payouts settle in USD, but the seller reads the whole site in
              their chosen currency — showing a bare "Amount (USD)" box next to
              INR balances is confusing. The input stays USD (that is what is
              actually transferred) and the converted value is echoed beneath.
            */}
            <Field label="Amount (USD)">
              <input
                type="number"
                step="0.01"
                className={inputCls}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
              {amount > 0 && (
                <div className="mt-1 text-[11px] muted">
                  ≈ {money(amount)} at today&apos;s rate · paid out in USD
                </div>
              )}
            </Field>
            <Field label="Method">
              <select className={inputCls} value={method} onChange={(e) => setMethod(e.target.value)}>
                {["Bank Transfer", "PayPal", "UPI", "Crypto (USDT)"].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
            <Field label="Payout details">
              <input
                className={inputCls}
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="Account number / UPI ID / wallet"
              />
            </Field>
            {err && <div className="text-[11.5px] text-rose-400">{err}</div>}
            <Btn
              className="flex w-full items-center justify-center gap-2"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setErr("");
                  const r = await requestWithdrawalAction({ amount, method, detail });
                  if (!r.ok) return setErr(r.error || "Could not request payout.");
                  setOk(true);
                  setTimeout(() => setOk(false), 2200);
                  router.refresh();
                })
              }
            >
              {pending ? <Loader2 size={13} className="animate-spin" /> : ok ? <Check size={13} /> : null}
              {ok ? "Requested!" : `Withdraw ${money(amount)}`}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
