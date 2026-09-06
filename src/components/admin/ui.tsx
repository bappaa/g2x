"use client";
import { motion } from "framer-motion";
import Link from "next/link";

export function AdminPage({
  title, sub, action, children,
}: {
  title: string; sub?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-3">
        <div>
          <h1 className="text-[21px] font-black tracking-tight">{title}</h1>
          {sub && <p className="mt-0.5 text-[11.5px] muted">{sub}</p>}
        </div>
        {action && <div className="ml-auto flex items-center gap-2">{action}</div>}
      </div>
      {children}
    </div>
  );
}

export function Stat({
  label, value, sub, icon, tone = "", href, i = 0,
}: {
  label: string; value: string; sub?: string; icon?: React.ReactNode;
  tone?: string; href?: string; i?: number;
}) {
  const body = (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.04 }}
      className="rounded-2xl panel p-4 transition-all hover:-translate-y-0.5 hover:border-brand-500/40"
    >
      <div className="flex items-center gap-2 text-[11px] muted">
        {icon} {label}
      </div>
      <div className={`mt-1.5 text-[20px] font-black ${tone}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[10.5px] muted">{sub}</div>}
    </motion.div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl panel">
      <table className="w-full min-w-[640px] text-left text-[12.5px]">
        <thead className="border-b border-[var(--line)] text-[11px] muted">
          <tr>
            {head.map((h) => (
              <th key={h} className="whitespace-nowrap px-3 py-2.5 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Tr({ children }: { children: React.ReactNode }) {
  return (
    <tr className="border-b border-[var(--line)] transition-colors last:border-0 hover:bg-brand-600/[.05]">
      {children}
    </tr>
  );
}

export function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 align-middle ${className}`}>{children}</td>;
}

export function Toolbar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

export function FilterTabs({
  base, tabs, active, param = "status",
}: {
  base: string; tabs: string[]; active: string; param?: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tabs.map((t) => (
        <Link
          key={t}
          href={t === "all" ? base : `${base}?${param}=${t}`}
          className={`rounded-lg px-3 py-1.5 text-[12px] font-medium capitalize transition-all ${
            active === t ? "bg-brand-600 text-white" : "soft muted hover:text-brand-400"
          }`}
        >
          {t.replace(/_/g, " ")}
        </Link>
      ))}
    </div>
  );
}

export function IconAction({
  children, onClick, title, danger, disabled,
}: {
  children: React.ReactNode; onClick?: () => void; title: string;
  danger?: boolean; disabled?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`grid h-7 w-7 place-items-center rounded-lg soft transition-colors disabled:opacity-40 ${
        danger ? "hover:bg-rose-500/15 hover:text-rose-400" : "hover:bg-brand-500/15 hover:text-brand-400"
      }`}
    >
      {children}
    </button>
  );
}
