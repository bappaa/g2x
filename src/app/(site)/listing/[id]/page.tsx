import { notFound, redirect } from "next/navigation";
import { one } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: { id: string } }) {
  const listing = await one<{
    id: string;
    game_slug: string;
    category_slug: string;
  }>(
    `SELECT id, game_slug, category_slug FROM listings WHERE id = ?`,
    [params.id]
  );

  if (!listing) notFound();

  redirect(`/g/${listing.game_slug}/${listing.category_slug}/${listing.id}`);
}
