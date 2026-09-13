"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star, Loader2, CheckCircle2 } from "lucide-react";
import { Btn, inputCls } from "@/components/ui";
import { submitReviewAction } from "@/lib/actions/shop";

/**
 * WRITE-ONLY REVIEW WIDGET
 * ========================
 * Lives on the order detail page, replacing the old "My Reviews" sidebar tab.
 *
 * By design the buyer can submit a review but never read it back — only the
 * seller and the admin can see what was written. So after submitting we show a
 * plain confirmation rather than echoing the stars or the text, and the
 * component never receives existing review content as a prop. `reviewed` is a
 * boolean, deliberately: if the body were passed in it would be visible in the
 * page source regardless of what the UI chose to render.
 */
export default function OrderReview({
  orderCode,
  sellerId,
  storeName,
  reviewed,
}: {
  orderCode: string;
  sellerId: string;
  storeName: string;
  /** Whether a review already exists — never the review itself. */
  reviewed: boolean;
}) {
  const router = useRouter();
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  if (reviewed || done)
    return (
      <div className="rounded-2xl panel p-4 sm:p-5">
        <div className="flex items-start gap-2.5">
          <CheckCircle2 size={17} className="mt-px shrink-0 text-emerald-400" />
          <div>
            <h3 className="text-[14px] font-bold">Thanks for your review</h3>
            <p className="mt-1 text-[11.5px] leading-relaxed muted">
              Your feedback has been sent to {storeName}. Reviews are visible to the seller and
              the G2X team, and help other buyers choose a trustworthy seller.
            </p>
          </div>
        </div>
      </div>
    );

  const submit = () => {
    setErr("");
    if (stars < 1) return setErr("Pick a star rating first.");
    if (body.trim().length < 5) return setErr("Please write at least a few words.");

    start(async () => {
      const r = await submitReviewAction({ orderCode, sellerId, stars, body });
      if (!r.ok) return setErr(r.error || "Could not submit your review.");
      setDone(true);
      router.refresh();
    });
  };

  return (
    <div className="rounded-2xl panel p-4 sm:p-5">
      <h3 className="text-[14px] font-bold">Rate this seller</h3>
      <p className="mt-1 text-[11.5px] muted">
        How was your experience with {storeName}?
      </p>

      <div className="mt-3 flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setStars(n)}
            onMouseEnter={() => setHover(n)}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            className="p-0.5 transition-transform hover:scale-110"
          >
            <Star
              size={22}
              className={
                n <= (hover || stars) ? "fill-amber-400 text-amber-400" : "text-[var(--line)]"
              }
            />
          </button>
        ))}
        {stars > 0 && <span className="ml-2 text-[12px] font-semibold">{stars}/5</span>}
      </div>

      <textarea
        rows={3}
        className={`${inputCls} mt-3`}
        placeholder="Tell other buyers how the delivery went…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />

      {err && (
        <div className="mt-2 rounded-lg bg-rose-500/10 px-3 py-2 text-[11.5px] text-rose-400">
          {err}
        </div>
      )}

      <Btn className="mt-3 flex w-full items-center justify-center gap-2" disabled={pending} onClick={submit}>
        {pending && <Loader2 size={13} className="animate-spin" />} Submit review
      </Btn>
      <p className="mt-2 text-[10.5px] muted">
        Your review is shared with the seller and the G2X team.
      </p>
    </div>
  );
}
