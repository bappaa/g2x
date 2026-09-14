import { requireUser } from "@/lib/session";
import { one } from "@/lib/db";
import { kycThreshold, pendingKycPrompt } from "@/lib/buyer-kyc";
import BuyerKyc from "@/components/dash/BuyerKyc";

export const dynamic = "force-dynamic";
export const metadata = { title: "Identity Verification — G2X.GG" };

export default async function Page({ searchParams }: { searchParams: { after?: string } }) {
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

  const prompt = await pendingKycPrompt(u.id);
  /** Set when we arrived straight from a completed payment. */
  const justPaid = searchParams.after;

  // If already verified, hide verification UI entirely for cleaner dashboard
  const isVerified = current?.status === "approved";
  if (isVerified && !justPaid) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-500/20 text-emerald-400">✓</div>
          <h1 className="mt-3 text-[18px] font-black">You are verified</h1>
          <p className="mt-1 text-[12px] muted">Identity verification completed. All limits lifted. This section is now hidden for a cleaner UI.</p>
          <a href="/dashboard" className="mt-4 inline-flex rounded-lg bg-brand-600 px-4 py-2 text-[12px] font-bold text-white hover:bg-brand-500">Go to Dashboard</a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[19px] font-black tracking-tight sm:text-[24px]">Identity Verification</h1>
        <p className="mt-1 text-[12px] muted">
          A one-time check, requested after a deposit or purchase of ${threshold} or more.
        </p>
      </div>

      {justPaid && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <div className="text-[13.5px] font-bold text-emerald-400">
            Payment successful{justPaid !== "topup" ? ` — order ${justPaid}` : ""}
          </div>
          <p className="mt-1 text-[12px] leading-relaxed muted">
            Your payment went through and nothing is on hold. As a final step, please confirm your
            identity below — it takes about a minute and keeps your account fully active.
          </p>
        </div>
      )}

      <BuyerKyc
        current={current}
        threshold={threshold}
        spendable={current?.status === "approved"}
        due={prompt.due}
        dueReason={prompt.reason}
      />
    </div>
  );
}