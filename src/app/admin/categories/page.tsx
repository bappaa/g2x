import { requireAdmin } from "@/lib/admin";
import { adminCategories } from "@/lib/queries-admin";
import { AdminPage } from "@/components/admin/ui";
import CategoriesManager from "@/components/admin/CategoriesManager";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireAdmin("catalog");
  const cats = await adminCategories();
  return (
    <AdminPage title="Categories" sub="The top-level sections of the marketplace. Each game can belong to several.">
      <CategoriesManager rows={cats as never} />
    </AdminPage>
  );
}
