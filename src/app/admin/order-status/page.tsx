import { requireAdmin } from "@/lib/admin";
import { adminOrders } from "@/lib/queries-admin";
import { AdminPage, Stat } from "@/components/admin/ui";
import { ShoppingCart } from "lucide-react";
import { money, label } from "@/lib/fmt";

export const dynamic = "force-dynamic";

const FLOW = ["pending_payment", "paid", "processing", "delivered", "completed"];
const OTHER = ["cancelled", "refunded", "disputed"];

export default async function Page() {
  await requireAdmin("orders");
  const rows = (await adminOrders({ limit: 500 })) as { status: string; total: number }[];
  const agg = (s: string) => {
    const list = rows.filter((r) => r.status === s);
    return { n: list.length, sum: list.reduce((a, b) => a + Number(b.total), 0) };
  };

  return (
    <AdminPage title="Order Status" sub="How the last 500 orders are distributed across the fulfilment pipeline.">
      <div className="text-[11.5px] font-semibold muted">Main flow</div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {FLOW.map((s, i) => {
          const a = agg(s);
          return (
            <Stat
              key={s}
              i={i}
              label={label(s)}
              value={String(a.n)}
              sub={money(a.sum)}
              icon={<ShoppingCart size={13} />}
              href={`/admin/orders?status=${s}`}
            />
          );
        })}
      </div>
      <div className="text-[11.5px] font-semibold muted">Exceptions</div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {OTHER.map((s, i) => {
          const a = agg(s);
          return (
            <Stat
              key={s}
              i={i}
              label={label(s)}
              value={String(a.n)}
              sub={money(a.sum)}
              icon={<ShoppingCart size={13} />}
              tone={a.n > 0 ? "text-rose-400" : ""}
              href={`/admin/orders?status=${s}`}
            />
          );
        })}
      </div>
    </AdminPage>
  );
}
