import { requireAdmin } from "@/lib/admin";
import { adminCmsBlocks } from "@/lib/queries-admin";
import { AdminPage } from "@/components/admin/ui";
import CmsManager from "@/components/admin/CmsManager";

export const dynamic = "force-dynamic";

const BLOCKS: { key: string; name: string }[] = [
  { key: "hero", name: "Hero Banner" },
  { key: "popular_games", name: "Popular Games" },
  { key: "popular_accounts", name: "Popular Accounts" },
  { key: "popular_currency", name: "Popular Currency" },
  { key: "popular_topup", name: "Popular Top Up" },
  { key: "popular_items", name: "Popular Items" },
  { key: "popular_boosting", name: "Popular Boosting" },
  { key: "popular_subscriptions", name: "Popular Subscriptions" },
  { key: "featured_offers", name: "Featured Offers" },
  { key: "featured_sellers", name: "Featured Sellers" },
  { key: "trust", name: "Trust / Why G2X" },
  { key: "reviews", name: "Reviews" },
  { key: "faq", name: "FAQ" },
  { key: "announcement_bar", name: "Announcement Bar" },
  { key: "promo_banner", name: "Promotional Banner" },
];

export default async function Page() {
  await requireAdmin("cms");
  const rows = await adminCmsBlocks();
  return (
    <AdminPage title="Homepage CMS" sub="Edit every homepage section without touching code.">
      <CmsManager blocks={BLOCKS} rows={rows as never} />
    </AdminPage>
  );
}
