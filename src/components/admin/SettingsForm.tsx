"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Check, Send, AlertCircle } from "lucide-react";
import { Btn, Field, inputCls } from "@/components/ui";
import { saveSettingsAction, sendTestMailAction, refreshRatesAction } from "@/lib/actions/admin";
import { CURRENCIES } from "@/lib/i18n";

type F = { key: string; label: string; hint?: string; type?: string; options?: string[]; def: string };

const GROUPS: { title: string; fields: F[] }[] = [
  {
    title: "Marketplace",
    fields: [
      { key: "site_name", label: "Site name", def: "G2X.GG" },
      { key: "support_email", label: "Support email", type: "email", def: "support@g2x.gg" },
      {
        key: "currency", label: "Default display currency", type: "select",
        options: CURRENCIES.map((c) => c.code), def: "USD",
        hint: "Used for visitors who have not picked one themselves",
      },
      { key: "maintenance", label: "Maintenance mode", type: "select", options: ["off", "on"], def: "off" },
      { key: "seo_title", label: "Browser tab / SEO title", def: "G2X.GG — Your Ultimate Gaming Marketplace" },
      { key: "seo_description", label: "SEO description", hint: "Shown in Google results", def: "Buy & sell gaming accounts, coins, items, top-ups, boosting, subscriptions & more at the best prices." },
    ],
  },
  {
    title: "Fees & commission",
    fields: [
      { key: "default_commission", label: "Default seller commission %", type: "number", hint: "Applied to new sellers", def: "8" },
      { key: "checkout_fee", label: "Buyer checkout fee %", type: "number", def: "2" },
      { key: "username_change_fee", label: "Username change fee ($)", type: "number", def: "5",
        hint: "Charged from the buyer's wallet after their first 2 free username changes. Set 0 to keep renames always free." },
      { key: "min_offer_price", label: "Minimum offer price", type: "number", def: "0.5" },
    ],
  },
  {
    title: "Payouts & escrow",
    fields: [
      { key: "min_withdrawal", label: "Minimum withdrawal", type: "number", def: "10" },
      { key: "max_pending_withdrawals", label: "Max pending payout requests", type: "number", def: "3" },
      { key: "escrow_hold_hours", label: "Escrow hold after delivery (hours)", type: "number", hint: "Auto-release if the buyer does not confirm", def: "72" },
    ],
  },
  {
    title: "Trust & safety",
    fields: [
      { key: "require_kyc", label: "Require ID verification to sell", type: "select", options: ["yes", "no"], def: "yes" },
      { key: "chat_monitoring", label: "Chat monitoring", type: "select", options: ["on", "off"], def: "on" },
      { key: "auto_flag_score", label: "Auto-flag score threshold", type: "number", hint: "Higher = fewer flags", def: "3" },
      { key: "buyer_kyc", label: "Require buyer identity check", type: "select", options: ["on", "off"], def: "on", hint: "Gates large deposits and purchases behind an approved ID check" },
      { key: "kyc_threshold", label: "Identity check threshold ($)", type: "text", def: "30", hint: "Deposits or orders at or above this amount require an approved buyer KYC" },
      { key: "dispute_window_days", label: "Dispute window (days)", type: "number", def: "14" },
    ],
  },
  {
    title: "Exchange rates",
    fields: CURRENCIES.filter((c) => c.code !== "USD").map((c) => ({
      key: `fx_${c.code}`,
      label: `1 USD = ? ${c.code} (${c.label})`,
      type: "number",
      def: "",
      hint: `Symbol ${c.symbol}. Leave blank to track the live market rate automatically. Enter a number only if you want to lock ${c.code} to a fixed rate.`,
    })),
  },
  {
    title: "Transactional email (Resend)",
    fields: [
      { key: "mail_enabled", label: "Send transactional email", type: "select", options: ["on", "off"], def: "on", hint: "Requires RESEND_API_KEY in the server environment (resend.com)" },
      { key: "mail_order", label: "Order confirmation → billing@g2x.gg", type: "select", options: ["on", "off"], def: "on" },
      { key: "mail_delivery", label: "Delivery notice → notification@g2x.gg", type: "select", options: ["on", "off"], def: "on" },
      { key: "mail_sale", label: "New sale alert → seller@g2x.gg", type: "select", options: ["on", "off"], def: "on" },
      { key: "mail_kyc", label: "Verification decision → seller@g2x.gg", type: "select", options: ["on", "off"], def: "on" },
      { key: "mail_refund", label: "Refund issued → refund@g2x.gg", type: "select", options: ["on", "off"], def: "on" },
      { key: "mail_dispute", label: "Dispute updates → disputes@g2x.gg", type: "select", options: ["on", "off"], def: "on" },
      { key: "mail_payout", label: "Payout updates → billing@g2x.gg", type: "select", options: ["on", "off"], def: "on" },
      { key: "mail_security", label: "Security alerts → security@g2x.gg", type: "select", options: ["on", "off"], def: "on" },
      { key: "mail_support", label: "Ticket replies → support@g2x.gg", type: "select", options: ["on", "off"], def: "on" },
      { key: "mail_wallet", label: "Wallet top-ups → billing@g2x.gg", type: "select", options: ["on", "off"], def: "on" },
      { key: "mail_message", label: "New chat message → notification@g2x.gg", type: "select", options: ["on", "off"], def: "on" },
    ],
  },
];

