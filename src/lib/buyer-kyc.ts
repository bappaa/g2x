import "server-only";
import { one } from "./db";


/**
 * Buyer identity gate.
 *
 * Once a buyer tries to move money at or above the configured threshold
 * (default $30) in a single transaction — a wallet top-up or a checkout — they
 * must pass a light KYC check first: ID number, a photo of the ID and a face
 * photo. The admin approves or rejects it in Admin → Buyer KYC.
 *
 * The threshold is admin-configurable via the `kyc_threshold` setting, and the
 * whole gate can be switched off with `buyer_kyc = off`.
 */

export type KycStatus = "none" | "pending" | "approved" | "rejected" | "resubmit";

async function setting(key: string): Promise<string> {
  const r = await one<{ value: string }>(`SELECT value FROM settings WHERE key=?`, [key]);
  return r?.value ?? "";
}

export async function kycThreshold(): Promise<number> {
  const raw = await setting("kyc_threshold");
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 30;
}

export async function kycEnabled(): Promise<boolean> {
  return (await setting("buyer_kyc")) !== "off";
}

export async function buyerKycStatus(userId: string): Promise<KycStatus> {
  const r = await one<{ status: string }>(
    `SELECT status FROM buyer_verifications WHERE user_id=? ORDER BY submitted_at DESC LIMIT 1`,
    [userId]
  );
  return (r?.status as KycStatus) ?? "none";
}

export type GateResult =
  | { ok: true }
  | { ok: false; needsKyc: true; status: KycStatus; threshold: number; error: string };

/**
 * Call this in every server action that moves `amount` for `userId`.
 * Returns `{ok:true}` when the buyer may proceed.
 */
export async function requireKycFor(userId: string, amount: number): Promise<GateResult> {
  if (!(await kycEnabled())) return { ok: true };

  const threshold = await kycThreshold();
  if (amount < threshold) return { ok: true };

  const status = await buyerKycStatus(userId);
  if (status === "approved") return { ok: true };

  const error =
    status === "pending"
      ? `Your identity check is still under review. Transactions of $${threshold} or more unlock as soon as it is approved.`
      : status === "rejected"
      ? `Your identity check was rejected. Please resubmit it before making transactions of $${threshold} or more.`
      : `Identity verification is required for transactions of $${threshold} or more. It only takes a minute.`;

  return { ok: false, needsKyc: true, status, threshold, error };
}
