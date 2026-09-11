"use client";
import Link from "next/link";
import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Store, Check, Loader2, TrendingUp, Wallet, ShieldCheck, Clock, Upload, X, FileText,
  IdCard, AlertCircle, Lock, Camera,
} from "lucide-react";
import { Btn, Field, inputCls, Tag } from "@/components/ui";
import { COUNTRIES, idTypesFor, idLabel, countryName } from "@/lib/kyc";
import { submitVerificationAction } from "@/lib/actions/kyc";

import LocalTime from "@/components/LocalTime";

type Cat = { slug: string; name: string };
type Profile = { store_name: string; slug: string; description: string; primary_cat: string; status: string } | null;
type Verification = {
  id: string; full_name: string; country: string; id_type: string; id_number_last4: string;
  status: string; review_note: string | null; submitted_at: string; reviewed_at: string | null;
} | null;

const PERKS = [
  { icon: TrendingUp, t: "Reach 2M+ gamers", d: "Your offers appear on every matching product page." },
  { icon: Wallet, t: "8% flat commission", d: "No listing fees. You keep 92% of every sale." },
  { icon: ShieldCheck, t: "Escrow protection", d: "Funds are secured at checkout, released on delivery." },
  { icon: Clock, t: "Fast payouts", d: "Withdraw to bank, PayPal or crypto from $10." },
];

const STEPS = ["Store details", "Identity verification", "Admin review"];

