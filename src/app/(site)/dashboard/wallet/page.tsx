import { requireUser } from "@/lib/session";
import { getWallet } from "@/lib/queries";
import WalletView from "@/components/dash/WalletView";
import { getGateways } from "@/lib/gateways";

export const dynamic = "force-dynamic";
export const metadata = { title: "Wallet — G2X.GG" };

export default async function Page() {
  const u = await requireUser();
  const [txns, gateways] = await Promise.all([getWallet(u.id), getGateways("topup")]);
  return <WalletView balance={u.balance} txns={txns as never} gateways={gateways} />;
}
