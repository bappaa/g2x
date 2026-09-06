import { requireAdmin } from "@/lib/admin";
import { getAdminStats, getAdminSalesSeries, reportCategoryRevenue } from "@/lib/queries-admin";
import { AdminPage, Stat, Table, Tr, Td } from "@/components/admin/ui";
import SalesChart from "@/components/seller/SalesChart";
import { money, compact } from "@/lib/fmt";
import { DollarSign, ShoppingCart, Percent, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireAdmin("reports");
  const [s, series, cats] = await Promise.all([
    getAdminStats(),
    getAdminSalesSeries(30),
    reportCategoryRevenue(),
  ]);
  const gross = Number(s.rev?.gross ?? 0);
  const orders = Number(s.orders?.n ?? 0);

  return (
    <AdminPage title="Sales Report" sub="Last 30 days of trading across the whole marketplace.">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Gross sales" value={money(gross)} icon={<DollarSign size={13} />} tone="text-emerald-400" i={0} />
        <Stat label="Orders" value={compact(orders)} icon={<ShoppingCart size={13} />} i={1} />
        <Stat label="Commission" value={money(Number(s.rev?.commission ?? 0))} icon={<Percent size={13} />} tone="text-brand-400" i={2} />
        <Stat label="Average order" value={money(orders ? gross / orders : 0)} icon={<TrendingUp size={13} />} i={3} />
      </div>

      <div className="rounded-2xl panel p-5">
        <h3 className="mb-3 text-[14px] font-bold">Daily sales</h3>
        <SalesChart data={series} />
      </div>

      <Table head={["Category", "Orders", "Revenue", "Share"]}>
        {(cats as { name: string; orders: number; revenue: number }[]).map((c) => (
          <Tr key={c.name}>
            <Td className="font-semibold">{c.name}</Td>
            <Td className="muted">{c.orders}</Td>
            <Td className="font-bold">{money(c.revenue)}</Td>
            <Td>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-[100px] overflow-hidden rounded-full soft">
                  <div
                    className="h-full rounded-full bg-brand-600"
                    style={{ width: `${gross ? Math.min(100, (Number(c.revenue) / gross) * 100) : 0}%` }}
                  />
                </div>
                <span className="text-[10.5px] muted">
                  {gross ? ((Number(c.revenue) / gross) * 100).toFixed(1) : "0.0"}%
                </span>
              </div>
            </Td>
          </Tr>
        ))}
      </Table>
    </AdminPage>
  );
}