export default function BecomeSeller({
  profile, categories, verification,
}: {
  profile: Profile; categories: Cat[]; verification: Verification;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [country, setCountry] = useState("");
  const [idType, setIdType] = useState("aadhaar");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  const [storeName, setStoreName] = useState(profile?.store_name ?? "");
  const [primaryCat, setPrimaryCat] = useState(profile?.primary_cat ?? categories[0]?.slug ?? "top-up");
  const [description, setDescription] = useState(profile?.description ?? "");

  const status = profile?.status;
  const vStatus = verification?.status;

  /* ------------------------- already approved ------------------------- */
  if (status === "active")
    return (
      <div className="space-y-4">
        <h1 className="text-[18px] font-black sm:text-[22px] tracking-tight">Seller Account</h1>
        <div className="rounded-2xl panel p-4 sm:p-6 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-500/15 text-emerald-400">
            <Check size={24} />
          </span>
          <h2 className="mt-3 text-[16px] font-bold">{profile?.store_name} is live</h2>
          <p className="mt-1 text-[12.5px] muted">
            Identity verified. Manage offers, orders and payouts from your seller panel.
          </p>
          <Link href="/seller">
            <Btn className="mt-4">Open Seller Panel</Btn>
          </Link>
        </div>
      </div>
    );

  /* --------------------------- under review --------------------------- */
  if (vStatus === "pending")
    return (
      <div className="space-y-4">
        <h1 className="text-[18px] font-black sm:text-[22px] tracking-tight">Become a Seller</h1>
        <Stepper step={2} />
        <div className="rounded-2xl panel p-4 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-amber-500/15 text-amber-400">
              <Clock size={20} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-bold">Verification under review</h2>
                <Tag tone="amber">Pending</Tag>
              </div>
              <p className="mt-1 text-[12.5px] muted">
                We&apos;re checking the {idLabel(verification!.id_type)} ending in{" "}
                <b>••••{verification!.id_number_last4}</b> ({countryName(verification!.country)}) that you
                submitted on <LocalTime at={verification!.submitted_at} />. Reviews usually finish within 24–48 hours,
                and you&apos;ll get a notification the moment it&apos;s done.
              </p>
              <div className="mt-3 rounded-lg soft p-3 text-[11.5px]">
                <div className="font-semibold">Submitted details</div>
                <div className="mt-1 muted">
                  {verification!.full_name} · {countryName(verification!.country)} ·{" "}
                  {idLabel(verification!.id_type)} · Store: {profile?.store_name}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );

  /* ---------------------------- rejected ------------------------------ */
  const rejected = vStatus === "rejected" || vStatus === "resubmit";

  return (
    <div className="space-y-4">
      <h1 className="text-[18px] font-black sm:text-[22px] tracking-tight">Become a Seller</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {PERKS.map((p, i) => (
          <motion.div
            key={p.t}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="rounded-2xl panel p-4"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600/15 text-brand-400">
              <p.icon size={15} />
            </span>
            <div className="mt-2 text-[12.5px] font-bold">{p.t}</div>
            <div className="mt-0.5 text-[11px] muted">{p.d}</div>
          </motion.div>
        ))}
      </div>

      {rejected && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[12.5px] text-rose-400">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <div>
            <b>Verification {vStatus === "resubmit" ? "needs changes" : "was rejected"}.</b>
            {verification?.review_note && <div className="mt-0.5">{verification.review_note}</div>}
            <div className="mt-0.5 opacity-80">Please correct the details and submit again.</div>
          </div>
        </div>
      )}

      <Stepper step={step} />

      <form
        action={(fd) =>
          start(async () => {
            setErr("");
            const r = await submitVerificationAction(fd);
            if (!r.ok) {
              setErr(r.error || "Could not submit verification.");
              return;
            }
            router.refresh();
          })
        }
        className="space-y-4"
      >
        {/* -------------------------- step 1 -------------------------- */}
        <div className={step === 0 ? "" : "hidden"}>
          <div className="rounded-2xl panel p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2 text-[14px] font-bold">
              <Store size={15} className="text-brand-400" /> Store details
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Store name" hint="This is what buyers see on your offers.">
                <input
                  name="storeName"
                  className={inputCls}
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="QuickTopup Store"
                />
              </Field>
              <Field label="Primary category">
                <select name="primaryCat" className={inputCls} value={primaryCat} onChange={(e) => setPrimaryCat(e.target.value)}>
                  {categories.map((c) => (
                    <option key={c.slug} value={c.slug}>{c.name}</option>
                  ))}
                </select>
              </Field>
              <div className="sm:col-span-2">
                <Field label="Tell buyers about your store">
                  <textarea
                    name="description"
                    rows={3}
                    className={inputCls}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Instant top-ups, 24/7 delivery, 5 years of experience…"
                  />
                </Field>
              </div>
            </div>
            <Btn
              type="button"
              className="mt-3"
              onClick={() => {
                if (storeName.trim().length < 3) return setErr("Store name must be at least 3 characters.");
                setErr("");
                setStep(1);
              }}
            >
              Continue to verification
            </Btn>
            {err && step === 0 && <div className="mt-2 text-[11.5px] text-rose-400">{err}</div>}
          </div>
        </div>

        {/* -------------------------- step 2 -------------------------- */}
        <div className={step === 1 ? "space-y-4" : "hidden"}>
          <div className="rounded-2xl panel p-4 sm:p-5">
            <div className="mb-1 flex items-center gap-2 text-[14px] font-bold">
              <IdCard size={15} className="text-brand-400" /> Identity verification
            </div>
            <p className="mb-3 text-[11.5px] muted">
              Every seller must be verified before they can list. This protects buyers and keeps the
              marketplace free of fraud.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Full legal name" hint="Exactly as printed on your ID.">
                <input name="fullName" className={inputCls} placeholder="Rahul Kumar Sharma" required />
              </Field>
              <Field label="Date of birth">
                <input name="dob" type="date" className={inputCls} />
              </Field>
              <Field label="Country">
                <select
                  name="country"
                  className={inputCls}
                  value={country}
                  required
                  onChange={(e) => {
                    setCountry(e.target.value);
                    setIdType(idTypesFor(e.target.value)[0]?.value ?? "passport");
                  }}
                >
                  {/* No pre-selected country — the seller picks their own. */}
                  <option value="" disabled>Select country</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="ID document type">
                <select name="idType" className={inputCls} value={idType} onChange={(e) => setIdType(e.target.value)}>
                  {idTypesFor(country).map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </Field>
              <Field
                label="ID number"
                hint={
                  idType === "aadhaar" ? "12 digits" :
                  idType === "pan" ? "Format: ABCDE1234F" :
                  "As printed on the document"
                }
              >
                <input name="idNumber" className={inputCls} placeholder="XXXX XXXX XXXX" required />
              </Field>
              <Field label="Address" hint="Optional but speeds up approval.">
                <input name="address" className={inputCls} placeholder="City, State" />
              </Field>
            </div>
          </div>

          <div className="rounded-2xl panel p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2 text-[14px] font-bold">
              <Upload size={15} className="text-brand-400" /> Document photos
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <FileDrop name="front" label="Front of ID" required icon={IdCard} />
              <FileDrop name="back" label="Back of ID" icon={FileText} />
              <FileDrop name="selfie" label="Selfie holding ID" icon={Camera} />
            </div>

            <div className="mt-3 flex items-start gap-2 rounded-lg bg-brand-600/10 px-3 py-2.5 text-[11.5px]">
              <Lock size={13} className="mt-0.5 shrink-0 text-brand-400" />
              <span className="muted">
                Your documents are stored privately and encrypted at rest. They are visible only to our
                verification team, are never shown to buyers or other sellers, and are deleted 90 days
                after your account closes.
              </span>
            </div>

            <label className="mt-3 flex items-start gap-2 text-[12px]">
              <input type="checkbox" required className="mt-0.5 accent-[#8b3dff]" />
              <span>
                I confirm this ID is genuine and belongs to me, and I accept the{" "}
                <Link href="/p/terms" className="text-brand-400 hover:underline">Seller Terms</Link>.
              </span>
            </label>

            {err && step === 1 && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-rose-500/10 px-3 py-2 text-[11.5px] text-rose-400">
                <AlertCircle size={13} /> {err}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <Btn className="flex items-center gap-2" disabled={pending}>
                {pending && <Loader2 size={13} className="animate-spin" />} Submit for verification
              </Btn>
              <Btn type="button" variant="ghost" onClick={() => setStep(0)}>
                Back
              </Btn>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <div className="flex flex-wrap gap-y-3 rounded-2xl panel p-4">
      {STEPS.map((s, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <div key={s} className="flex min-w-[140px] flex-1 items-center gap-2">
            <span
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                done ? "bg-emerald-500 text-white" : active ? "bg-brand-600 text-white" : "soft muted"
              }`}
            >
              {done ? <Check size={13} /> : i + 1}
            </span>
            <span className={`text-[11.5px] ${active || done ? "font-semibold" : "muted"}`}>{s}</span>
            {i < STEPS.length - 1 && (
              <span className={`mx-1 hidden h-px flex-1 sm:block ${done ? "bg-emerald-500" : "bg-[var(--line)]"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function FileDrop({
  name, label, required, icon: Icon,
}: {
  name: string; label: string; required?: boolean; icon: React.ElementType;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const pick = (f: File | null) => {
    setFile(f);
    setPreview(f && f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
  };

  return (
    <div>
      <div className="mb-1.5 text-[11.5px] font-medium muted">
        {label} {required && <span className="text-rose-400">*</span>}
      </div>
      <input
        ref={ref}
        type="file"
        name={name}
        /*
         * Deliberately not `required`: the input is hidden behind a styled
         * drop zone, and a browser will not submit a form containing an
         * invalid hidden required field — the button just dies silently.
         * Validated in the submit handler and on the server instead.
         */
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0] ?? null)}
      />
      <AnimatePresence mode="wait">
        {file ? (
          <motion.div
            key="has"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative overflow-hidden rounded-xl border border-brand-500/50 soft"
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="h-[110px] w-full object-cover" />
            ) : (
              <div className="grid h-[110px] place-items-center">
                <FileText size={22} className="text-brand-400" />
              </div>
            )}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10.5px]">
              <Check size={11} className="shrink-0 text-emerald-400" />
              <span className="line-clamp-1 flex-1">{file.name}</span>
              <button
                type="button"
                onClick={() => {
                  pick(null);
                  if (ref.current) ref.current.value = "";
                }}
                className="shrink-0 muted hover:text-rose-400"
              >
                <X size={12} />
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.button
            key="empty"
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => ref.current?.click()}
            className="grid h-[142px] w-full place-items-center rounded-xl border border-dashed border-[var(--line)] soft transition-colors hover:border-brand-500/60 hover:bg-brand-600/[.06]"
          >
            <div className="text-center">
              <Icon size={20} className="mx-auto muted" />
              <div className="mt-1.5 text-[11px] font-medium">Click to upload</div>
              <div className="text-[10px] muted">JPG, PNG or PDF · max 8 MB</div>
            </div>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
