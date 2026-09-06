import { requireAdmin } from "@/lib/admin";
import { adminSettings } from "@/lib/queries-admin";
import { AdminPage } from "@/components/admin/ui";
import SettingsForm from "@/components/admin/SettingsForm";
import ContentReset from "@/components/admin/ContentReset";
import { fxStatus } from "@/lib/fx";
import { getRates } from "@/lib/locale";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireAdmin("settings");
  const rows = await adminSettings();
  const map: Record<string, string> = {};
  rows.forEach((r) => (map[r.key] = r.value));

  const [status, live] = await Promise.all([fxStatus(), getRates()]);
  const fx = {
    live,
    manual: status.manual,
    ageLabel: status.ageLabel,
    source: status.source,
  };
  return (
    <AdminPage title="System Settings" sub="Global marketplace rules — commission, payouts, escrow and policy.">
      <SettingsForm values={map} fx={fx} />
          <div className="mt-6">
        <ContentReset />
      </div>
    </AdminPage>
  );
}
