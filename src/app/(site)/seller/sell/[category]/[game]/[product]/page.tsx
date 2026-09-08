import Image from "next/image";
import { notFound } from "next/navigation";
import { requireSeller } from "@/lib/session";
import { one } from "@/lib/db";
import { getSellConfig, getFieldTemplates, getOptionList } from "@/lib/queries";
import { SellCrumbs, SellHeader } from "@/components/seller/SellWizard";
import OfferForm from "@/components/seller/OfferForm";
import { img } from "@/lib/img";

export const dynamic = "force-dynamic";

/** Step 3b — price, stock and everything the admin asks for. */
export default async function Page({
  params,
}: {
  params: { category: string; game: string; product: string };
}) {
  await requireSeller();
  const cfg = await getSellConfig(params.category);
  if (!cfg) notFound();

  const [game, product] = await Promise.all([
    one<{ name: string; logo: string }>(
      `SELECT name, logo FROM games WHERE slug=? AND status='active'`,
      [params.game]
    ),
    params.product === "new"
      ? Promise.resolve(null)
      : one<{ id: string; name: string; image: string; base_price: number }>(
          `SELECT id, name, image, base_price FROM products
            WHERE id=? AND game_slug=? AND category_slug=? AND status='active'`,
          [params.product, params.game, cfg.slug]
        ),
  ]);
  if (!game) notFound();
  // "new" = a free-form listing (Accounts, Boosting): the seller titles it.
  if (params.product !== "new" && !product) notFound();

  const target = product ?? {
    id: "",
    name: game.name,
    image: game.logo,
    base_price: 0,
  };

  // Dropdown values are all admin-managed option lists.
  const [fields, regions, platforms, deliveryMethods, deliveryTimes, loginMethods] =
    await Promise.all([
      getFieldTemplates(cfg.slug),
      getOptionList("region"),
      getOptionList("platform"),
      getOptionList("delivery_method"),
      getOptionList("delivery_time"),
      getOptionList("login_method"),
    ]);

  return (
    <div>
      <SellCrumbs
        category={cfg.slug}
        categoryName={cfg.name}
        step={3}
        gameName="Item delivery and price"
      />
      <SellHeader
        title={`Sell Game ${cfg.name}`}
        subtitle={
          <>
            <span className="relative h-6 w-6 overflow-hidden rounded-md">
              <Image
                src={img(target.image || game.logo)}
                alt={target.name}
                fill
                sizes="24px"
                unoptimized={(target.image ?? "").startsWith("/api/")}
                className="object-cover"
              />
            </span>
            <span className="text-[13.5px] font-bold">{target.name}</span>
          </>
        }
      />
      <OfferForm
        config={cfg}
        product={target}
        game={params.game}
        fields={fields}
        regions={regions}
        platforms={platforms}
        deliveryMethods={deliveryMethods}
        deliveryTimes={deliveryTimes}
        loginMethods={loginMethods}
      />
    </div>
  );
}
