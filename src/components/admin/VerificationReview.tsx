"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  BadgeCheck, X, Check, Loader2, FileText, Eye, ShieldAlert, ExternalLink, Copy,
} from "lucide-react";
import { Btn, Tag, Empty, inputCls } from "@/components/ui";
import { when, statusTone, label } from "@/lib/fmt";
import { idLabel, countryName } from "@/lib/kyc";
import { reviewVerificationAction } from "@/lib/actions/admin";

type V = {
  id: string; user_id: string; user_name: string; email: string; store_name: string;
  full_name: string; country: string; id_type: string; id_number: string; id_number_last4: string;
  dob: string | null; address: string | null;
  front_path: string; back_path: string | null; selfie_path: string | null;
  status: string; review_note: string | null; submitted_at: string; reviewed_at: string | null;
};

export default function VerificationReview({ rows }: { rows: V[] }) {
  const [open, setOpen] = useState<V | null>(null);

  if (!rows.length)
    return <Empty title="Nothing here" sub="No verifications match this filter." />;

  return (
    <>
      <div className="space-y-2.5">
        {rows.map((v) => (
          <motion.div key={v.id} layout className="flex flex-wrap items-center gap-3 rounded-2xl panel p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-brand-600 text-[13px] font-black text-white">
              {(v.full_name || v.user_name || "?").slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-[190px] flex-1">
              <div className="text-[13px] font-bold">{v.full_name}</div>
              <div className="text-[11px] muted">
                {v.store_name ? `${v.store_name} · ` : ""}{v.email}
              </div>
              <div className="mt-0.5 text-[10.5px] muted">
                {countryName(v.country)} · {idLabel(v.id_type)} ••••{v.id_number_last4} · {when(v.submitted_at)}
              </div>
            </div>
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
  const [zoom, setZoom] = useState<string | null>(null);

  const decide = (decision: "approved" | "rejected" | "resubmit") =>
    start(async () => {
      setErr("");
      const r = await reviewVerificationAction(v.id, decision, note);
      if (!r.ok) return setErr(r.error || "Could not save the decision.");
      onClose();
      router.refresh();
    });

  const docs = [
    { key: v.front_path, label: "Front of ID" },
    { key: v.back_path, label: "Back of ID" },
    { key: v.selfie_path, label: "Selfie with ID" },
  ].filter((d) => d.key);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-[820px] overflow-y-auto rounded-2xl panel p-5"
      >
        <div className="mb-4 flex items-center gap-2">
          <BadgeCheck size={17} className="text-brand-400" />
          <h2 className="text-[16px] font-black">Identity review</h2>
          <Tag tone={statusTone(v.status)}>{label(v.status)}</Tag>
          <button onClick={onClose} className="ml-auto rounded-lg p-1.5 soft hover:text-rose-400">
            <X size={15} />
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Row l="Legal name" v={v.full_name} />
            <Row l="Account" v={`${v.user_name} · ${v.email}`} />
            <Row l="Store" v={v.store_name || "—"} />
            <Row l="Country" v={countryName(v.country)} />
            <Row l="Document" v={idLabel(v.id_type)} />
            <Row l="ID number" v={v.id_number} copy />
            <Row l="Date of birth" v={v.dob || "—"} />
            <Row l="Address" v={v.address || "—"} />
            <Row l="Submitted" v={when(v.submitted_at)} />
          </div>

          <div className="space-y-2">
            <div className="text-[11.5px] font-semibold muted">Documents</div>
            <div className="grid grid-cols-2 gap-2">
              {docs.map((d) => (
                <button
                  key={d.key}
                  onClick={() => setZoom(`/api/kyc/${d.key}`)}
                  className="group relative overflow-hidden rounded-xl border border-[var(--line)] soft"
                >
                  {d.key!.endsWith(".pdf") ? (
                    <div className="grid h-[110px] place-items-center">
                      <FileText size={22} className="text-brand-400" />
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/kyc/${d.key}`} alt={d.label} className="h-[110px] w-full object-cover" />
                  )}
                  <div className="flex items-center gap-1 px-2 py-1.5 text-[10px]">
                    <span className="flex-1 text-left">{d.label}</span>
                    <ExternalLink size={10} className="muted" />
                  </div>
                </button>
              ))}
            </div>
            <div className="flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-2 text-[10.5px]">
              <ShieldAlert size={12} className="mt-0.5 shrink-0 text-amber-400" />
              <span className="muted">
                Check the name and number match exactly, the photo is legible, and the document is
                not expired. Every view is audit-logged.
              </span>
            </div>
          </div>
        </div>

        {v.review_note && (
          <div className="mt-3 rounded-lg soft p-2.5 text-[11.5px]">
            <span className="muted">Previous note: </span>{v.review_note}
          </div>
        )}

        {v.status === "pending" && (
          <div className="mt-4 border-t border-[var(--line)] pt-3">
            <textarea
              rows={2}
              className={inputCls}
              placeholder="Reason / note to the seller (required when rejecting)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            {err && <div className="mt-2 text-[11.5px] text-rose-400">{err}</div>}
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn className="flex items-center gap-2" disabled={pending} onClick={() => decide("approved")}>
                {pending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Approve & activate
              </Btn>
              <Btn variant="ghost" disabled={pending} onClick={() => decide("resubmit")}>
                Ask to resubmit
              </Btn>
              <button
                onClick={() => decide("rejected")}
                disabled={pending}
                className="rounded-lg px-4 py-2.5 text-[12.5px] font-semibold text-rose-400 hover:bg-rose-500/10 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {zoom && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => { e.stopPropagation(); setZoom(null); }}
            className="fixed inset-0 z-[95] grid place-items-center bg-black/90 p-6"
          >
            {zoom.endsWith(".pdf") ? (
              <iframe src={zoom} className="h-[85vh] w-[85vw] rounded-xl bg-white" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={zoom} alt="" className="max-h-[88vh] max-w-[92vw] rounded-xl object-contain" />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Row({ l, v, copy }: { l: string; v: string; copy?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-lg soft px-3 py-2">
      <span className="w-[104px] shrink-0 text-[10.5px] muted">{l}</span>
      <span className="min-w-0 flex-1 break-words text-[12px] font-medium">{v}</span>
      {copy && (
        <button
          onClick={() => {
            navigator.clipboard?.writeText(v);
            setDone(true);
            setTimeout(() => setDone(false), 1200);
          }}
          className="shrink-0 muted hover:text-brand-400"
        >
          {done ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
        </button>
      )}
    </div>
  );
}
