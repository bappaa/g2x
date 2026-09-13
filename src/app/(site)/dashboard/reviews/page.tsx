import { requireUser } from "@/lib/session";
import { getBuyerReviewables } from "@/lib/queries";
import ReviewsView from "@/components/dash/ReviewsView";

export const dynamic = "force-dynamic";
export const metadata = { title: "My Reviews — G2X.GG" };

export default async function Page() {
  const u = await requireUser();
  return <ReviewsView items={(await getBuyerReviewables(u.id)) as never} />;
}
