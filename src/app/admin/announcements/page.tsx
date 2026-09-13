import { requireAdmin } from "@/lib/admin";
import { adminAnnouncements } from "@/lib/queries-admin";
import { AdminPage } from "@/components/admin/ui";
import AnnouncementsManager from "@/components/admin/AnnouncementsManager";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireAdmin("promotions");
  const rows = await adminAnnouncements();
  return (
    <AdminPage title="Announcements" sub="Messages shown in the site-wide banner and the promo marquee.">
      <AnnouncementsManager rows={rows as never} />
    </AdminPage>
  );
}
