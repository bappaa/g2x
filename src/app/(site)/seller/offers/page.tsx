import { requireUser } from "@/lib/session";
import { getSellerOffers, countSellerOffers, getAllFieldTemplates } from "@/lib/queries";
import OffersView from "@/components/seller/OffersView";

export const dynamic = "force-dynamic";
export const metadata = { title: "My Offers — G2X.GG" };

const PER_PAGE = 30;

export default async function Page({
  searchParams,
}: {
  searchParams: { status?: string; cat?: string; page?: string };
}) {
  const u = await requireUser();
  const page = Math.max(1, Number(searchParams.page ?? 1) || 1);

  // The product catalog is NOT fetched here — the edit modal loads it on
  // demand from /api/seller/catalog. Embedding it cost ~1.3 MB per page load.
  const [offers, total, fields] = await Promise.all([
    getSellerOffers(u.id, searchParams.status, searchParams.cat, PER_PAGE, (page - 1) * PER_PAGE),
    countSellerOffers(u.id, searchParams.status, searchParams.cat),
    getAllFieldTemplates(),
  ]);

  return (
    <OffersView
      offers={offers as never}
      fields={fields}
      status={searchParams.status ?? "all"}
      category={searchParams.cat ?? ""}
      page={page}
      perPage={PER_PAGE}
      total={Number(total?.n ?? 0)}
    />
  );
}
