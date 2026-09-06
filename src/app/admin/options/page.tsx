import { requireAdmin } from "@/lib/admin";
import { adminOptions } from "@/lib/queries-admin";
import { AdminPage } from "@/components/admin/ui";
import OptionsManager from "@/components/admin/OptionsManager";

export const dynamic = "force-dynamic";

const LISTS = [
  { key: "login_method", name: "Login Method" },
  { key: "delivery_method", name: "Delivery Method" },
  { key: "region", name: "Region" },
  { key: "platform", name: "Platform" },
];

export default async function Page({ searchParams }: { searchParams: { list?: string } }) {
  await requireAdmin("catalog");
  const list = searchParams.list ?? LISTS[0].key;
  const rows = await adminOptions(list);
  return (
    <AdminPage
      title="Dropdown Options"
      sub="Everything that appears in a product dropdown — login method, delivery method, region and platform."
    >
      <OptionsManager lists={LISTS} list={list} rows={rows as never} />
    </AdminPage>
  );
}
