"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, MailCheck, RotateCw } from "lucide-react";
import Logo from "@/components/Logo";
import { verifyEmailAction, resendOtpAction } from "@/lib/actions/auth";

/**
 * Six-digit email confirmation.
 *
 * One input per digit, because a single free-text box invites people to paste
 * spaces or dashes. Pasting the whole code into the first box still works, and
 * it auto-submits on the sixth digit so there is nothing extra to press.
 */
export default function VerifyEmail({ email, next }: { email: string; next: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [err, setErr] = useState("");
  const [sent, setSent] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const submitted = useRef(false);

  useEffect(() => {
    boxes.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const submit = (code: string) => {
    if (submitted.current) return;
    submitted.current = true;
    setErr("");
    start(async () => {
      try {
        const r = await verifyEmailAction(code).catch(() => null);
        if (!r || !r.ok) {
          setErr(r?.error || "Could not verify that code.");
          setDigits(Array(6).fill(""));
          boxes.current[0]?.focus();
          return;
        }
        router.replace(next);
        router.refresh();
      } finally {
        submitted.current = false;
      }
    });
  };

  const setAt = (i: number, v: string) => {
    const only = v.replace(/\D/g, "");
    if (!only) {
      setDigits((d) => d.map((x, j) => (j === i ? "" : x)));
      return;
    }
    // Pasting the full code into any box fills the rest.
    if (only.length > 1) {
      const next6 = only.slice(0, 6).split("");
      const filled = Array(6)
        .fill("")
        .map((_, j) => next6[j] ?? "");
      setDigits(filled);
      if (filled.every(Boolean)) submit(filled.join(""));
      else boxes.current[Math.min(only.length, 5)]?.focus();
      return;
    }
    const d = digits.map((x, j) => (j === i ? only : x));
    setDigits(d);
    if (i < 5) boxes.current[i + 1]?.focus();
    if (d.every(Boolean)) submit(d.join(""));
  };

  const resend = () =>
    start(async () => {
      setErr("");
      setSent("");
      const r = await resendOtpAction().catch(() => null);
      if (!r || !r.ok) {
        setErr(r?.error || "Could not send a new code.");
        setCooldown(30);
        return;
      }
      setSent("A new code is on its way.");
      setCooldown(60);
    });

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-[440px] flex-col justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl panel p-6 sm:p-7"
      >
        <div className="mb-5 flex justify-center">
          <Logo />
        </div>

        <div className="mb-4 grid place-items-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-600/15 text-brand-400">
            <MailCheck size={22} />
          </span>
        </div>

        <h1 className="text-center text-[19px] font-black tracking-tight">Confirm your email</h1>
        <p className="mx-auto mt-1.5 max-w-[320px] text-center text-[12.5px] muted">
          We sent a 6-digit code to <b className="text-[var(--text)]">{email}</b>. It expires in
          10 minutes.
        </p>

        <div className="mt-5 flex justify-center gap-2">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                boxes.current[i] = el;
              }}
              value={d}
              onChange={(e) => setAt(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && !digits[i] && i > 0) boxes.current[i - 1]?.focus();
              }}
              inputMode="numeric"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              maxLength={6}
              aria-label={`Digit ${i + 1}`}
              className="h-12 w-11 rounded-xl border border-[var(--line)] bg-transparent text-center text-[18px] font-black outline-none transition-all focus:border-brand-500 focus:shadow-[0_0_0_3px_rgba(139,61,255,.14)] soft"
            />
          ))}
        </div>

        {pending && (
          <div className="mt-4 flex items-center justify-center gap-2 text-[12.5px] muted">
            <Loader2 size={14} className="animate-spin" /> Checking…
          </div>
        )}
        {err && <div className="mt-4 text-center text-[12.5px] text-rose-400">{err}</div>}
        {sent && <div className="mt-4 text-center text-[12.5px] text-emerald-400">{sent}</div>}

        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={resend}
            disabled={pending || cooldown > 0}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-400 transition-colors hover:text-brand-300 disabled:opacity-50"
          >
            <RotateCw size={13} />
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Send a new code"}
          </button>
        </div>

        <p className="mt-4 text-center text-[11px] muted">
          Wrong address? Check your spam folder, or contact support.
        </p>
      </motion.div>
    </div>
  );
}
