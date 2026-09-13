import { requireAdmin } from "@/lib/admin";
import { adminCoupons } from "@/lib/queries-admin";
import { AdminPage } from "@/components/admin/ui";
import CouponsManager from "@/components/admin/CouponsManager";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireAdmin("promotions");
  const rows = await adminCoupons();
  return (
    <AdminPage title="Promotions & Coupons" sub="Discount codes buyers can apply at checkout.">
      <CouponsManager rows={rows as never} />
    </AdminPage>
  );
}
