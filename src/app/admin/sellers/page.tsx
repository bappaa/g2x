import { requireAdmin } from "@/lib/admin";
import { adminSellers } from "@/lib/queries-admin";
import { AdminPage, FilterTabs } from "@/components/admin/ui";
import SellersManager from "@/components/admin/SellersManager";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: { status?: string } }) {
  await requireAdmin("sellers");
  const status = searchParams.status ?? "all";
  const rows = await adminSellers(status);
  return (
    <AdminPage title="Sellers" sub="Approve stores, set commission, badges and homepage ranking.">
      <FilterTabs base="/admin/sellers" tabs={["all", "active", "pending", "suspended", "rejected"]} active={status} />
      <SellersManager rows={rows as never} />
    </AdminPage>
  );
}
