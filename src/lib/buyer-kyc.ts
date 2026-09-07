import "server-only";
import { one, run } from "./db";


/**
 * Buyer identity check — POST-PAYMENT.
 *
 * Previously a buyer moving the threshold amount or more (default $30) was
 * blocked until an admin approved their ID, which stopped the sale dead at the
 * moment of highest intent.
 *
 * The flow is now inverted: the payment always goes through, and the
 * transaction itself *flags the account* as owing verification
 * (`users.kyc_due_at`). The buyer is routed to the verification tab
 * immediately afterwards to submit their details, and an admin reviews it as
 * usual. Nothing about the review, the notifications or the admin screens
 * changes — only when the buyer is asked.
 *
 * The threshold is admin-configurable via `kyc_threshold`, and the whole thing
 * can be switched off with `buyer_kyc = off`.
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
 * Does this transaction oblige the buyer to verify afterwards?
 * Pure check — no writes, safe to call before the money moves.
 */
export async function kycDueFor(userId: string, amount: number): Promise<boolean> {
  if (!(await kycEnabled())) return false;
  if (amount < (await kycThreshold())) return false;

  const status = await buyerKycStatus(userId);
  // Approved buyers are done; a pending review is already in the admin queue.
  return status !== "approved" && status !== "pending";
}

/**
 * Called AFTER a qualifying payment succeeds. Stamps the account as owing a
 * verification so the dashboard, the nav badge and the middleware can all
 * prompt for it. Idempotent: an existing unmet obligation is left with its
 * original timestamp so the deadline cannot be reset by transacting again.
 *
 * Never throws — a bookkeeping failure must not undo a completed payment.
 */
export async function markKycDue(userId: string, reason: string): Promise<void> {
  try {
    await run(
      `UPDATE users SET kyc_due_at = COALESCE(kyc_due_at, datetime('now')), kyc_due_reason = ?
        WHERE id = ? AND kyc_due_at IS NULL`,
      [reason, userId]
    );
  } catch {
    /* non-fatal */
  }
}

/** Clears the obligation once the buyer submits (or an admin approves). */
export async function clearKycDue(userId: string): Promise<void> {
  try {
    await run(`UPDATE users SET kyc_due_at = NULL, kyc_due_reason = NULL WHERE id = ?`, [userId]);
  } catch {
    /* non-fatal */
  }
}

/** Is this buyer currently being asked to verify? Drives the dashboard prompt. */
export async function pendingKycPrompt(
  userId: string
): Promise<{ due: boolean; since: string | null; reason: string | null; status: KycStatus }> {
  const r = await one<{ kyc_due_at: string | null; kyc_due_reason: string | null }>(
    `SELECT kyc_due_at, kyc_due_reason FROM users WHERE id=?`,
    [userId]
  );
  const status = await buyerKycStatus(userId);
  // A submitted or approved check satisfies the obligation regardless of flag.
  const settled = status === "pending" || status === "approved";
  return {
    due: !!r?.kyc_due_at && !settled,
    since: r?.kyc_due_at ?? null,
    reason: r?.kyc_due_reason ?? null,
    status,
  };
}

/**
 * Legacy pre-payment gate. Retained so any caller that still wants a hard
 * block keeps working, but it is no longer used on the buyer money paths —
 * see `kycDueFor` + `markKycDue` for the post-payment flow.
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
