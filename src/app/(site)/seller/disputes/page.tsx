import { requireUser } from "@/lib/session";
import { getSellerDisputes } from "@/lib/queries";
import { all } from "@/lib/db";
import SellerDisputes from "@/components/seller/SellerDisputes";

export const dynamic = "force-dynamic";
export const metadata = { title: "Seller Disputes — G2X.GG" };

export default async function Page() {
  const u = await requireUser();
  const [disputes, msgs] = await Promise.all([
    getSellerDisputes(u.id),
    all(
      `SELECT dm.* FROM dispute_messages dm JOIN disputes d ON d.id=dm.dispute_id
        WHERE d.seller_id=? ORDER BY dm.created_at`,
      [u.id]
    ),
  ]);
  return <SellerDisputes disputes={disputes as never} messages={msgs as never} />;
}
