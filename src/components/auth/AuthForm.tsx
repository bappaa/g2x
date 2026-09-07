"use client";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Mail,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  ShieldCheck,
  Zap,
  Headphones,
  Check,
  Loader2,
  ArrowLeft,
  AlertCircle,
} from "lucide-react";
import Logo from "@/components/Logo";
import { BrandIcon } from "@/components/BrandIcon";
import { inputCls } from "@/components/ui";
import { loginAction, registerAction, demoGoogleAction } from "@/lib/actions/auth";

export default function AuthForm({
  mode,
  googleEnabled,
}: {
  mode: "login" | "register";
  googleEnabled: boolean;
}) {
  const isLogin = mode === "login";
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/dashboard";

  const [show, setShow] = useState(false);
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const [googlePending, startGoogle] = useTransition();

  useEffect(() => {
    const e = sp.get("error");
    if (e) setErr(e);
  }, [sp]);

  const submit = (formData: FormData) => {
    setErr("");
    if (!isLogin && !agree) {
      setErr("You must accept the Terms & Privacy Policy.");
      return;
    }
    formData.set("next", next);
    start(async () => {
      const res = isLogin
        ? await loginAction(null, formData)
        : await registerAction(null, formData);
      if (!res.ok) setErr(res.error || "Something went wrong.");
      else {
        router.push(res.redirect || "/dashboard");
        router.refresh();
      }
    });
  };

  const google = () => {
    setErr("");
    if (googleEnabled) {
      window.location.href = `/api/auth/google?next=${encodeURIComponent(next)}`;
      return;
    }
    startGoogle(async () => {
      const res = await demoGoogleAction(next);
      if (!res.ok) setErr(res.error || "Google sign-in failed.");
      else {
        router.push(res.redirect || "/dashboard");
        router.refresh();
      }
    });
  };

  const busy = pending || googlePending;

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden lg:block">
        <div className="absolute inset-0 bg-gradient-to-br from-[#12061f] via-[#0a0713] to-[#05060c]" />
        <div className="pointer-events-none absolute -left-24 top-10 h-[420px] w-[420px] animate-pulseGlow rounded-full bg-brand-600/35 blur-[130px]" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-[380px] w-[380px] animate-pulseGlow rounded-full bg-fuchsia-600/25 blur-[130px]" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Link href="/" className="w-fit text-white">
            <Logo />
          </Link>

          <div>
            <motion.h2
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="max-w-[420px] text-[38px] font-black leading-[1.1] tracking-tight text-white"
            >
              The safest way to buy{" "}
              <span className="grad-text">gaming accounts, coins &amp; top-ups.</span>
            </motion.h2>
            <div className="mt-8 space-y-3.5">
              {[
                { i: ShieldCheck, t: "Escrow protected payments", s: "Funds are held until you confirm delivery" },
                { i: Zap, t: "Instant delivery", s: "Most orders complete in under 15 minutes" },
                { i: Headphones, t: "24/7 live support", s: "Real humans, any timezone" },
              ].map((f, k) => (
                <motion.div
                  key={f.t}
                  initial={{ opacity: 0, x: -18 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + k * 0.12 }}
                  className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[.04] p-3.5 backdrop-blur"
                >
                  <f.i size={19} className="mt-0.5 shrink-0 text-brand-400" />
                  <div>
                    <div className="text-[13px] font-semibold text-white">{f.t}</div>
                    <div className="text-[11.5px] text-white/55">{f.s}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-6 text-[11.5px] text-white/50">
            <span>500K+ customers</span>
            <span>2M+ orders</span>
            <span>4.8★ Trustpilot</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center px-5 py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-[400px]"
        >
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-1.5 text-[12px] muted transition-colors hover:text-brand-500"
          >
            <ArrowLeft size={13} /> Back to marketplace
          </Link>

          <div className="lg:hidden">
            <Logo />
          </div>

          <h1 className="mt-4 text-[20px] font-black sm:text-[26px] tracking-tight">
            {isLogin ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1.5 text-[12.5px] muted">
            {isLogin
              ? "Log in to track orders, manage your wallet and buy securely."
              : "Join 500,000+ gamers buying safely on G2X.GG."}
          </p>

          <button
            onClick={google}
            disabled={busy}
            className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-[13px] font-semibold text-[#1f2430] transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60"
          >
            {googlePending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <BrandIcon name="google" size={16} />
            )}
            Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-[var(--line)]" />
            <span className="text-[10.5px] muted">OR CONTINUE WITH EMAIL</span>
            <span className="h-px flex-1 bg-[var(--line)]" />
          </div>

          <form action={submit} className="space-y-3.5">
            {!isLogin && (
              <IconInput icon={UserIcon} name="name" placeholder="Full name" autoComplete="name" />
            )}
            <IconInput
              icon={Mail}
              name="email"
              type="email"
              placeholder="Email address"
              autoComplete="email"
            />
            <div className="relative">
              <IconInput
                icon={Lock}
                name="password"
                type={show ? "text" : "password"}
                placeholder="Password"
                autoComplete={isLogin ? "current-password" : "new-password"}
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 muted"
                tabIndex={-1}
              >
                {show ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            {isLogin ? (
              <div className="flex items-center justify-between text-[11.5px]">
                <label className="flex cursor-pointer items-center gap-2 muted">
                  <input type="checkbox" className="accent-[#8b3dff]" defaultChecked /> Remember me
                </label>
                <Link href="/support" className="font-medium text-brand-500">
                  Forgot password?
                </Link>
              </div>
            ) : (
              <label className="flex cursor-pointer items-start gap-2 text-[11.5px] muted">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                  className="mt-0.5 accent-[#8b3dff]"
                />
                <span>
                  I agree to the{" "}
                  <Link href="/p/terms" className="text-brand-500">
                    Terms &amp; Conditions
                  </Link>{" "}
                  and{" "}
                  <Link href="/p/privacy" className="text-brand-500">
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>
            )}

            {err && (
              <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11.5px] text-rose-400">
                <AlertCircle size={13} className="mt-0.5 shrink-0" />
                {err}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-3 text-[13.5px] font-semibold text-white shadow-[0_14px_32px_-14px_rgba(139,61,255,.95)] transition-all hover:-translate-y-0.5 hover:bg-brand-500 disabled:opacity-60"
            >
              {pending && <Loader2 size={15} className="animate-spin" />}
              {isLogin ? "Log In" : "Create Account"}
            </button>
          </form>

          <p className="mt-5 text-center text-[12.5px] muted">
            {isLogin ? "New to G2X.GG? " : "Already have an account? "}
            <Link
              href={isLogin ? "/register" : "/login"}
              className="font-semibold text-brand-500 hover:underline"
            >
              {isLogin ? "Create an account" : "Log in"}
            </Link>
          </p>

          <div className="mt-6 flex items-center justify-center gap-4 text-[10.5px] muted">
            {["Secure checkout", "Escrow protected", "No hidden fees"].map((t) => (
              <span key={t} className="flex items-center gap-1">
                <Check size={11} className="text-emerald-400" /> {t}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function IconInput({
  icon: Icon,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { icon: React.ElementType }) {
  return (
    <div className="relative">
      <Icon size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 muted" />
      <input {...rest} className={`${inputCls} py-3 pl-10`} />
    </div>
  );
}
