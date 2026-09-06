"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, Ban, Sliders, X, Loader2, Star, ExternalLink, BadgeCheck, ShieldAlert,
} from "lucide-react";
import { Btn, Tag, Field, inputCls, Empty } from "@/components/ui";
import { Table, Tr, Td, Toolbar, IconAction } from "@/components/admin/ui";
import { money, statusTone, label } from "@/lib/fmt";
import { sellerStatusAction, sellerSettingsAction } from "@/lib/actions/admin";

type S = {
  user_id: string; name: string; email: string; store_name: string; slug: string;
  level: string; verified: number; status: string; rating: number; total_sales: number;
  commission_pct: number; available_bal: number; pending_bal: number; rank_order: number;
  custom_badge: string | null; featured: number; top_seller: number; show_homepage: number;
  offers: number; kyc_status: string | null;
};

const LEVELS = ["New Seller", "Rising Star", "Level 1", "Level 2", "Level 3", "Elite", "Power Seller"];

export default function SellersManager({ rows }: { rows: S[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<S | null>(null);
  const [busy, start] = useTransition();

  const setStatus = (s: S, status: string) => {
    if (status === "suspended" && !confirm(`Suspend ${s.store_name}? All their offers will be paused.`)) return;
    if (status === "active" && s.kyc_status !== "approved" &&
        !confirm("This seller has not passed ID verification. Approve anyway?")) return;
    start(async () => {
      await sellerStatusAction(s.user_id, status);
      router.refresh();
    });
  };

  if (!rows.length) return <Empty title="No sellers" sub="Nothing matches this filter." />;

  return (
    <div className="space-y-3">
      <Toolbar><span className="text-[11.5px] muted">{rows.length} stores</span></Toolbar>

      <Table head={["Store", "Level", "Offers", "Sales", "Balance", "Fee", "KYC", "Status", ""]}>
        {rows.map((s) => (
          <Tr key={s.user_id}>
            <Td>
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-brand-600 text-[11px] font-black text-white">
                  {(s.store_name || s.name).slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <div className="flex items-center gap-1 font-semibold">
                    {s.store_name}
                    {s.verified === 1 && <BadgeCheck size={12} className="text-brand-400" />}
                  </div>
                  <div className="text-[10px] muted">{s.email}</div>
                </div>
              </div>
            </Td>
            <Td>
              <div className="text-[11.5px]">{s.level}</div>
              <div className="flex items-center gap-0.5 text-[10px] muted">
                <Star size={9} className="fill-amber-400 text-amber-400" /> {Number(s.rating ?? 0).toFixed(1)}
              </div>
            </Td>
            <Td className="muted">{s.offers}</Td>
            <Td className="muted">{s.total_sales}</Td>
            <Td>
              <div className="text-[11.5px] font-semibold">{money(s.available_bal)}</div>
              <div className="text-[10px] muted">{money(s.pending_bal)} escrow</div>
            </Td>
            <Td className="muted">{Number(s.commission_pct)}%</Td>
            <Td>
              {s.kyc_status === "approved" ? (
                <Tag tone="green">Verified</Tag>
              ) : s.kyc_status ? (
                <Tag tone={statusTone(s.kyc_status)}>{label(s.kyc_status)}</Tag>
              ) : (
                <span className="flex items-center gap-1 text-[10.5px] text-rose-400">
                  <ShieldAlert size={10} /> None
                </span>
              )}
            </Td>
            <Td><Tag tone={statusTone(s.status)}>{label(s.status)}</Tag></Td>
            <Td>
              <div className="flex justify-end gap-1.5">
                <Link href={`/s/${s.slug}`} target="_blank">
                  <IconAction title="View store"><ExternalLink size={12} /></IconAction>
                </Link>
                <IconAction title="Settings" onClick={() => setEdit(s)}><Sliders size={12} /></IconAction>
                {s.status !== "active" ? (
                  <IconAction title="Approve / activate" disabled={busy} onClick={() => setStatus(s, "active")}>
                    <Check size={12} />
                  </IconAction>
                ) : (
                  <IconAction title="Suspend" danger disabled={busy} onClick={() => setStatus(s, "suspended")}>
                    <Ban size={12} />
                  </IconAction>
                )}
              </div>
            </Td>
          </Tr>
        ))}
      </Table>

      <AnimatePresence>
        {edit && <SellerForm s={edit} onClose={() => setEdit(null)} />}
      </AnimatePresence>
    </div>
  );
}

function SellerForm({ s, onClose }: { s: S; onClose: () => void }) {
  const router = useRouter();
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  const submit = (fd: FormData) =>
    start(async () => {
      setErr("");
      const r = await sellerSettingsAction(fd);
      if (!r.ok) return setErr(r.error || "Could not save.");
      onClose();
      router.refresh();
    });

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <motion.form
        action={submit}
        initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-[480px] space-y-3 overflow-y-auto rounded-2xl panel p-5"
      >
        <div className="flex items-center">
          <h2 className="text-[15px] font-black">{s.store_name}</h2>
          <button type="button" onClick={onClose} className="ml-auto rounded-lg p-1.5 soft hover:text-rose-400"><X size={15} /></button>
        </div>
        <input type="hidden" name="userId" value={s.user_id} />

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Seller level">
            <select name="level" defaultValue={s.level} className={inputCls}>
              {LEVELS.map((l) => <option key={l}>{l}</option>)}
            </select>
          </Field>
          <Field label="Commission %" hint="Taken from each sale">
            <input name="commission" type="number" step="0.5" min="0" max="50" defaultValue={Number(s.commission_pct)} className={inputCls} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Custom badge" hint="Optional label on the storefront">
            <input name="badge" defaultValue={s.custom_badge ?? ""} className={inputCls} placeholder="Trusted Partner" />
          </Field>
          <Field label="Homepage rank" hint="Lower shows first">
            <input name="rankOrder" type="number" defaultValue={s.rank_order ?? 0} className={inputCls} />
          </Field>
        </div>

        <div className="space-y-1.5 rounded-xl soft p-3">
          {[
            { n: "verified", l: "Verified badge", d: s.verified },
            { n: "topSeller", l: "Top Seller badge", d: s.top_seller },
            { n: "featured", l: "Recommended / featured", d: s.featured },
            { n: "showHomepage", l: "Show on homepage", d: s.show_homepage },
          ].map((c) => (
            <label key={c.n} className="flex cursor-pointer items-center gap-2 text-[12px]">
              <input type="checkbox" name={c.n} defaultChecked={c.d === 1} className="accent-brand-600" />
              {c.l}
            </label>
          ))}
        </div>

        {err && <div className="text-[11.5px] text-rose-400">{err}</div>}
        <div className="flex gap-2">
          <Btn className="flex items-center gap-2" disabled={pending}>
            {pending && <Loader2 size={13} className="animate-spin" />} Save
          </Btn>
          <Btn variant="ghost" type="button" onClick={onClose}>Cancel</Btn>
        </div>
      </motion.form>
    </motion.div>
  );
}
