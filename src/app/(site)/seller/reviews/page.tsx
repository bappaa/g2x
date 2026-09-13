import { requireUser } from "@/lib/session";
import { getSellerReviews } from "@/lib/queries";
import SellerReviews from "@/components/seller/SellerReviews";

export const dynamic = "force-dynamic";
export const metadata = { title: "Seller Reviews — G2X.GG" };

export default async function Page() {
  const u = await requireUser();
  return <SellerReviews reviews={(await getSellerReviews(u.id)) as never} />;
}
