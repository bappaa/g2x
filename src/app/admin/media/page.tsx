import { requireAdmin } from "@/lib/admin";
import { adminMedia, adminGames } from "@/lib/queries-admin";
import { AdminPage } from "@/components/admin/ui";
import MediaLibrary from "@/components/admin/MediaLibrary";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: { kind?: string } }) {
  await requireAdmin("cms");
  const kind = searchParams.kind ?? "all";
  const [rows, games] = await Promise.all([adminMedia(kind), adminGames()]);
  return (
    <AdminPage
      title="Media Library"
      sub="Every image on the site lives here — upload once, then assign it to a game icon, banner or product."
    >
      <MediaLibrary rows={rows as never} games={games as never} kind={kind} />
    </AdminPage>
  );
}
