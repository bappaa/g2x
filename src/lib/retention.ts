import "server-only";
import { run } from "./db";
import { runAfter } from "./after";

/**
 * CHAT MEDIA RETENTION
 * ====================
 * Images and videos are stored as base64 in the database (the host has no
 * writable disk), which is convenient but expensive: a handful of screenshots
 * outweighs every text message on the site combined.
 *
 * So attachments are evidence with a shelf life. Ten days after upload the
 * binary payload is blanked and the row is marked `purged=1` — the message
 * itself stays in the conversation as "attachment expired", so the history
 * still reads correctly and nothing is silently deleted.
 *
 * The one exception is an attachment belonging to a dispute that is still
 * `open` or `under_review`. Destroying evidence while a case is live would be
 * indefensible, so those are kept until the dispute closes; the ten-day clock
 * then applies from the next sweep onward.
 *
 * Text is never purged. Only the heavy `attachment_data` column is cleared.
 */

/** Retention window in days. */
export const RETENTION_DAYS = 10;

export type PurgeResult = { chat: number; dispute: number };

export async function purgeExpiredMedia(): Promise<PurgeResult> {
  const cutoff = `-${RETENTION_DAYS} days`;
  let chat = 0;
  let dispute = 0;

  // --- buyer <-> seller chat -------------------------------------------
  try {
    const r = await run(
      `UPDATE messages
          SET attachment_data = NULL, purged = 1
        WHERE attachment_data IS NOT NULL
          AND COALESCE(purged,0) = 0
          AND datetime(created_at) <= datetime('now', ?)
          AND NOT EXISTS (
                SELECT 1 FROM disputes d
                 WHERE d.thread_id = messages.thread_id
                   AND d.status IN ('open','under_review')
              )`,
      [cutoff]
    );
    chat = Number(r?.rowsAffected ?? 0);
  } catch {
    /* column or table not present yet */
  }

  // --- dispute thread ---------------------------------------------------
  try {
    const r = await run(
      `UPDATE dispute_messages
          SET attachment_data = NULL, purged = 1
        WHERE attachment_data IS NOT NULL
          AND COALESCE(purged,0) = 0
          AND datetime(created_at) <= datetime('now', ?)
          AND NOT EXISTS (
                SELECT 1 FROM disputes d
                 WHERE d.id = dispute_messages.dispute_id
                   AND d.status IN ('open','under_review')
              )`,
      [cutoff]
    );
    dispute = Number(r?.rowsAffected ?? 0);
  } catch {
    /* column or table not present yet */
  }

  return { chat, dispute };
}

/**
 * Fire-and-forget sweep, throttled to once an hour per process.
 *
 * There is no cron on the serverless host, so housekeeping rides along with
 * ordinary page renders. Deliberately never awaited by the caller and never
 * throws: a storage chore must not slow down or break a page.
 */
let inflight: Promise<unknown> | null = null;
let lastRun = 0;
const MIN_GAP_MS = 60 * 60 * 1000;

export function purgeMediaInBackground(): void {
  if (inflight || Date.now() - lastRun < MIN_GAP_MS) return;
  lastRun = Date.now();
  runAfter(() => {
    inflight = purgeExpiredMedia()
      .catch(() => null)
      .finally(() => {
        inflight = null;
      });
    return inflight;
  });
}
