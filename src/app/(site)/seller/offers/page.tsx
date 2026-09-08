import { requireUser } from "@/lib/session";
import { getSellerOffers, getCatalogForSeller, getAllFieldTemplates } from "@/lib/queries";
import OffersView from "@/components/seller/OffersView";

export const dynamic = "force-dynamic";
export const metadata = { title: "My Offers — G2X.GG" };

export default async function Page({ searchParams }: { searchParams: { status?: string; cat?: string } }) {
  const u = await requireUser();
  const [offers, catalog, fields] = await Promise.all([
    getSellerOffers(u.id, searchParams.status, searchParams.cat),
    getCatalogForSeller(),
    getAllFieldTemplates(),
  ]);
  return (
    <OffersView
      offers={offers as never}
      catalog={catalog}
      fields={fields}
      status={searchParams.status ?? "all"}
      category={searchParams.cat ?? ""}
    />
  );
}
