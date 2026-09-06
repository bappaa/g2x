import { requireAdmin } from "@/lib/admin";
import { adminSellers } from "@/lib/queries-admin";
import { AdminPage } from "@/components/admin/ui";
import SellerLevels from "@/components/admin/SellerLevels";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireAdmin("sellers");
  const rows = await adminSellers("active");
  return (
    <AdminPage
      title="Seller Levels & Ranking"
      sub="Drag to set the order sellers appear in on the homepage and in offer comparisons."
    >
      <SellerLevels rows={rows as never} />
    </AdminPage>
  );
}
