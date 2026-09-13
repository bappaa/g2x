"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Star, BadgeCheck } from "lucide-react";
import { Btn, Field, Section, Tag, inputCls } from "@/components/ui";
import { saveStoreAction } from "@/lib/actions/seller";

type Prof = {
  store_name: string; slug: string; description: string | null; logo: string | null;
  banner: string | null; payout_method: string | null; payout_detail: string | null;
  level: string; rating: number; total_orders: number; commission_pct: number; verified: number;
};

export default function StoreSettings({ profile }: { profile: Prof }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4">
      <h1 className="text-[18px] font-black sm:text-[22px] tracking-tight">Store Settings</h1>

      <div className="rounded-2xl panel p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-xl bg-gradient-to-br from-amber-400 to-brand-600 text-[20px] font-black text-white">
            {profile.store_name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <div className="flex items-center gap-1.5 text-[16px] font-bold">
              {profile.store_name}
              {!!profile.verified && <BadgeCheck size={15} className="text-brand-400" />}
            </div>
            <div className="text-[11.5px] muted">g2x.gg/store/{profile.slug}</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Tag tone="amber">{profile.level}</Tag>
              <Tag tone="green">
                <span className="inline-flex items-center gap-1">
                  <Star size={9} className="fill-current" /> {profile.rating}%
                </span>
              </Tag>
              <Tag tone="slate">{profile.total_orders} orders</Tag>
              <Tag tone="slate">{profile.commission_pct}% commission</Tag>
            </div>
          </div>
        </div>
      </div>

      <Section title="Store profile">
        <form
          action={(fd) =>
            start(async () => {
              setErr(""); setMsg("");
              const r = await saveStoreAction(fd);
              if (!r.ok) return setErr(r.error || "Could not save.");
              setMsg("Store updated.");
              router.refresh();
            })
          }
          className="space-y-3"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Store name">
              <input name="storeName" defaultValue={profile.store_name} className={inputCls} required />
            </Field>
            <Field label="Logo URL" hint="Optional — leave blank to use the initial badge.">
              <input name="logo" defaultValue={profile.logo ?? ""} className={inputCls} />
            </Field>
            <Field label="Payout method">
              <select name="payoutMethod" defaultValue={profile.payout_method ?? "Bank Transfer"} className={inputCls}>
                {["Bank Transfer", "PayPal", "UPI", "Crypto (USDT)"].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
            <Field label="Payout details">
              <input name="payoutDetail" defaultValue={profile.payout_detail ?? ""} className={inputCls} />
            </Field>
          </div>
          <Field label="Banner URL">
            <input name="banner" defaultValue={profile.banner ?? ""} className={inputCls} />
          </Field>
          <Field label="About your store">
            <textarea name="description" rows={3} defaultValue={profile.description ?? ""} className={inputCls} />
          </Field>

          {err && <div className="text-[11.5px] text-rose-400">{err}</div>}
          {msg && (
            <div className="flex items-center gap-1.5 text-[11.5px] text-emerald-400">
              <Check size={13} /> {msg}
            </div>
          )}
          <Btn className="flex items-center gap-2" disabled={pending}>
            {pending && <Loader2 size={13} className="animate-spin" />} Save store
          </Btn>
        </form>
      </Section>
    </div>
  );
}
