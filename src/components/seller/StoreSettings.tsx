"use client";
import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Star, BadgeCheck, Upload, X, AtSign } from "lucide-react";
import { Btn, Field, Section, Tag, inputCls } from "@/components/ui";
import { saveStoreAction } from "@/lib/actions/seller";

type Prof = {
  store_name: string; slug: string; description: string | null; logo: string | null;
  banner: string | null; payout_method: string | null; payout_detail: string | null;
  whatsapp: string | null; telegram: string | null; discord: string | null;
  level: string; rating: number; total_orders: number; verified: number;
};

export default function StoreSettings({
  profile,
  username,
  changesUsed,
  freeChanges,
  fee,
  balance,
}: {
  profile: Prof;
  username: string;
  changesUsed: number;
  freeChanges: number;
  fee: number;
  balance: number;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const busy = useRef(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(profile.logo ?? null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(profile.banner ?? null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [removeBanner, setRemoveBanner] = useState(false);

  const handleLogoFile = (f: File | null) => {
    if (!f) return;
    if (f.size > 1024 * 1024) {
      setErr("Logo must be 1 MB or smaller.");
      return;
    }
    const url = URL.createObjectURL(f);
    setLogoPreview(url);
    setRemoveLogo(false);
    setErr("");
  };

  const handleBannerFile = (f: File | null) => {
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      setErr("Banner must be 2 MB or smaller.");
      return;
    }
    const url = URL.createObjectURL(f);
    setBannerPreview(url);
    setRemoveBanner(false);
    setErr("");
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy.current) return;
    busy.current = true;
    const fd = new FormData(e.currentTarget);
    if (removeLogo) fd.set("removeLogo", "1");
    if (removeBanner) fd.set("removeBanner", "1");
    start(async () => {
      try {
        setErr(""); setMsg("");
        const r = await saveStoreAction(fd);
        if (!r.ok) return setErr(r.error || "Could not save.");
        setMsg("Store updated. Your username is now your store name.");
        router.refresh();
      } finally {
        busy.current = false;
      }
    });
  };

  return (
    <div className="space-y-4">
      <h1 className="text-[18px] font-black sm:text-[22px] tracking-tight">Store Settings</h1>
      <div className="rounded-2xl panel p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid h-14 w-14 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-amber-400 to-brand-600 text-[20px] font-black text-white">
            {logoPreview && !removeLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoPreview} alt="" className="h-full w-full object-cover" />
            ) : (
              profile.store_name.slice(0, 1).toUpperCase()
            )}
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
            </div>
          </div>
        </div>
      </div>
      <Section title="Store profile">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Store name" hint={`This becomes your username @${username}. Linked with buyer panel.`}>
              <input name="storeName" defaultValue={profile.store_name} className={inputCls} required />
            </Field>
            <Field label="Payout method">
              <select name="payoutMethod" defaultValue={profile.payout_method ?? "Bank Transfer"} className={inputCls}>
                {["Bank Transfer", "PayPal", "Crypto (USDT)", "Wise"].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
            <Field label="Payout details">
              <input name="payoutDetail" defaultValue={profile.payout_detail ?? ""} className={inputCls} placeholder="Bank account / PayPal email / Crypto address" />
            </Field>
          </div>
          <div className="flex items-start gap-2 rounded-xl soft px-3 py-3 text-[11.5px]">
            <AtSign size={14} className="mt-0.5 shrink-0 text-brand-400" />
            <div className="muted">
              <div className="font-semibold text-white">Username: @{username}</div>
              <div className="mt-1">
                {(() => {
                  const remaining = Math.max(0, freeChanges - changesUsed);
                  if (remaining > 0) {
                    return (
                      <>
                        You have <b className="text-white">{remaining}</b> free store name change{remaining === 1 ? "" : "s"} left.
                        This is linked with your buyer panel username — same limit. {fee > 0 && <>After that each change costs ${fee.toFixed(2)}.</>}
                      </>
                    );
                  }
                  return fee > 0 ? (
                    <>
                      You have used your {freeChanges} free changes (linked with buyer panel).
                      Each further store name change costs <b className="text-white">${fee.toFixed(2)}</b>, taken from your wallet (balance ${balance.toFixed(2)}).
                    </>
                  ) : (
                    <>You have used your {freeChanges} free changes, but renames are currently free.</>
                  );
                })()}
              </div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="mb-1.5 text-[11.5px] font-semibold">Store Logo (upload image)</div>
              <div className="rounded-xl border border-dashed border-[var(--line)] p-3">
                {logoPreview && !removeLogo ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoPreview} alt="logo" className="h-24 w-24 rounded-xl object-cover" />
                    <button type="button" onClick={() => { setLogoPreview(null); setRemoveLogo(true); if (logoRef.current) logoRef.current.value=""; }} className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-white hover:bg-rose-500">
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <div className="grid place-items-center py-6 text-center">
                    <div className="text-[11px] muted">No logo — initial letter will be used</div>
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => logoRef.current?.click()} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-[11.5px] font-bold text-white hover:bg-brand-500">
                    <Upload size={12} /> {logoPreview ? "Change logo" : "Upload logo"}
                  </button>
                  {logoPreview && !removeLogo && (
                    <button type="button" onClick={() => { setLogoPreview(null); setRemoveLogo(true); if (logoRef.current) logoRef.current.value=""; }} className="rounded-lg soft px-3 py-1.5 text-[11.5px] font-semibold hover:text-rose-400">
                      Remove
                    </button>
                  )}
                </div>
                <input ref={logoRef} type="file" name="logoFile" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => handleLogoFile(e.target.files?.[0] ?? null)} />
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-[11.5px] font-semibold">Store Banner (upload image)</div>
              <div className="rounded-xl border border-dashed border-[var(--line)] p-3">
                {bannerPreview && !removeBanner ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={bannerPreview} alt="banner" className="h-24 w-full rounded-lg object-cover" />
                    <button type="button" onClick={() => { setBannerPreview(null); setRemoveBanner(true); if (bannerRef.current) bannerRef.current.value=""; }} className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-white hover:bg-rose-500">
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <div className="grid place-items-center py-6 text-center">
                    <div className="text-[11px] muted">No banner</div>
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => bannerRef.current?.click()} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-[11.5px] font-bold text-white hover:bg-brand-500">
                    <Upload size={12} /> {bannerPreview ? "Change banner" : "Upload banner"}
                  </button>
                  {bannerPreview && !removeBanner && (
                    <button type="button" onClick={() => { setBannerPreview(null); setRemoveBanner(true); if (bannerRef.current) bannerRef.current.value=""; }} className="rounded-lg soft px-3 py-1.5 text-[11.5px] font-semibold hover:text-rose-400">
                      Remove
                    </button>
                  )}
                </div>
                <input ref={bannerRef} type="file" name="bannerFile" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => handleBannerFile(e.target.files?.[0] ?? null)} />
              </div>
            </div>
          </div>
          <Field label="About your store">
            <textarea name="description" rows={3} defaultValue={profile.description ?? ""} className={inputCls} placeholder="Instant delivery, trusted seller..." />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="WhatsApp (optional)">
              <input name="whatsapp" defaultValue={profile.whatsapp ?? ""} className={inputCls} placeholder="+1 234 567 890" />
            </Field>
            <Field label="Telegram (optional)">
              <input name="telegram" defaultValue={profile.telegram ?? ""} className={inputCls} placeholder="@username or t.me/link" />
            </Field>
            <Field label="Discord (optional)">
              <input name="discord" defaultValue={profile.discord ?? ""} className={inputCls} placeholder="username or discord.gg/invite" />
            </Field>
          </div>
          {err && <div className="text-[11.5px] text-rose-400">{err}</div>}
          {msg && (
            <div className="flex items-center gap-1.5 text-[11.5px] text-emerald-400">
              <Check size={13} /> {msg}
            </div>
          )}
          <Btn type="submit" className="flex items-center gap-2" disabled={pending}>
            {pending && <Loader2 size={13} className="animate-spin" />} Save store
          </Btn>
        </form>
      </Section>
    </div>
  );
}
