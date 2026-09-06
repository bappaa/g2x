"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, X, Loader2, Eye, EyeOff, Calculator } from "lucide-react";
import { Btn, Tag, Field, inputCls, Empty } from "@/components/ui";
import { Toolbar, IconAction } from "@/components/admin/ui";
import { AnyLogo } from "@/components/BrandIcon";
import {
  saveGatewayAction, toggleGatewayAction, deleteGatewayAction,
} from "@/lib/actions/admin";

type G = {
  id: string; code: string; name: string; logo: string;
  fee_percent: number; fee_fixed: number; min_amount: number; max_amount: number;
  enabled: number; for_topup: number; for_checkout: number;
  sort_order: number; note: string;
};

const feeLabel = (g: G) => {
  const p = Number(g.fee_percent) || 0;
  const f = Number(g.fee_fixed) || 0;
  if (!p && !f) return "No fee";
  return [p ? `${p}%` : "", f ? `$${f.toFixed(2)}` : ""].filter(Boolean).join(" + ");
};

export default function GatewaysManager({ rows }: { rows: G[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<G | "new" | null>(null);
  const [busy, start] = useTransition();
  const [err, setErr] = useState("");

  return (
    <div className="space-y-3">
      <Toolbar>
        <span className="text-[11.5px] muted">
          {rows.filter((r) => r.enabled).length} of {rows.length} methods live
        </span>
        <div className="ml-auto">
          <Btn className="flex items-center gap-1.5" onClick={() => setEdit("new")}>
            <Plus size={13} /> Add gateway
          </Btn>
        </div>
      </Toolbar>

      <div className="rounded-xl bg-brand-600/10 px-3 py-2 text-[11.5px]">
        Fees are charged on top of the order total and shown to the buyer before they pay.
        Changing a fee never alters orders that were already placed.
      </div>

      {err && <div className="rounded-lg bg-rose-500/10 px-3 py-2 text-[11.5px] text-rose-400">{err}</div>}

      {rows.length === 0 ? (
        <Empty title="No payment methods" sub="Add one so buyers can pay." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((g) => (
            <motion.div key={g.id} layout className="rounded-2xl panel p-4">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/90">
                  {g.logo ? <AnyLogo logo={g.logo} size={18} /> : <Calculator size={16} className="text-slate-700" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold">{g.name}</div>
                  <div className="truncate font-mono text-[10px] muted">{g.code}</div>
                </div>
                <Tag tone={g.enabled ? "green" : "slate"}>{g.enabled ? "Live" : "Off"}</Tag>
              </div>

              <div className="mt-3 space-y-1 rounded-lg soft p-2.5 text-[11.5px]">
                <div className="flex justify-between">
                  <span className="muted">Fee</span>
                  <span className="font-bold text-amber-400">{feeLabel(g)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="muted">Limits</span>
                  <span className="font-semibold">
                    {g.min_amount > 0 ? `$${g.min_amount}` : "$0"} –{" "}
                    {g.max_amount > 0 ? `$${g.max_amount}` : "∞"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="muted">Used for</span>
                  <span className="font-semibold">
                    {[g.for_topup && "Top-up", g.for_checkout && "Checkout"].filter(Boolean).join(" · ") || "—"}
                  </span>
                </div>
              </div>

              {g.note && <p className="mt-2 line-clamp-2 text-[10.5px] muted">{g.note}</p>}

              <div className="mt-2.5 flex gap-1.5">
                <IconAction
                  title={g.enabled ? "Disable" : "Enable"}
                  disabled={busy}
                  onClick={() =>
                    start(async () => {
                      await toggleGatewayAction(g.id, !g.enabled);
                      router.refresh();
                    })
                  }
                >
                  {g.enabled ? <EyeOff size={12} /> : <Eye size={12} />}
                </IconAction>
                <IconAction title="Edit" onClick={() => setEdit(g)}><Pencil size={12} /></IconAction>
                <IconAction
                  title="Delete" danger disabled={busy}
                  onClick={() => {
                    if (!confirm(`Remove ${g.name}? Buyers will no longer see it.`)) return;
                    start(async () => {
                      setErr("");
                      const r = await deleteGatewayAction(g.id);
                      if (!r.ok) setErr(r.error || "Could not delete.");
                      router.refresh();
                    });
                  }}
                >
                  <Trash2 size={12} />
                </IconAction>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {edit && (
          <Form g={edit === "new" ? null : edit} count={rows.length} onClose={() => setEdit(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function Form({ g, count, onClose }: { g: G | null; count: number; onClose: () => void }) {
  const router = useRouter();
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  // live preview of what a buyer would pay
  const [pct, setPct] = useState(Number(g?.fee_percent ?? 0));
  const [fixed, setFixed] = useState(Number(g?.fee_fixed ?? 0));
  const sample = 100;
  const sampleFee = Math.round((sample * (pct / 100) + fixed) * 100) / 100;

  const submit = (fd: FormData) =>
    start(async () => {
      setErr("");
      const r = await saveGatewayAction(fd);
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
          <h2 className="text-[15px] font-black">{g ? "Edit gateway" : "Add gateway"}</h2>
          <button type="button" onClick={onClose} className="ml-auto rounded-lg p-1.5 soft hover:text-rose-400">
            <X size={15} />
          </button>
        </div>
        <input type="hidden" name="id" value={g?.id ?? ""} />

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Display name">
            <input name="name" required defaultValue={g?.name} className={inputCls} placeholder="Card" />
          </Field>
          <Field label="Code" hint="Lowercase identifier">
            <input
              name="code" required defaultValue={g?.code}
              readOnly={g?.code === "wallet"}
              className={inputCls} placeholder="card"
            />
          </Field>
        </div>

        <Field label="Logo" hint="Brand icon name: visa, upi, paypal, mastercard…">
          <input name="logo" defaultValue={g?.logo} className={inputCls} placeholder="visa" />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Percentage fee (%)">
            <input
              name="feePercent" type="number" step="0.01" min="0" max="100"
              value={pct}
              onChange={(e) => setPct(Number(e.target.value) || 0)}
              className={inputCls}
            />
          </Field>
          <Field label="Fixed fee ($)">
            <input
              name="feeFixed" type="number" step="0.01" min="0"
              value={fixed}
              onChange={(e) => setFixed(Number(e.target.value) || 0)}
              className={inputCls}
            />
          </Field>
        </div>

        {/* live worked example so the admin sees the real effect */}
        <div className="space-y-1 rounded-lg soft p-3 text-[11.5px]">
          <div className="mb-1 flex items-center gap-1.5 font-semibold">
            <Calculator size={12} /> On a $100 order the buyer pays
          </div>
          <div className="flex justify-between"><span className="muted">Order</span><span>$100.00</span></div>
          <div className="flex justify-between">
            <span className="muted">Gateway fee</span>
            <span className="text-amber-400">${sampleFee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-t border-[var(--line)] pt-1 font-bold">
            <span>Total</span>
            <span className="text-brand-400">${(100 + sampleFee).toFixed(2)}</span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Min amount ($)">
            <input name="minAmount" type="number" step="0.01" min="0" defaultValue={g?.min_amount ?? 0} className={inputCls} />
          </Field>
          <Field label="Max amount ($)" hint="0 = no limit">
            <input name="maxAmount" type="number" step="0.01" min="0" defaultValue={g?.max_amount ?? 0} className={inputCls} />
          </Field>
          <Field label="Sort order">
            <input name="sortOrder" type="number" defaultValue={g?.sort_order ?? count} className={inputCls} />
          </Field>
        </div>

        <Field label="Note shown to buyers">
          <input name="note" defaultValue={g?.note} className={inputCls} placeholder="Visa / Mastercard / Amex" />
        </Field>

        <div className="space-y-1.5">
          <label className="flex cursor-pointer items-center gap-2 text-[12px]">
            <input type="checkbox" name="enabled" defaultChecked={g ? g.enabled === 1 : true} className="accent-brand-600" />
            Enabled — buyers can select it
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[12px]">
            <input type="checkbox" name="forTopup" defaultChecked={g ? g.for_topup === 1 : true} className="accent-brand-600" />
            Available for wallet top-ups
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[12px]">
            <input type="checkbox" name="forCheckout" defaultChecked={g ? g.for_checkout === 1 : true} className="accent-brand-600" />
            Available at checkout
          </label>
        </div>

        {err && <div className="text-[11.5px] text-rose-400">{err}</div>}
        <div className="flex gap-2">
          <Btn className="flex items-center gap-2" disabled={pending}>
            {pending && <Loader2 size={13} className="animate-spin" />} Save gateway
          </Btn>
          <Btn variant="ghost" type="button" onClick={onClose}>Cancel</Btn>
        </div>
      </motion.form>
    </motion.div>
  );
}
