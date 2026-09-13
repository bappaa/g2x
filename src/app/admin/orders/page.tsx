import { requireAdmin } from "@/lib/admin";
import { adminOrders } from "@/lib/queries-admin";
import { AdminPage, FilterTabs } from "@/components/admin/ui";
import OrdersManager from "@/components/admin/OrdersManager";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: { status?: string; q?: string } }) {
  await requireAdmin("orders");
  const status = searchParams.status ?? "all";
  const rows = await adminOrders({ status, q: searchParams.q, limit: 200 });
  return (
    <AdminPage title="All Orders" sub="Every order across the marketplace, with manual status control and refunds.">
      <FilterTabs
        base="/admin/orders"
        tabs={["all", "pending_payment", "paid", "processing", "delivered", "completed", "disputed", "refunded", "cancelled"]}
        active={status}
      />
      <OrdersManager rows={rows as never} q={searchParams.q ?? ""} />
    </AdminPage>
  );
}
