import { requireAdmin } from "@/lib/admin";
import { adminProducts, adminGames, adminCategories, optionGroups } from "@/lib/queries-admin";
import { AdminPage } from "@/components/admin/ui";
import ProductsManager from "@/components/admin/ProductsManager";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: { game?: string; category?: string; q?: string };
}) {
  await requireAdmin("catalog");
  const [rows, games, cats, options] = await Promise.all([
    adminProducts({ game: searchParams.game, category: searchParams.category, q: searchParams.q, limit: 300 }),
    adminGames(),
    adminCategories(),
    optionGroups(),
  ]);
  return (
    <AdminPage
      title="Products & Denominations"
      sub="Admin defines what can be sold. Sellers then create offers with their own price and stock."
    >
      <ProductsManager
        rows={rows as never}
        games={games as never}
        categories={cats as never}
        filters={{ game: searchParams.game ?? "", category: searchParams.category ?? "", q: searchParams.q ?? "" }}
        options={options as never}
      />
    </AdminPage>
  );
}
