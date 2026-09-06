import { requireAdmin } from "@/lib/admin";
import { adminCategories, adminTemplates } from "@/lib/queries-admin";
import { AdminPage } from "@/components/admin/ui";
import TemplatesManager from "@/components/admin/TemplatesManager";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: { category?: string } }) {
  await requireAdmin("catalog");
  const cats = (await adminCategories()) as { slug: string; name: string }[];
  const category = searchParams.category ?? cats[0]?.slug ?? "";
  const fields = category ? await adminTemplates(category) : [];
  return (
    <AdminPage
      title="Service Templates"
      sub="Define the dynamic fields a seller must fill in for each category — and which of them buyers see."
    >
      <TemplatesManager categories={cats} category={category} fields={fields as never} />
    </AdminPage>
  );
}
