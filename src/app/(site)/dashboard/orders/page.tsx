import Link from "next/link";
import Image from "next/image";
import { requireUser } from "@/lib/session";
import { getOrders } from "@/lib/queries";
import { Empty, Btn, Tag } from "@/components/ui";
import { statusTone, label } from "@/lib/fmt";

export const dynamic = "force-dynamic";
export const metadata = { title: "My Orders — G2X.GG" };

const TABS = ["all", "processing", "delivered", "completed", "disputed", "refunded", "cancelled"];

type OrderRow = {
  code: string; total: number; status: string; payment_status: string; created_at: string;
  item_count: number; first_title: string; first_image: string;
};

import { serverLocale } from "@/lib/locale";
import LocalTime from "@/components/LocalTime";
import { img } from "@/lib/img";

export default async function Page({ searchParams }: { searchParams: { status?: string } }) {
  const { money } = await serverLocale();
  const u = await requireUser();
  const status = searchParams.status ?? "all";
  const orders = (await getOrders(u.id, status)) as OrderRow[];

  return (
    <div className="space-y-4">
      <h1 className="text-[18px] font-black sm:text-[22px] tracking-tight">My Orders</h1>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <Link
            key={t}
            href={t === "all" ? "/dashboard/orders" : `/dashboard/orders?status=${t}`}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-medium capitalize transition-all ${
              status === t ? "bg-brand-600 text-white" : "soft muted hover:text-brand-400"
            }`}
          >
            {t}
          </Link>
        ))}
      </div>

      {orders.length === 0 ? (
        <Empty
          title="No orders here"
          sub="Try a different filter, or start shopping."
          action={<Link href="/"><Btn>Browse marketplace</Btn></Link>}
        />
      ) : (
        <div className="space-y-2.5">
          {orders.map((o) => (
            <Link
              key={o.code}
              href={`/dashboard/orders/${o.code}`}
              className="flex flex-wrap items-center gap-3 rounded-2xl panel p-4 transition-all hover:-translate-y-0.5 hover:border-brand-500/40"
            >
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg soft">
                <Image src={img(o.first_image)} alt="" fill sizes="48px" className="object-cover" />
              </div>
              <div className="min-w-[180px] flex-1">
                <div className="line-clamp-1 text-[13px] font-bold">
                  {o.first_title}
                  {o.item_count > 1 && <span className="muted"> +{o.item_count - 1} more</span>}
                </div>
                <div className="mt-0.5 text-[11px] muted">
                  {o.code} · <LocalTime at={o.created_at} /> · {o.item_count} item{o.item_count > 1 ? "s" : ""}
                </div>
              </div>
              <Tag tone={o.payment_status === "paid" ? "green" : "amber"}>
                {label(o.payment_status)}
              </Tag>
              <Tag tone={statusTone(o.status)}>{label(o.status)}</Tag>
              <div className="w-[80px] text-right text-[15px] font-black text-brand-500">
                {money(o.total)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
