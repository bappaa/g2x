import { DashSkeleton } from "@/components/Skeleton";

/**
 * Instant feedback for the whole sell wizard.
 *
 * Without a loading file Next streams the layout (sidebar + panel badge) and
 * leaves the content area empty until the server finishes — which looked like
 * a broken, half-rendered page while the seller waited. This covers every
 * nested step of /seller/sell.
 */
export default function Loading() {
  return <DashSkeleton />;
}
