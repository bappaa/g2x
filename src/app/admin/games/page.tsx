import { requireAdmin } from "@/lib/admin";
import { adminGamesPage, adminGamesCount, adminCategories } from "@/lib/queries-admin";
import { AdminPage } from "@/components/admin/ui";
import GamesManager from "@/components/admin/GamesManager";

export const dynamic = "force-dynamic";

/** Rows per page — 169+ games in one table was ~660 KB of HTML. */
const PER_PAGE = 40;

export default async function Page({
  searchParams,
}: {
  searchParams: { q?: string; page?: string };
}) {
  await requireAdmin("catalog");
  const page = Math.max(1, Number(searchParams.page ?? 1) || 1);
  const q = searchParams.q?.trim() || undefined;

  const [games, total, cats] = await Promise.all([
    adminGamesPage({ q, limit: PER_PAGE, offset: (page - 1) * PER_PAGE }),
    adminGamesCount(q),
    adminCategories(),
  ]);

  return (
    <AdminPage title="Games" sub="Add or remove any game and choose which category pages it appears on.">
      <GamesManager
        games={games as never}
        categories={cats as never}
        page={page}
        perPage={PER_PAGE}
        total={Number(total?.n ?? 0)}
        query={searchParams.q ?? ""}
      />
    </AdminPage>
  );
}
