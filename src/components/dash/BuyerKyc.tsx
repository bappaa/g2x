"use client";
import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ShieldCheck, Upload, Loader2, CheckCircle2, Clock, XCircle,
  IdCard, ScanFace, AlertCircle, Lock,
} from "lucide-react";
import { Btn, Field, inputCls } from "@/components/ui";
import { COUNTRIES, idTypesFor } from "@/lib/kyc";
import { submitBuyerKycAction } from "@/lib/actions/buyer-kyc";

type Row = {
  status: string;
  full_name: string;
  review_note: string | null;
  submitted_at: string;
  reviewed_at: string | null;
} | null;

export default function BuyerKyc({
  current,
  threshold,
  spendable,
  due = false,
  dueReason = null,
}: {
  current: Row;
  threshold: number;
  spendable: boolean;
  /** True when a completed payment has left an outstanding identity check. */
  due?: boolean;
  dueReason?: string | null;
}) {
  const router = useRouter();
  const [country, setCountry] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const types = idTypesFor(country);

  const status = current?.status ?? "none";
  const locked = status === "pending" || status === "approved";

  const submit = (fd: FormData) =>
    start(async () => {
      setErr("");
      const r = await submitBuyerKycAction(fd);
      if (!r.ok) return setErr(r.error || "Could not submit. Please try again.");
      router.refresh();
    });

  return (
    <div className="space-y-4">
      {/* ---------------------------- status ---------------------------- */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl panel p-4 sm:p-5"
      >
        <div className="flex items-start gap-3">
          <span
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
              status === "approved"
                ? "bg-emerald-500/15 text-emerald-400"
                : status === "pending"
                ? "bg-amber-500/15 text-amber-400"
                : status === "rejected"
                ? "bg-rose-500/15 text-rose-400"
                : "bg-brand-600/15 text-brand-400"
            }`}
          >
            {status === "approved" ? <CheckCircle2 size={19} /> :
             status === "pending" ? <Clock size={19} /> :
             status === "rejected" ? <XCircle size={19} /> : <ShieldCheck size={19} />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-black sm:text-[17px]">
              {status === "approved" ? "You're verified" :
               status === "pending" ? "Under review" :
               status === "rejected" ? "Verification rejected" :
               status === "resubmit" ? "Resubmission needed" :
               due ? "Confirm your identity" :
               "Verify your identity"}
            </h2>
            <p className="mt-1 text-[12px] leading-relaxed muted">
              {status === "approved"
                ? "Deposits and purchases of any amount are unlocked on your account."
                : status === "pending"
                ? "Our team is checking your documents. This usually takes a few hours — we'll email you the moment it's done."
                : due
                ? `Your recent transaction${dueReason ? ` (${dueReason})` : ""} completed successfully. Because it was $${threshold} or more, please confirm your identity below to keep your account fully active.`
                : `If you deposit or spend $${threshold} or more in a single transaction, we'll ask you to confirm your identity afterwards. You can also complete it now to get it out of the way.`}
            </p>
            {current?.review_note && status !== "approved" && (
              <div className="mt-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11.5px] text-amber-300">
                <strong>Reviewer note:</strong> {current.review_note}
              </div>
            )}
          </div>
        </div>

        {!spendable && status !== "approved" && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-brand-600/10 px-3 py-2 text-[11.5px]">
            <Lock size={13} className="mt-px shrink-0 text-brand-400" />
            <span>
              Payments are never blocked while this is outstanding — you can keep buying and
              topping up as normal.
            </span>
          </div>
        )}
      </motion.div>

      {/* ----------------------------- form ----------------------------- */}
      {!locked && (
        <form action={submit} className="space-y-4">
          <div className="rounded-2xl panel p-4 sm:p-5">
            <h3 className="text-[14px] font-bold">1. Your details</h3>
            <p className="mt-1 text-[11.5px] muted">
              These must match your ID exactly, or the check will be rejected.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Full legal name">
                <input name="fullName" required className={inputCls} placeholder="As printed on your ID" />
              </Field>
              <Field label="Date of birth">
                <input name="dob" type="date" className={inputCls} />
              </Field>
              <Field label="Country">
                <select
                  name="country"
                  value={country}
                  required
                  onChange={(e) => setCountry(e.target.value)}
                  className={inputCls}
                >
                  {/* No pre-selected country — the visitor picks their own. */}
                  <option value="" disabled>Select country</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="ID type">
                <select name="idType" required className={inputCls}>
                  {types.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </Field>
              <div className="sm:col-span-2">
                <Field label="ID number" hint="Stored encrypted — only the last 4 digits are shown to staff.">
                  <input name="idNumber" required className={inputCls} placeholder="e.g. ABCDE1234F" />
                </Field>
              </div>
            </div>
          </div>

          <div className="rounded-2xl panel p-4 sm:p-5">
            <h3 className="text-[14px] font-bold">2. Photos</h3>
            <p className="mt-1 text-[11.5px] muted">
              JPG, PNG or WEBP, up to 8 MB each. Make sure all text is readable and nothing is cropped.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <PhotoInput
                name="idPhoto"
                label="Photo of your ID"
                hint="Front side, all four corners visible"
                icon={<IdCard size={18} />}
              />
              <PhotoInput
                name="facePhoto"
                label="Photo of your face"
                hint="Clear selfie, no sunglasses or hat"
                icon={<ScanFace size={18} />}
              />
            </div>
          </div>

          {err && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-[11.5px] text-rose-400">
              <AlertCircle size={13} className="mt-px shrink-0" /> {err}
            </div>
          )}

          <div className="rounded-2xl panel p-4 sm:p-5">
            <div className="flex items-start gap-2 text-[11px] muted">
              <Lock size={12} className="mt-px shrink-0" />
              <span>
                Your documents are stored privately, are never shown publicly, and are only
                accessible to G2X compliance staff. Every access is audit-logged.
              </span>
            </div>
            <Btn className="mt-3.5 flex w-full items-center justify-center gap-2 sm:w-auto" disabled={pending}>
              {pending ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
              {pending ? "Submitting…" : "Submit for verification"}
            </Btn>
          </div>
        </form>
      )}
    </div>
  );
}

function PhotoInput({
  name, label, hint, icon,
}: { name: string; label: string; hint: string; icon: React.ReactNode }) {
  const [file, setFile] = useState<string>("");
  const [preview, setPreview] = useState<string>("");
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div>
      <div className="mb-1.5 text-[11.5px] font-semibold">{label}</div>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="flex w-full items-center gap-3 rounded-xl border border-dashed border-[var(--line)] soft p-3 text-left transition hover:border-brand-500 active:scale-[.99]"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-brand-600/15 text-brand-400">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            icon
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-semibold">
            {file || "Tap to upload"}
          </span>
          <span className="block truncate text-[10.5px] muted">{hint}</span>
        </span>
        <Upload size={14} className="shrink-0 muted" />
      </button>
      <input
        ref={ref}
        name={name}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture={name === "facePhoto" ? "user" : undefined}
        required
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setFile(f.name);
          setPreview(URL.createObjectURL(f));
        }}
      />
    </div>
  );
}
