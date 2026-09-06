import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getSellerStats, getSellerOrders, getSellerSalesSeries, getTopSellerProducts } from "@/lib/queries";
import { Section, Tag, Empty, FadeIn } from "@/components/ui";
import { money, when, statusTone, label } from "@/lib/fmt";
import { DollarSign, Package, Percent, Star, ArrowRight } from "lucide-react";
import SalesChart from "@/components/seller/SalesChart";

export const dynamic = "force-dynamic";
export const metadata = { title: "Seller Overview — G2X.GG" };

type OI = { id: string; code: string; title: string; line_total: number; status: string; created_at: string; buyer_name: string };

export default async function Page() {
  const u = await requireUser();
  const [stats, orders, series, top] = await Promise.all([
    getSellerStats(u.id),
    getSellerOrders(u.id) as Promise<OI[]>,
    getSellerSalesSeries(u.id, 14),
    getTopSellerProducts(u.id) as Promise<{ title: string; orders: number; revenue: number }[]>,
  ]);

  const cards = [
    { l: "Net Earnings", v: money(Number(stats.totals?.net ?? 0)), i: DollarSign },
    { l: "Completed Orders", v: String(Number(stats.totals?.orders ?? 0)), i: Package },
    { l: "Commission Paid", v: money(Number(stats.totals?.commission ?? 0)), i: Percent },
    { l: "Rating", v: `${Number(stats.rating?.avg ?? 0).toFixed(1)}★ (${Number(stats.rating?.n ?? 0)})`, i: Star },
  ];

  return (
    <div className="space-y-5">
      <FadeIn>
        <div className="relative overflow-hidden rounded-2xl panel p-4 sm:p-6">
          <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 animate-pulseGlow rounded-full bg-brand-600/25 blur-[80px]" />
          <h1 className="text-[18px] font-black sm:text-[22px] tracking-tight">Seller Overview</h1>
          <p className="mt-1 text-[12.5px] muted">
            {stats.pending > 0
              ? `${stats.pending} order${stats.pending > 1 ? "s" : ""} waiting for delivery — deliver fast to keep your rating high.`
              : "No pending deliveries. Nice work!"}
          </p>
        </div>
      </FadeIn>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c, i) => (
          <FadeIn key={c.l} delay={i * 0.05}>
            <div className="rounded-2xl panel p-4">
              <div className="flex items-center gap-2 text-[11px] muted">
                <c.i size={13} /> {c.l}
              </div>
              <div className="mt-1.5 text-[19px] font-black">{c.v}</div>
            </div>
          </FadeIn>
        ))}
      </div>

      <Section title="Revenue — last 14 days">
        <SalesChart data={series} />
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          title="Latest Orders"
          action={
            <Link href="/seller/orders" className="flex items-center gap-1 text-[11.5px] text-brand-400 hover:underline">
              View all <ArrowRight size={12} />
            </Link>
          }
        >
          {orders.length === 0 ? (
            <Empty title="No orders yet" sub="Publish competitive offers to start getting sales." />
          ) : (
            <div className="space-y-2">
              {orders.slice(0, 6).map((o) => (
                <Link key={o.id} href="/seller/orders" className="flex items-center gap-3 rounded-lg soft p-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-1 text-[12px] font-semibold">{o.title}</div>
                    <div className="text-[10.5px] muted">
                      {o.code} · {o.buyer_name} · {when(o.created_at)}
                    </div>
                  </div>
                  <Tag tone={statusTone(o.status)}>{label(o.status)}</Tag>
                  <div className="w-[70px] text-right text-[12.5px] font-bold">{money(o.line_total)}</div>
                </Link>
              ))}
            </div>
          )}
        </Section>

        <Section title="Best Sellers">
          {top.length === 0 ? (
            <Empty title="Not enough data yet" />
          ) : (
            <div className="space-y-2">
              {top.slice(0, 6).map((t, i) => (
                <div key={t.title} className="flex items-center gap-3 rounded-lg soft p-2.5">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-brand-600/15 text-[11px] font-bold text-brand-400">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1 line-clamp-1 text-[12px] font-semibold">{t.title}</div>
                  <div className="text-[10.5px] muted">{t.orders} sold</div>
                  <div className="w-[70px] text-right text-[12.5px] font-bold">{money(t.revenue)}</div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
