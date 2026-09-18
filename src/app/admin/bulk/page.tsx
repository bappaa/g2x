import { requireAdmin } from "@/lib/admin";
import { adminGames, adminCategories } from "@/lib/queries-admin";
import { getAllGameOfferFields } from "@/lib/queries";
import { AdminPage } from "@/components/admin/ui";
import BulkProducts from "@/components/admin/BulkProducts";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireAdmin("catalog");
  const [games, cats, allFields] = await Promise.all([adminGames(), adminCategories(), getAllGameOfferFields()]);

  return (
    <AdminPage
      title="Bulk add products"
      sub="Create the same denominations across many games at once. Each product inherits the game's logo."
    >
      <BulkProducts
        games={(games as { slug: string; name: string }[]).map((g) => ({ slug: g.slug, name: g.name }))}
        categories={(cats as { slug: string; name: string }[]).map((c) => ({ slug: c.slug, name: c.name }))}
        allFields={allFields as never}
      />
    </AdminPage>
  );
}