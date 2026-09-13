import TimeAgo from "@/components/TimeAgo";
import { sweepEscrowInBackground } from "@/lib/escrow";
import Link from "next/link";
import Image from "next/image";
import { requireUser } from "@/lib/session";
import { one } from "@/lib/db";
import { getOrders, getBuyerDisputes, getNotifications } from "@/lib/queries";
import { Section, Empty, Btn, Tag, FadeIn } from "@/components/ui";
import { statusTone, label } from "@/lib/fmt";
import { Package, Wallet, Gavel, Heart, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard — G2X.GG" };

type OrderRow = {
  code: string; total: number; status: string; created_at: string;
  item_count: number; first_title: string; first_image: string;
};

import { serverLocale } from "@/lib/locale";
import LocalTime from "@/components/LocalTime";
import { img } from "@/lib/img";
import { handle } from "@/lib/handle";

export default async function Page() {
  // Release any escrow whose 7-day hold has expired (throttled, non-blocking).
  sweepEscrowInBackground();

  const { money } = await serverLocale();
  const u = await requireUser();
  const [orders, disputes, notifs, wish, spent] = await Promise.all([
    getOrders(u.id) as Promise<OrderRow[]>,
    getBuyerDisputes(u.id),
    getNotifications(u.id),
    one<{ n: number }>(`SELECT COUNT(*) AS n FROM wishlist WHERE user_id=?`, [u.id]),
    one<{ s: number }>(
      `SELECT COALESCE(SUM(total),0) AS s FROM orders WHERE buyer_id=? AND payment_status='paid'`,
      [u.id]
    ),
  ]);

  const open = orders.filter((o) => !["completed", "cancelled", "refunded"].includes(o.status));
  const stats = [
    { label: "Total Orders", value: String(orders.length), icon: Package, href: "/dashboard/orders" },
    { label: "Total Spent", value: money(Number(spent?.s ?? 0)), icon: Wallet, href: "/dashboard/transactions" },
    { label: "Wallet Balance", value: money(u.balance), icon: Wallet, href: "/dashboard/wallet" },
    { label: "Wishlist", value: String(Number(wish?.n ?? 0)), icon: Heart, href: "/dashboard/wishlist" },
  ];

  return (
    <div className="space-y-5">
      <FadeIn>
        <div className="relative overflow-hidden rounded-2xl panel p-4 sm:p-6">
          <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 animate-pulseGlow rounded-full bg-brand-600/25 blur-[80px]" />
          <h1 className="text-[18px] font-black sm:text-[22px] tracking-tight">
            Welcome back, <span className="grad-text">{handle(u)}</span> 👋
          </h1>
          <p className="mt-1 text-[12.5px] muted">
            {open.length
              ? `You have ${open.length} order${open.length > 1 ? "s" : ""} in progress.`
              : "Everything is up to date. Ready for your next pickup?"}
          </p>
        </div>
      </FadeIn>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s, i) => (
          <FadeIn key={s.label} delay={i * 0.05}>
            <Link href={s.href} className="block rounded-2xl panel p-4 transition-all hover:-translate-y-0.5 hover:border-brand-500/40">
              <div className="flex items-center gap-2 text-[11px] muted">
                <s.icon size={13} /> {s.label}
              </div>
              <div className="mt-1.5 text-[20px] font-black">{s.value}</div>
            </Link>
          </FadeIn>
        ))}
      </div>

      <Section
        title="Recent Orders"
        action={
          <Link href="/dashboard/orders" className="flex items-center gap-1 text-[11.5px] text-brand-400 hover:underline">
            View all <ArrowRight size={12} />
          </Link>
        }
      >
        {orders.length === 0 ? (
          <Empty
            title="No orders yet"
            sub="Once you buy something it shows up here with live delivery status."
            action={<Link href="/"><Btn>Browse marketplace</Btn></Link>}
          />
        ) : (
          <div className="space-y-2.5">
            {orders.slice(0, 5).map((o) => (
              <Link
                key={o.code}
                href={`/dashboard/orders/${o.code}`}
                className="flex items-center gap-3 rounded-xl soft p-3 transition-all hover:-translate-y-0.5"
              >
                <div className="relative h-11 w-11 overflow-hidden rounded-lg">
                  <Image src={img(o.first_image)} alt="" fill sizes="48px" className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-1 text-[12.5px] font-semibold">
                    {o.first_title}
                    {o.item_count > 1 && <span className="muted"> +{o.item_count - 1} more</span>}
                  </div>
                  <div className="text-[11px] muted">
                    {o.code} · <LocalTime at={o.created_at} />
                  </div>
                </div>
                <Tag tone={statusTone(o.status)}>{label(o.status)}</Tag>
                <div className="w-[70px] text-right text-[13px] font-bold">{money(o.total)}</div>
              </Link>
            ))}
          </div>
        )}
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Open Disputes">
          {disputes.length === 0 ? (
            <div className="flex items-center gap-2 py-6 text-[12.5px] muted">
              <Gavel size={14} /> No disputes — smooth sailing.
            </div>
          ) : (
            <div className="space-y-2">
              {(disputes as { code: string; reason: string; status: string; created_at: string }[])
                .slice(0, 4)
                .map((d) => (
                  <Link key={d.code} href="/dashboard/disputes" className="flex items-center gap-2 rounded-lg soft p-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-1 text-[12px] font-semibold">{d.reason}</div>
                      <div className="text-[10.5px] muted">{d.code} · <TimeAgo at={d.created_at} /></div>
                    </div>
                    <Tag tone={statusTone(d.status)}>{label(d.status)}</Tag>
                  </Link>
                ))}
            </div>
          )}
        </Section>

        <Section title="Latest Activity">
          {notifs.length === 0 ? (
            <div className="py-6 text-[12.5px] muted">Nothing yet.</div>
          ) : (
            <div className="space-y-2">
              {(notifs as { id: string; title: string; body: string; href: string; created_at: string }[])
                .slice(0, 4)
                .map((n) => (
                  <Link key={n.id} href={n.href || "/dashboard"} className="block rounded-lg soft p-2.5">
                    <div className="text-[12px] font-semibold">{n.title}</div>
                    <div className="line-clamp-1 text-[11px] muted">{n.body}</div>
                    <div className="mt-0.5 text-[10px] muted"><TimeAgo at={n.created_at} /></div>
                  </Link>
                ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
