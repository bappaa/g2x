import { requireAdmin } from "@/lib/admin";
import { adminBanners } from "@/lib/queries-admin";
import { AdminPage, FilterTabs } from "@/components/admin/ui";
import BannersManager from "@/components/admin/BannersManager";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: { placement?: string } }) {
  await requireAdmin("cms");
  const placement = searchParams.placement ?? "all";
  const rows = await adminBanners(placement);
  return (
    <AdminPage
      title="Banners"
      sub="Hero slides and promo strips shown on the homepage and category pages."
    >
      <FilterTabs
        base="/admin/banners"
        tabs={["all", "hero", "strip", "sidebar", "category"]}
        active={placement}
        param="placement"
      />
      <BannersManager rows={rows as never} />
    </AdminPage>
  );
}
