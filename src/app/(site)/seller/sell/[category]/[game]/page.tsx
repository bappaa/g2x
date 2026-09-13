import { notFound, redirect } from "next/navigation";
import { requireSeller } from "@/lib/session";
import { one } from "@/lib/db";
import { getSellConfig, getSellProducts } from "@/lib/queries";
import { ProductPicker, SellCrumbs, SellHeader } from "@/components/seller/SellWizard";

export const dynamic = "force-dynamic";

/** Step 3a — pick which admin-listed product this offer is for. */
export default async function Page({
  params,
}: {
  params: { category: string; game: string };
}) {
  await requireSeller();
  const cfg = await getSellConfig(params.category);
  if (!cfg) notFound();

  const game = await one<{ name: string }>(
    `SELECT name FROM games WHERE slug=? AND status='active'`,
    [params.game]
  );
  if (!game) notFound();

  const products = await getSellProducts(params.game, cfg.slug);

  /**
   * Accounts and Boosting have no admin-defined products — every listing is a
   * unique item the seller describes themselves. Skip the product step and go
   * straight to the offer form.
   */
  if (!products.length) {
    redirect(`/seller/sell/${cfg.slug}/${params.game}/new`);
  }

  return (
    <div>
      <SellCrumbs category={cfg.slug} categoryName={cfg.name} step={3} gameName={game.name} />
      <SellHeader title={`Sell Game ${cfg.name}`} step={`${game.name} — choose a product`} />
      <ProductPicker
        products={products}
        category={cfg.slug}
        game={params.game}
        gameName={game.name}
      />
    </div>
  );
}
