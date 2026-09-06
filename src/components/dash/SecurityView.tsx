"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Shield, Monitor, Loader2, Check } from "lucide-react";
import { Btn, Field, inputCls, Section } from "@/components/ui";
import { when } from "@/lib/fmt";
import { changePasswordAction, toggle2faAction, revokeSessionAction } from "@/lib/actions/auth";

type S = { id: string; ip: string; user_agent: string; created_at: string };

export default function SecurityView({ twoFactor, sessions }: { twoFactor: boolean; sessions: S[] }) {
  const router = useRouter();
  const [on, setOn] = useState(twoFactor);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4">
      <h1 className="text-[18px] font-black sm:text-[22px] tracking-tight">Security</h1>

      <Section title="Change password">
        <form
          action={(fd) =>
            start(async () => {
              setErr(""); setMsg("");
              const r = await changePasswordAction(fd);
              if (!r.ok) return setErr(r.error || "Could not update password.");
              setMsg("Password changed.");
            })
          }
          className="grid gap-3 sm:grid-cols-3"
        >
          <Field label="Current password">
            <input name="current" type="password" className={inputCls} />
          </Field>
          <Field label="New password">
            <input name="next" type="password" className={inputCls} />
          </Field>
          <Field label="Confirm new password">
            <input name="confirm" type="password" className={inputCls} />
          </Field>
          <div className="sm:col-span-3">
            {err && <div className="mb-2 text-[11.5px] text-rose-400">{err}</div>}
            {msg && (
              <div className="mb-2 flex items-center gap-1.5 text-[11.5px] text-emerald-400">
                <Check size={13} /> {msg}
              </div>
            )}
            <Btn className="flex items-center gap-2" disabled={pending}>
              {pending && <Loader2 size={13} className="animate-spin" />} Update password
            </Btn>
          </div>
        </form>
      </Section>

      <Section title="Two-factor authentication">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600/15 text-brand-400">
            <Shield size={15} />
          </span>
          <div className="flex-1">
            <div className="text-[12.5px] font-semibold">Email OTP verification</div>
            <div className="text-[11px] muted">Require a one-time code when signing in from a new device.</div>
          </div>
          <button
            onClick={() => {
              const next = !on;
              setOn(next);
              start(async () => {
                await toggle2faAction(next);
                router.refresh();
              });
            }}
            className={`relative h-6 w-11 rounded-full transition-colors ${on ? "bg-brand-600" : "bg-[var(--line)]"}`}
            aria-label="Toggle 2FA"
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? "left-[22px]" : "left-0.5"}`}
            />
          </button>
        </div>
      </Section>

      <Section title="Active sessions">
        <div className="space-y-2">
          {sessions.map((s, i) => (
            <div key={s.id} className="flex items-center gap-3 rounded-lg soft p-3">
              <Monitor size={15} className="muted" />
              <div className="min-w-0 flex-1">
                <div className="line-clamp-1 text-[12px] font-semibold">
                  {s.user_agent?.slice(0, 60) || "Unknown device"}
                </div>
                <div className="text-[10.5px] muted">
                  {s.ip || "—"} · {when(s.created_at)} {i === 0 && "· current"}
                </div>
              </div>
              {i !== 0 && (
                <button
                  onClick={() =>
                    start(async () => {
                      await revokeSessionAction(s.id);
                      router.refresh();
                    })
                  }
                  className="text-[11.5px] text-rose-400 hover:underline"
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
