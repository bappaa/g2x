import { requireAdmin } from "@/lib/admin";
import { adminSettings } from "@/lib/queries-admin";
import { AdminPage } from "@/components/admin/ui";
import SettingsForm from "@/components/admin/SettingsForm";
import ContentReset from "@/components/admin/ContentReset";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireAdmin("settings");
  const rows = await adminSettings();
  const map: Record<string, string> = {};
  rows.forEach((r) => (map[r.key] = r.value));
  return (
    <AdminPage title="System Settings" sub="Global marketplace rules — commission, payouts, escrow and policy.">
      <SettingsForm values={map} />
          <div className="mt-6">
        <ContentReset />
      </div>
    </AdminPage>
  );
}