export type FxInfo = {
  live: Record<string, number>;
  manual: string[];
  ageLabel: string;
  source: string | null;
};

export default function SettingsForm({
  values,
  fx,
}: {
  values: Record<string, string>;
  fx: FxInfo;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testing, startTest] = useTransition();
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text?: string } | null>(null);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const [syncing, startSync] = useTransition();
  const [syncMsg, setSyncMsg] = useState("");

  const isFx = (key: string) => /^fx_[A-Z]{3}$/.test(key);
  const pinned = (key: string) => fx.manual.includes(key.slice(3));

  const syncNow = () =>
    startSync(async () => {
      setSyncMsg("");
      const r = await refreshRatesAction();
      setSyncMsg(r.ok ? r.error || "Rates updated." : r.error || "Could not reach the rate provider.");
      router.refresh();
    });

  const submit = (fd: FormData) =>
    start(async () => {
      setErr("");
      const r = await saveSettingsAction(fd);
      if (!r.ok) return setErr(r.error || "Could not save.");
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2500);
    });

  return (
    <form action={submit} className="space-y-4">
      {GROUPS.map((g) => (
        <div key={g.title} className="rounded-2xl panel p-5">
          <h3 className="mb-3 text-[14px] font-bold">{g.title}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {g.fields.map((f) => (
              <Field key={f.key} label={f.label} hint={f.hint}>
                {f.type === "select" ? (
                  <select name={`s_${f.key}`} defaultValue={values[f.key] ?? f.def} className={inputCls}>
                    {f.options!.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    name={`s_${f.key}`}
                    type={f.type ?? "text"}
                    step={f.type === "number" ? "0.000001" : undefined}
                    /* For an FX field we only prefill when the admin has pinned
                       that currency. Otherwise the box stays empty and shows
                       the live rate as a placeholder, so simply saving the form
                       never accidentally freezes a tracked rate. */
                    defaultValue={
                      isFx(f.key)
                        ? pinned(f.key)
                          ? values[f.key] ?? ""
                          : ""
                        : values[f.key] ?? f.def
                    }
                    placeholder={
                      isFx(f.key) && fx.live[f.key.slice(3)]
                        ? `live: ${fx.live[f.key.slice(3)]}`
                        : undefined
                    }
                    className={inputCls}
                  />
                )}
              </Field>
            ))}
          </div>

          {/* Live-rate status + manual sync, next to the FX fields. */}
          {g.title === "Exchange rates" && (
            <div className="mt-4 rounded-xl border border-[var(--line)] soft p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[12px] font-semibold">
                    Live rates{" "}
                    <span className="ml-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-500">
                      AUTO
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] muted">
                    Updated {fx.ageLabel}
                    {fx.source ? ` from ${fx.source}` : ""} — refreshed automatically every hour.
                    Prices are stored in USD and converted at checkout.
                    {fx.manual.length > 0 && (
                      <>
                        {" "}
                        Locked to a manual rate: <b>{fx.manual.join(", ")}</b> (clear the field to
                        track the market again).
                      </>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={syncNow}
                  disabled={syncing}
                  className="shrink-0 rounded-lg border border-[var(--line)] px-3 py-1.5 text-[12px] font-semibold hover:bg-[var(--soft)] disabled:opacity-60"
                >
                  {syncing ? "Syncing…" : "Sync now"}
                </button>
              </div>
              {syncMsg && <div className="mt-2 text-[11.5px] muted">{syncMsg}</div>}
            </div>
          )}

          {/* Live deliverability check, right where the mail switches are. */}
          {g.title.startsWith("Transactional email") && (
            <div className="mt-4 rounded-xl border border-[var(--line)] soft p-3">
              <div className="text-[12px] font-semibold">Test delivery</div>
              <p className="mt-0.5 text-[11px] muted">
                Sends a real email through Resend so you can confirm the API key, the verified
                sending domain and your DNS records before going live. Save any changes first.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  type="email"
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                  placeholder="you@example.com (blank = your admin email)"
                  className={inputCls + " max-w-[280px]"}
                />
                <button
                  type="button"
                  disabled={testing}
                  onClick={() => {
                    setTestMsg(null);
                    startTest(async () => {
                      const r = await sendTestMailAction(testTo);
                      setTestMsg(
                        r.ok
                          ? { ok: true, text: `Sent to ${r.to}. Check the inbox (and spam).` }
                          : { ok: false, text: r.error }
                      );
                    });
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 py-2 text-[12px] font-semibold transition-colors hover:border-brand-500 hover:text-brand-400 disabled:opacity-60"
                >
                  {testing ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  Send test email
                </button>
              </div>
              {testMsg && (
                <div
                  className={`mt-2 flex items-start gap-1.5 text-[11.5px] ${
                    testMsg.ok ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {testMsg.ok ? <Check size={13} className="mt-px" /> : <AlertCircle size={13} className="mt-px shrink-0" />}
                  <span>{testMsg.text}</span>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {err && <div className="text-[11.5px] text-rose-400">{err}</div>}
      <div className="sticky bottom-4 flex items-center gap-2">
        <Btn className="flex items-center gap-2" disabled={pending}>
          {pending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save settings
        </Btn>
        {saved && (
          <span className="flex items-center gap-1 text-[11.5px] text-emerald-400">
            <Check size={12} /> Saved
          </span>
        )}
      </div>
    </form>
  );
}
