import { redirect } from "next/navigation";

/**
 * The standalone "Listings" page folded into the My Offers drawer, which is
 * where sellers now manage everything they sell. Kept as a redirect so old
 * links and bookmarks still land somewhere sensible.
 */
export default function Page() {
  redirect("/seller/offers");
}
