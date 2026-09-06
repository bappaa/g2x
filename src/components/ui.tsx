"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Star, ChevronRight } from "lucide-react";

export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="flex flex-wrap items-center gap-1 text-[11.5px] muted">
      {items.map((i, k) => (
        <span key={k} className="flex items-center gap-1">
          {i.href ? (
            <Link href={i.href} className="transition-colors hover:text-brand-500">
              {i.label}
            </Link>
          ) : (
            <span className="text-brand-500">{i.label}</span>
          )}
          {k < items.length - 1 && <ChevronRight size={11} className="opacity-50" />}
        </span>
      ))}
    </nav>
  );
}

export function Section({
  title,
  action,
  children,
  className = "",
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl panel p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-[14px] font-bold">{title}</h3>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Pill({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3.5 py-1.5 text-[12px] font-medium transition-all ${
        active
          ? "bg-brand-600 text-white shadow-[0_8px_20px_-10px_rgba(139,61,255,.9)]"
          : "border border-[var(--line)] soft hover:border-brand-500 hover:text-brand-500"
      }`}
    >
      {children}
    </button>
  );
}

export function Tag({ children, tone = "brand" }: { children: React.ReactNode; tone?: "brand" | "green" | "amber" | "red" | "slate" }) {
  const tones: Record<string, string> = {
    brand: "bg-brand-600/15 text-brand-400 border-brand-600/30",
    green: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    amber: "bg-amber-500/15 text-amber-500 border-amber-500/30",
    red: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    slate: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  };
  return (
    <span className={`rounded-md border px-2 py-0.5 text-[10.5px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Rating({ value, reviews }: { value: number; reviews?: string }) {
  return (
    <span className="flex items-center gap-1 text-[11.5px]">
      <Star size={11} className="fill-amber-400 text-amber-400" />
      <span className="font-semibold">{value}%</span>
      {reviews && <span className="muted">({reviews})</span>}
    </span>
  );
}

export function Btn({
  children,
  variant = "primary",
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "soft" }) {
  const v = {
    primary:
      "bg-brand-600 text-white hover:bg-brand-500 shadow-[0_12px_28px_-14px_rgba(139,61,255,.95)]",
    ghost: "border border-[var(--line)] hover:border-brand-500 hover:text-brand-500",
    soft: "soft border border-[var(--line)] hover:border-brand-500",
  }[variant];
  return (
    <button
      {...rest}
      className={`rounded-lg px-4 py-2.5 text-[13px] font-semibold transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 ${v} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
  hint,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[11.5px] font-medium muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[10.5px] muted">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-lg border border-[var(--line)] soft px-3.5 py-2.5 text-[13px] outline-none transition-all placeholder:text-[var(--muted)] focus:border-brand-500 focus:shadow-[0_0_0_3px_rgba(139,61,255,.14)]";

export function FadeIn({
  children,
  delay = 0,
  y = 18,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function Empty({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-[var(--line)] px-6 py-14 text-center">
      <div className="text-[14px] font-semibold">{title}</div>
      {sub && <div className="mt-1 text-[12px] muted">{sub}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
