import { requireAdmin } from "@/lib/admin";
import { adminGames, adminCategories } from "@/lib/queries-admin";
import { AdminPage } from "@/components/admin/ui";
import GamesManager from "@/components/admin/GamesManager";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireAdmin("catalog");
  const [games, cats] = await Promise.all([adminGames(), adminCategories()]);
  return (
    <AdminPage title="Games" sub="Add or remove any game and choose which category pages it appears on.">
      <GamesManager games={games as never} categories={cats as never} />
    </AdminPage>
  );
}
