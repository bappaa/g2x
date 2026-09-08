"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { Btn, Field, inputCls, Section, Tag } from "@/components/ui";

import { updateProfileAction } from "@/lib/actions/auth";
import LocalTime from "@/components/LocalTime";

export default function ProfileForm({
  name, email, phone, country, provider, joined,
}: {
  name: string; email: string; phone: string; country: string; provider: string; joined: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  return (
    <div className="space-y-4">
      <h1 className="text-[18px] font-black sm:text-[22px] tracking-tight">Profile</h1>

      <div className="rounded-2xl panel p-4 sm:p-5">
        <div className="flex items-center gap-4">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 to-brand-700 text-[18px] font-black sm:text-[22px] text-white">
            {name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <div className="text-[16px] font-bold">{name}</div>
            <div className="text-[12px] muted">{email}</div>
            <div className="mt-1.5 flex gap-1.5">
              <Tag tone="green">Verified buyer</Tag>
              <Tag tone="slate">{provider === "google" ? "Google account" : "Email account"}</Tag>
              {joined && <Tag tone="slate">Joined <LocalTime at={joined} mode="date" /></Tag>}
            </div>
          </div>
        </div>
      </div>

      <Section title="Personal information">
        <form
          action={(fd) =>
            start(async () => {
              setErr(""); setMsg("");
              const r = await updateProfileAction(fd);
              if (!r.ok) return setErr(r.error || "Could not save.");
              setMsg("Profile updated.");
              router.refresh();
            })
          }
          className="grid gap-3 sm:grid-cols-2"
        >
          <Field label="Full name">
            <input name="name" defaultValue={name} className={inputCls} />
          </Field>
          <Field label="Email (read only)">
            <input value={email} readOnly className={inputCls} />
          </Field>
          <Field label="Phone">
            <input name="phone" defaultValue={phone} className={inputCls} placeholder="Phone number" />
          </Field>
          <Field label="Country">
            <input name="country" defaultValue={country} className={inputCls} placeholder="Country" />
          </Field>
          <div className="sm:col-span-2">
            {err && <div className="mb-2 text-[11.5px] text-rose-400">{err}</div>}
            {msg && (
              <div className="mb-2 flex items-center gap-1.5 text-[11.5px] text-emerald-400">
                <Check size={13} /> {msg}
              </div>
            )}
            <Btn className="flex items-center gap-2" disabled={pending}>
              {pending && <Loader2 size={13} className="animate-spin" />} Save changes
            </Btn>
          </div>
        </form>
      </Section>
    </div>
  );
}
