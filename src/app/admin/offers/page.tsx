import { requireAdmin } from "@/lib/admin";
import { adminOffers } from "@/lib/queries-admin";
import { AdminPage, FilterTabs } from "@/components/admin/ui";
import OffersModeration from "@/components/admin/OffersModeration";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: { status?: string; q?: string } }) {
  await requireAdmin("offers");
  const status = searchParams.status ?? "all";
  const rows = await adminOffers({ status, q: searchParams.q, limit: 300 });
  return (
    <AdminPage title="Manage Offers" sub="Moderate seller listings, pin the best ones and pause anything abusive.">
      <FilterTabs base="/admin/offers" tabs={["all", "active", "paused", "out_of_stock", "rejected"]} active={status} />
      <OffersModeration rows={rows as never} q={searchParams.q ?? ""} />
    </AdminPage>
  );
}
