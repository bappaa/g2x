import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { getAdminStats, getAdminSalesSeries, adminOrders, adminVerifications } from "@/lib/queries-admin";
import { AdminPage, Stat } from "@/components/admin/ui";
import { Tag } from "@/components/ui";
import SalesChart from "@/components/seller/SalesChart";
import { money, when, statusTone, label, compact } from "@/lib/fmt";
import {
  DollarSign, ShoppingCart, Users, Store, BadgeCheck, Gavel, Banknote, ShieldAlert, ArrowRight,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireAdmin("dashboard");
  const [s, series, orders, kyc] = await Promise.all([
    getAdminStats(),
    getAdminSalesSeries(14),
    adminOrders({ limit: 8 }),
    adminVerifications("pending"),
  ]);

  const cards = [
    { label: "Gross Revenue", value: money(Number(s.rev?.gross ?? 0)), sub: `${money(Number(s.rev?.commission ?? 0))} commission`, icon: <DollarSign size={13} />, tone: "text-emerald-400" },
    { label: "Orders", value: compact(Number(s.orders?.n ?? 0)), sub: `${Number(s.orders?.today ?? 0)} today`, icon: <ShoppingCart size={13} />, href: "/admin/orders" },
    { label: "Users", value: compact(Number(s.users?.n ?? 0)), sub: `${Number(s.users?.today ?? 0)} today`, icon: <Users size={13} />, href: "/admin/users" },
    { label: "Sellers", value: `${Number(s.sellers?.active ?? 0)}/${Number(s.sellers?.n ?? 0)}`, sub: "active / total", icon: <Store size={13} />, href: "/admin/sellers" },
  ];

  const queue = [
    { label: "KYC pending", value: s.pendingKyc, icon: <BadgeCheck size={13} />, href: "/admin/verifications", tone: "text-amber-400" },
    { label: "Open disputes", value: s.openDisputes, icon: <Gavel size={13} />, href: "/admin/disputes", tone: "text-rose-400" },
    { label: "Payouts to review", value: s.pendingWd, icon: <Banknote size={13} />, href: "/admin/withdrawals", tone: "text-brand-400" },
    { label: "Flagged messages", value: s.flagged, icon: <ShieldAlert size={13} />, href: "/admin/messages", tone: "text-rose-400" },
  ];

  return (
    <AdminPage title="Dashboard" sub="Everything manageable from one place — no developer needed for daily changes.">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c, i) => (
          <Stat key={c.label} {...c} i={i} />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {queue.map((q, i) => (
          <Stat key={q.label} label={q.label} value={String(q.value)} icon={q.icon} tone={q.value > 0 ? q.tone : ""} href={q.href} i={i} />
        ))}
      </div>

      <div className="rounded-2xl panel p-5">
        <h3 className="mb-3 text-[14px] font-bold">Sales overview — last 14 days</h3>
        <SalesChart data={series} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl panel p-4">
          <div className="mb-3 flex items-center">
            <h3 className="text-[13.5px] font-bold">Latest orders</h3>
            <Link href="/admin/orders" className="ml-auto flex items-center gap-1 text-[11.5px] text-brand-400 hover:underline">
              All <ArrowRight size={11} />
            </Link>
          </div>
          <div className="space-y-1.5">
            {(orders as { code: string; buyer_name: string; total: number; status: string; created_at: string; first_title: string }[]).map((o) => (
              <Link key={o.code} href={`/admin/orders?q=${o.code}`} className="flex items-center gap-2.5 rounded-lg soft p-2">
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-1 text-[12px] font-semibold">{o.first_title}</div>
                  <div className="text-[10px] muted">{o.code} · {o.buyer_name} · {when(o.created_at)}</div>
                </div>
                <Tag tone={statusTone(o.status)}>{label(o.status)}</Tag>
                <div className="w-[64px] text-right text-[12px] font-bold">{money(o.total)}</div>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-2xl panel p-4">
          <div className="mb-3 flex items-center">
            <h3 className="text-[13.5px] font-bold">Seller verifications waiting</h3>
            <Link href="/admin/verifications" className="ml-auto flex items-center gap-1 text-[11.5px] text-brand-400 hover:underline">
              Review <ArrowRight size={11} />
            </Link>
          </div>
          {kyc.length === 0 ? (
            <div className="py-8 text-center text-[12px] muted">Nothing waiting — all caught up.</div>
          ) : (
            <div className="space-y-1.5">
              {(kyc as { id: string; user_name: string; store_name: string; country: string; submitted_at: string }[]).slice(0, 6).map((v) => (
                <Link key={v.id} href="/admin/verifications" className="flex items-center gap-2.5 rounded-lg soft p-2">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-amber-500/15 text-[10px] font-bold text-amber-400">
                    {(v.user_name ?? "?").slice(0, 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-1 text-[12px] font-semibold">{v.store_name || v.user_name}</div>
                    <div className="text-[10px] muted">{v.country} · {when(v.submitted_at)}</div>
                  </div>
                  <Tag tone="amber">Pending</Tag>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminPage>
  );
}
