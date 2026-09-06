import { requireUser } from "@/lib/session";
import { getWishlist } from "@/lib/queries";
import WishlistView from "@/components/dash/WishlistView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Wishlist — G2X.GG" };

export default async function Page() {
  const u = await requireUser();
  return <WishlistView items={(await getWishlist(u.id)) as never} />;
}
