"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Check, Loader2, Eye, ShieldAlert, ExternalLink, RotateCcw, Wallet,
} from "lucide-react";
import { Btn, Tag, Empty, inputCls } from "@/components/ui";
import { when, statusTone, label, money } from "@/lib/fmt";
import { idLabel, countryName } from "@/lib/kyc";
import { reviewBuyerKycAction } from "@/lib/actions/admin";

type V = {
  id: string; user_id: string; user_name: string; email: string; balance: number;
  full_name: string; country: string; id_type: string; id_number: string;
  id_number_last4: string; dob: string | null;
  id_photo_path: string; face_photo_path: string;
  status: string; review_note: string | null; submitted_at: string; reviewed_at: string | null;
};

export default function BuyerKycReview({ rows }: { rows: V[] }) {
  const [open, setOpen] = useState<V | null>(null);

  if (!rows.length)
    return <Empty title="Nothing to review" sub="No buyer identity checks match this filter." />;

  return (
    <>
      <div className="space-y-2.5">
        {rows.map((v) => (
          <motion.div key={v.id} layout className="flex flex-wrap items-center gap-3 rounded-2xl panel p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky-400 to-brand-600 text-[13px] font-black text-white">
              {(v.full_name || v.user_name || "?").slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-[190px] flex-1">
              <div className="text-[13px] font-bold">{v.full_name}</div>
              <div className="text-[11px] muted">{v.email}</div>
              <div className="mt-0.5 text-[10.5px] muted">
                {countryName(v.country)} · {idLabel(v.id_type)} ••••{v.id_number_last4} · {when(v.submitted_at)}
              </div>
            </div>
            <span className="flex items-center gap-1 text-[11px] muted">
              <Wallet size={11} /> {money(Number(v.balance ?? 0))}
            </span>
            <Tag tone={statusTone(v.status)}>{label(v.status)}</Tag>
            <Btn variant="ghost" className="flex items-center gap-1.5" onClick={() => setOpen(v)}>
              <Eye size={13} /> Review
            </Btn>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>{open && <Modal v={open} onClose={() => setOpen(null)} />}</AnimatePresence>
    </>
  );
}

function Modal({ v, onClose }: { v: V; onClose: () => void }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  const decide = (decision: "approved" | "rejected" | "resubmit") =>
    start(async () => {
      setErr("");
      const r = await reviewBuyerKycAction(v.id, decision, note);
      if (!r.ok) return setErr(r.error || "Could not save that decision.");
      onClose();
      router.refresh();
    });

  const done = v.status !== "pending";

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[90] grid place-items-center bg-black/75 p-3 backdrop-blur-sm sm:p-4"
    >
      <motion.div
        initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-[720px] overflow-y-auto rounded-2xl panel p-4 sm:p-5"
      >
        <div className="flex items-center">
          <div>
            <h2 className="text-[15px] font-black sm:text-[17px]">{v.full_name}</h2>
            <p className="text-[11.5px] muted">{v.email}</p>
          </div>
          <button onClick={onClose} className="ml-auto rounded-lg p-1.5 soft hover:text-rose-400">
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Row k="Country" v={countryName(v.country)} />
          <Row k="ID type" v={idLabel(v.id_type)} />
          <Row k="ID number" v={v.id_number} mono />
          <Row k="Date of birth" v={v.dob || "—"} />
          <Row k="Wallet balance" v={money(Number(v.balance ?? 0))} />
          <Row k="Submitted" v={when(v.submitted_at)} />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Doc label="ID document" path={v.id_photo_path} />
          <Doc label="Face photo" path={v.face_photo_path} />
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
          <ShieldAlert size={13} className="mt-px shrink-0" />
          Check the face photo matches the ID, the name matches exactly, and the document is not
          expired or visibly edited. Your decision is audit-logged.
        </div>

        {done ? (
          <div className="mt-4 rounded-lg soft p-3 text-[12px]">
            Already <strong>{label(v.status)}</strong>
            {v.reviewed_at ? ` on ${when(v.reviewed_at)}` : ""}.
            {v.review_note && <div className="mt-1 muted">Note: {v.review_note}</div>}
          </div>
        ) : (
          <>
            <div className="mt-4">
              <div className="mb-1.5 text-[11.5px] font-semibold">
                Reviewer note <span className="muted">(required to reject or ask for a resubmission)</span>
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className={inputCls}
                placeholder="e.g. The face photo is too blurry to compare against the ID."
              />
            </div>

            {err && <div className="mt-2 text-[11.5px] text-rose-400">{err}</div>}

            <div className="mt-3 flex flex-wrap gap-2">
              <Btn className="flex items-center gap-1.5" disabled={pending} onClick={() => decide("approved")}>
                {pending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Approve
              </Btn>
              <Btn variant="ghost" className="flex items-center gap-1.5" disabled={pending} onClick={() => decide("resubmit")}>
                <RotateCcw size={13} /> Ask to resubmit
              </Btn>
              <Btn variant="ghost" className="flex items-center gap-1.5 !text-rose-400" disabled={pending} onClick={() => decide("rejected")}>
                <X size={13} /> Reject
              </Btn>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="rounded-lg soft px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide muted">{k}</div>
      <div className={`text-[12.5px] font-semibold ${mono ? "font-mono" : ""}`}>{v}</div>
    </div>
  );
}

function Doc({ label: l, path }: { label: string; path: string }) {
  return (
    <a
      href={`/api/kyc/${path}`}
      target="_blank"
      rel="noreferrer"
      className="group block overflow-hidden rounded-xl border border-[var(--line)] soft"
    >
      <div className="relative h-[170px] w-full bg-black/30">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/kyc/${path}`} alt={l} className="h-full w-full object-contain" />
      </div>
      <div className="flex items-center gap-1.5 px-3 py-2 text-[11.5px] font-semibold group-hover:text-brand-400">
        {l} <ExternalLink size={11} className="ml-auto" />
      </div>
    </a>
  );
}
