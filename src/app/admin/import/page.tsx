import { requireAdmin } from "@/lib/admin";
import { adminProducts } from "@/lib/queries-admin";
import { AdminPage } from "@/components/admin/ui";
import ImportExport from "@/components/admin/ImportExport";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireAdmin("catalog");
  const rows = await adminProducts({ limit: 500 });
  return (
    <AdminPage title="Import / Export" sub="Move the catalogue in and out as CSV for bulk edits in a spreadsheet.">
      <ImportExport rows={rows as never} />
    </AdminPage>
  );
}
