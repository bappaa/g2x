import { requireAdmin } from "@/lib/admin";
import {
  adminProducts, adminProductsCount, adminGames, adminCategories, optionGroups,
} from "@/lib/queries-admin";
import { AdminPage } from "@/components/admin/ui";
import ProductsManager from "@/components/admin/ProductsManager";

export const dynamic = "force-dynamic";

/** Rows per page. Keeps the payload flat however large the catalog grows. */
const PER_PAGE = 50;

export default async function Page({
  searchParams,
}: {
  searchParams: { game?: string; category?: string; q?: string; page?: string };
}) {
  await requireAdmin("catalog");
  const page = Math.max(1, Number(searchParams.page ?? 1) || 1);
  const filters = {
    game: searchParams.game,
    category: searchParams.category,
    q: searchParams.q,
  };

  const [rows, total, games, cats, options] = await Promise.all([
    adminProducts({ ...filters, limit: PER_PAGE, offset: (page - 1) * PER_PAGE }),
    adminProductsCount(filters),
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
        filters={{
          game: searchParams.game ?? "",
          category: searchParams.category ?? "",
          q: searchParams.q ?? "",
        }}
        options={options as never}
        page={page}
        perPage={PER_PAGE}
        total={Number(total?.n ?? 0)}
      />
    </AdminPage>
  );
}
