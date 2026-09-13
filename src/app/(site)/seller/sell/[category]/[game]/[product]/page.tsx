import Image from "next/image";
import { notFound } from "next/navigation";
import { requireSeller } from "@/lib/session";
import { one } from "@/lib/db";
import { getSellConfig, getFieldTemplates, getOptionLists, mergeSellConfig } from "@/lib/queries";
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
      : one<Record<string, unknown>>(
          // `p.*` so the per-product sell-flow overrides come along too.
          `SELECT * FROM products
            WHERE id=? AND game_slug=? AND category_slug=? AND status='active'`,
          [params.product, params.game, cfg.slug]
        ),
  ]);
  if (!game) notFound();
  // "new" = a free-form listing (Accounts, Boosting): the seller titles it.
  if (params.product !== "new" && !product) notFound();

  const target = product
    ? {
        id: String(product.id),
        name: String(product.name),
        image: String(product.image ?? ""),
        base_price: Number(product.base_price ?? 0),
      }
    : { id: "", name: game.name, image: game.logo, base_price: 0 };

  // Product overrides win over the category defaults.
  const sell = mergeSellConfig(cfg, product);

  // Dropdown values are all admin-managed option lists.
  const [fields, opts] = await Promise.all([
    getFieldTemplates(cfg.slug),
    // One query for all five dropdowns instead of five round-trips.
    getOptionLists(["region", "platform", "delivery_method", "delivery_time", "login_method"]),
  ]);
  const regions = opts.region ?? [];
  const platforms = opts.platform ?? [];
  const deliveryMethods = opts.delivery_method ?? [];
  const deliveryTimes = opts.delivery_time ?? [];
  const loginMethods = opts.login_method ?? [];

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
        config={sell}
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
