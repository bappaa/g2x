"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Trash2, Check } from "lucide-react";
import { Btn, inputCls } from "@/components/ui";
import { purgeContentAction, type PurgeScope } from "@/lib/actions/admin";

const SCOPES: { key: PurgeScope; label: string; sub: string }[] = [
  { key: "demo_reviews", label: "Demo reviews", sub: "Removes the seeded customer testimonials from the homepage." },
  { key: "demo_offers", label: "Seeded offers & listings", sub: "Clears sample seller offers; games and products stay." },
  { key: "catalog", label: "Entire catalog", sub: "Games, categories, products, templates and every offer." },
  { key: "banners", label: "Banners", sub: "All homepage hero and promo banners." },
  { key: "cms", label: "Homepage CMS blocks", sub: "Hero, trust bar, review section headings." },
  { key: "nav", label: "Footer links", sub: "Every footer link column." },
  { key: "media", label: "Uploaded media", sub: "All images in the media library." },
];

/**
 * Danger-zone tool. Lets the client strip every piece of seeded content so
 * the live site shows only what they create in the admin panel.
 */
export default function ContentReset() {
  const router = useRouter();
  const [sel, setSel] = useState<PurgeScope[]>([]);
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  const toggle = (k: PurgeScope) =>
    setSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));

  return (
    <div className="rounded-2xl border border-rose-500/30 bg-rose-500/[0.04] p-5">
      <div className="flex items-center gap-2">
        <AlertTriangle size={15} className="text-rose-400" />
        <h3 className="text-[14px] font-black">Remove seeded content</h3>
      </div>
      <p className="mt-1.5 text-[11.5px] muted">
        Use this to clear the demo data shipped with the build so the site runs purely on content
        you add. Buyers, sellers, orders, wallets and admin accounts are never touched.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {SCOPES.map((s) => {
          const on = sel.includes(s.key);
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => toggle(s.key)}
              className={`rounded-xl border p-3 text-left transition-all ${
                on ? "border-rose-500/60 bg-rose-500/10" : "border-[var(--line)] hover:border-rose-500/40"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${
                    on ? "border-rose-500 bg-rose-500 text-white" : "border-[var(--line)]"
                  }`}
                >
                  {on && <Check size={10} />}
                </span>
                <span className="text-[12px] font-semibold">{s.label}</span>
              </div>
              <p className="mt-1 pl-6 text-[10.5px] muted">{s.sub}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <div className="min-w-[180px] flex-1">
          <label className="mb-1 block text-[11px] font-medium">
            Type <span className="font-mono font-bold text-rose-400">DELETE</span> to confirm
          </label>
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputCls}
            placeholder="DELETE"
          />
        </div>
        <Btn
          className="flex items-center gap-2 !bg-rose-600 hover:!bg-rose-500"
          disabled={pending || !sel.length || confirm.trim().toUpperCase() !== "DELETE"}
          onClick={() =>
            start(async () => {
              setErr("");
              setDone(false);
              const r = await purgeContentAction(sel, confirm);
              if (!r.ok) return setErr(r.error || "Could not remove content.");
              setSel([]);
              setConfirm("");
              setDone(true);
              router.refresh();
            })
          }
        >
          {pending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
          Remove selected
        </Btn>
      </div>

      {err && <div className="mt-2 text-[11.5px] text-rose-400">{err}</div>}
      {done && (
        <div className="mt-2 flex items-center gap-1.5 text-[11.5px] text-emerald-400">
          <Check size={12} /> Content removed. The site now reflects only your admin content.
        </div>
      )}
    </div>
  );
}
