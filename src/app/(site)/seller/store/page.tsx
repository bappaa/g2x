import { requireUser } from "@/lib/session";
import { getSellerProfile } from "@/lib/queries";
import StoreSettings from "@/components/seller/StoreSettings";
import { one } from "@/lib/db";
import { FREE_CHANGES, usernameChangeFee } from "@/lib/username";

export const dynamic = "force-dynamic";
export const metadata = { title: "Store Settings — G2X.GG" };

type Prof = {
  store_name: string; slug: string; description: string | null; logo: string | null;
  banner: string | null; payout_method: string | null; payout_detail: string | null;
  whatsapp: string | null; telegram: string | null; discord: string | null;
  level: string; rating: number; total_orders: number; verified: number;
};

export default async function Page() {
  const u = await requireUser();
  const p = (await getSellerProfile(u.id)) as Prof;
  const userRow = await one<{ username: string | null; username_changes: number; balance: number }>(
    `SELECT username, username_changes, balance FROM users WHERE id=?`,
    [u.id]
  );
  const fee = await usernameChangeFee();
  return (
    <StoreSettings
      profile={p}
      username={userRow?.username ?? ""}
      changesUsed={Number(userRow?.username_changes ?? 0)}
      freeChanges={FREE_CHANGES}
      fee={fee}
      balance={Number(userRow?.balance ?? 0)}
    />
  );
}