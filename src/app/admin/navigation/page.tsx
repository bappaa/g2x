import { requireAdmin } from "@/lib/admin";
import { adminNavLinks } from "@/lib/queries-admin";
import { AdminPage } from "@/components/admin/ui";
import NavManager from "@/components/admin/NavManager";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireAdmin("cms");
  const rows = await adminNavLinks();
  return (
    <AdminPage
      title="Navigation & Footer"
      sub="Every link column in the site footer. Add, rename, reorder or remove — the site updates instantly."
    >
      <NavManager rows={rows as never} />
    </AdminPage>
  );
}
