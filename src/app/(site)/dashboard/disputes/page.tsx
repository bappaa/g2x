import { requireUser } from "@/lib/session";
import { getBuyerDisputes } from "@/lib/queries";
import { all } from "@/lib/db";
import DisputesView from "@/components/dash/DisputesView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Disputes — G2X.GG" };

export default async function Page() {
  const u = await requireUser();
  const disputes = (await getBuyerDisputes(u.id)) as { id: string }[];
  const msgs = await all(
    `SELECT dm.* FROM dispute_messages dm
       JOIN disputes d ON d.id = dm.dispute_id
      WHERE d.buyer_id=? ORDER BY dm.created_at`,
    [u.id]
  );
  return <DisputesView disputes={disputes as never} messages={msgs as never} />;
}
