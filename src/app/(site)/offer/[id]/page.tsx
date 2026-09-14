import { notFound, redirect } from "next/navigation";
import { one } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: { id: string } }) {
  const offer = await one<{
    id: string;
    product_id: string;
    game_slug: string;
    category_slug: string;
    product_slug: string;
  }>(
    `SELECT o.id, o.product_id, p.game_slug, p.category_slug, p.slug AS product_slug
     FROM offers o
     LEFT JOIN products p ON p.id = o.product_id
     WHERE o.id = ?`,
    [params.id]
  );

  if (!offer) notFound();

  const game = offer.game_slug || "game";
  const cat = offer.category_slug || "currency";
  const slug = offer.product_slug || offer.product_id;

  redirect(`/g/${game}/${cat}/${slug}?offer=${offer.id}`);
}
