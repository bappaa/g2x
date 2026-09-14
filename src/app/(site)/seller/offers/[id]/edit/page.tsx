import { notFound } from "next/navigation";
import { requireSeller } from "@/lib/session";
import { one } from "@/lib/db";
import { getSellConfig, getFieldTemplates, getOptionLists, mergeSellConfig } from "@/lib/queries";
import EditOfferForm from "@/components/seller/EditOfferForm";
import Image from "next/image";
import { img } from "@/lib/img";
import { Breadcrumb } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit Offer — G2X.GG" };

type OfferDbRow = {
  id: string;
  product_id: string;
  title: string | null;
  description: string | null;
  price: number;
  stock: number;
  min_qty: number | null;
  delivery_time: string | null;
  delivery_method: string | null;
  region: string | null;
  platform: string | null;
  login_method: string | null;
  instructions: string | null;
  auto_delivery: number | null;
  images: string | null;
  volume_discounts: string | null;
  accounts_data: string | null;
  custom_fields: string | null;
  product_name: string;
  product_image: string;
  game_slug: string;
  category_slug: string;
  product_slug: string;
  game_name: string;
  game_logo: string;
};

export default async function Page({ params }: { params: { id: string } }) {
  const s = await requireSeller();

  const offer = await one<OfferDbRow>(
    `SELECT o.*, p.name as product_name, p.image as product_image, p.game_slug, p.category_slug, p.slug as product_slug, g.name as game_name, g.logo as game_logo
     FROM offers o
     LEFT JOIN products p ON p.id=o.product_id
     LEFT JOIN games g ON g.slug=p.game_slug
     WHERE o.id=? AND o.seller_id=?`,
    [params.id, s.id]
  );
  if (!offer) notFound();

  const categorySlug = offer.category_slug || "currency";
  const cfg = await getSellConfig(categorySlug);
  if (!cfg) notFound();

  const product = {
    id: offer.product_id || "",
    name: offer.product_name || offer.title || "Product",
    image: offer.product_image || "/art/coins.png",
    base_price: 0,
  };

  const gameRow = offer.game_slug
    ? await one<{ name: string; logo: string }>(`SELECT name, logo FROM games WHERE slug=?`, [offer.game_slug])
    : null;

  const sell = mergeSellConfig(cfg, { category_slug: offer.category_slug } as unknown as Record<string, unknown>);

  const [fields, opts] = await Promise.all([
    getFieldTemplates(cfg.slug),
    getOptionLists(["region", "platform", "delivery_method", "delivery_time", "login_method"]),
  ]);

  return (
    <div className="space-y-4">
      <Breadcrumb
        items={[
          { label: "Seller", href: "/seller" },
          { label: "My Offers", href: "/seller/offers" },
          { label: `Edit ${offer.title || offer.product_name}` },
        ]}
      />
      <div className="rounded-2xl panel p-4">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 overflow-hidden rounded-lg soft">
            <Image src={img(offer.product_image || gameRow?.logo || "/art/coins.png")} alt="" fill className="object-cover" />
          </div>
          <div>
            <div className="text-[13px] font-bold">Sell Game {cfg.name}</div>
            <div className="text-[11px] muted">{gameRow?.name} · {offer.product_name}</div>
          </div>
        </div>
      </div>

      <EditOfferForm
        offer={offer as unknown as { id: string; title: string | null; description: string | null; price: number; stock: number; min_qty: number | null; delivery_time: string | null; delivery_method: string | null; region: string | null; platform: string | null; login_method: string | null; instructions: string | null; auto_delivery: number | null; images: string | null; volume_discounts: string | null; accounts_data: string | null; custom_fields: string | null }}
        config={sell}
        product={product}
        fields={fields}
        regions={opts.region ?? []}
        platforms={opts.platform ?? []}
        deliveryMethods={opts.delivery_method ?? []}
        deliveryTimes={opts.delivery_time ?? []}
        loginMethods={opts.login_method ?? []}
      />
    </div>
  );
}
