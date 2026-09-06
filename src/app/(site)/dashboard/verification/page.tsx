import { requireUser } from "@/lib/session";
import { one } from "@/lib/db";
import { kycThreshold } from "@/lib/buyer-kyc";
import BuyerKyc from "@/components/dash/BuyerKyc";

export const dynamic = "force-dynamic";
export const metadata = { title: "Identity Verification — G2X.GG" };

export default async function Page() {
  const u = await requireUser();
  const [current, threshold] = await Promise.all([
    one<{
      status: string;
      full_name: string;
      review_note: string | null;
      submitted_at: string;
      reviewed_at: string | null;
    }>(
      `SELECT status, full_name, review_note, submitted_at, reviewed_at
         FROM buyer_verifications WHERE user_id=? ORDER BY submitted_at DESC LIMIT 1`,
      [u.id]
    ),
    kycThreshold(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[19px] font-black tracking-tight sm:text-[24px]">Identity Verification</h1>
        <p className="mt-1 text-[12px] muted">
          Required once for deposits and purchases of ${threshold} or more.
        </p>
      </div>
      <BuyerKyc current={current} threshold={threshold} spendable={current?.status === "approved"} />
    </div>
  );
}
