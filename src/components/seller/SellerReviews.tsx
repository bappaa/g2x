"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star, Reply, Loader2 } from "lucide-react";
import { Btn, Empty, inputCls } from "@/components/ui";
import { when } from "@/lib/fmt";
import { replyReviewAction } from "@/lib/actions/seller";

type R = { id: string; buyer_name: string; stars: number; body: string; reply: string | null; created_at: string };

export default function SellerReviews({ reviews }: { reviews: R[] }) {
  if (!reviews.length)
    return (
      <div className="space-y-4">
        <h1 className="text-[18px] font-black sm:text-[22px] tracking-tight">Reviews</h1>
        <Empty title="No reviews yet" sub="Deliver fast and buyers will leave you 5 stars." />
      </div>
    );

  const avg = reviews.reduce((s, r) => s + r.stars, 0) / reviews.length;
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, c: reviews.filter((r) => r.stars === n).length }));

  return (
    <div className="space-y-4">
      <h1 className="text-[18px] font-black sm:text-[22px] tracking-tight">Reviews</h1>

      <div className="flex flex-wrap gap-6 rounded-2xl panel p-4 sm:p-5">
        <div className="text-center">
          <div className="text-[36px] font-black leading-none">{avg.toFixed(1)}</div>
          <div className="mt-1 flex justify-center gap-0.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star key={s} size={12} className={s <= Math.round(avg) ? "fill-amber-400 text-amber-400" : "muted"} />
            ))}
          </div>
          <div className="mt-1 text-[11px] muted">{reviews.length} reviews</div>
        </div>
        <div className="min-w-[200px] flex-1 space-y-1">
          {dist.map((d) => (
            <div key={d.n} className="flex items-center gap-2 text-[11px]">
              <span className="w-3 muted">{d.n}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full soft">
                <div
                  className="h-full rounded-full bg-amber-400"
                  style={{ width: `${(d.c / reviews.length) * 100}%` }}
                />
              </div>
              <span className="w-6 text-right muted">{d.c}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2.5">
        {reviews.map((r) => (
          <ReviewCard key={r.id} r={r} />
        ))}
      </div>
    </div>
  );
}

function ReviewCard({ r }: { r: R }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div className="rounded-2xl panel p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 to-brand-700 text-[11px] font-bold text-white">
          {r.buyer_name.slice(0, 1).toUpperCase()}
        </span>
        <div>
          <div className="text-[12.5px] font-bold">{r.buyer_name}</div>
          <div className="flex items-center gap-1.5">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} size={10} className={s <= r.stars ? "fill-amber-400 text-amber-400" : "muted"} />
              ))}
            </div>
            <span className="text-[10.5px] muted">{when(r.created_at)}</span>
          </div>
        </div>
      </div>

      <p className="mt-2 text-[12.5px]">{r.body}</p>

      {r.reply ? (
        <div className="mt-2 rounded-lg soft p-2.5 text-[12px]">
          <div className="mb-0.5 text-[10.5px] font-semibold text-brand-400">Your reply</div>
          {r.reply}
        </div>
      ) : open ? (
        <div className="mt-2 flex gap-2">
          <input className={inputCls} placeholder="Thanks for the review!" value={text} onChange={(e) => setText(e.target.value)} />
          <Btn
            disabled={pending || !text.trim()}
            onClick={() =>
              start(async () => {
                await replyReviewAction(r.id, text);
                setText("");
                setOpen(false);
                router.refresh();
              })
            }
          >
            {pending ? <Loader2 size={13} className="animate-spin" /> : "Reply"}
          </Btn>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="mt-2 flex items-center gap-1 text-[11.5px] text-brand-400 hover:underline">
          <Reply size={12} /> Reply
        </button>
      )}
    </div>
  );
}
