import { requireAdmin } from "@/lib/admin";
import { adminSellers } from "@/lib/queries-admin";
import { AdminPage } from "@/components/admin/ui";
import SellersManager from "@/components/admin/SellersManager";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireAdmin("sellers");
  const rows = await adminSellers("pending");
  return (
    <AdminPage title="Seller Requests" sub="New store applications waiting on approval. ID verification must pass first.">
      <SellersManager rows={rows as never} />
    </AdminPage>
  );
}
