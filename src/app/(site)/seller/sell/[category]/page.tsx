import { notFound } from "next/navigation";
import { requireSeller } from "@/lib/session";
import { getSellConfig, getSellGames } from "@/lib/queries";
import { GamePicker, SellCrumbs, SellHeader, SellNotice } from "@/components/seller/SellWizard";

export const dynamic = "force-dynamic";

/** Step 2 of the sell flow — pick the game. */
export default async function Page({ params }: { params: { category: string } }) {
  await requireSeller();
  const cfg = await getSellConfig(params.category);
  if (!cfg) notFound();
  const games = await getSellGames(cfg.slug);

  return (
    <div>
      <SellCrumbs category={cfg.slug} categoryName={cfg.name} step={2} />
      <SellHeader title={`Sell Game ${cfg.name}`} step="Step 2/3" />
      <div className="mx-auto max-w-[640px]">
        <SellNotice title={cfg.sell_notice_title} body={cfg.sell_notice} />
      </div>
      <GamePicker games={games} category={cfg.slug} />
    </div>
  );
}
