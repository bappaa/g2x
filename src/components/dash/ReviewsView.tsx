"use client";
import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star, Loader2 } from "lucide-react";
import { Empty, Btn, inputCls } from "@/components/ui";
import { when } from "@/lib/fmt";
import { submitReviewAction } from "@/lib/actions/shop";

type It = {
  id: string; code: string; seller_id: string; store_name: string; title: string; image: string;
  ordered_at: string; review_id: string | null; review_stars: number | null; review_body: string | null;
};

export default function ReviewsView({ items }: { items: It[] }) {
  const router = useRouter();
  const pendingItems = items.filter((i) => !i.review_id);
  const done = items.filter((i) => i.review_id);

  return (
    <div className="space-y-5">
      <h1 className="text-[18px] font-black sm:text-[22px] tracking-tight">My Reviews</h1>

      <section>
        <h2 className="mb-2 text-[13px] font-bold">Awaiting your review ({pendingItems.length})</h2>
        {pendingItems.length === 0 ? (
          <Empty title="All caught up" sub="Reviews help other buyers pick trusted sellers." />
        ) : (
          <div className="space-y-3">
            {pendingItems.map((it) => (
              <ReviewCard key={it.id} it={it} onDone={() => router.refresh()} />
            ))}
          </div>
        )}
      </section>

      {done.length > 0 && (
        <section>
          <h2 className="mb-2 text-[13px] font-bold">Published ({done.length})</h2>
          <div className="space-y-2">
            {done.map((it) => (
              <div key={it.id} className="flex gap-3 rounded-2xl panel p-4">
                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg soft">
                  <Image src={it.image} alt="" fill sizes="48px" className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-1 text-[12.5px] font-bold">{it.title}</div>
                  <Stars value={it.review_stars ?? 5} />
                  <div className="mt-1 text-[12px] muted">{it.review_body}</div>
                  <Link href={`/dashboard/orders/${it.code}`} className="text-[10.5px] text-brand-400 hover:underline">
                    {it.code} · {when(it.ordered_at)}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <div className="mt-0.5 flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} size={12} className={s <= value ? "fill-amber-400 text-amber-400" : "muted"} />
      ))}
    </div>
  );
}

function ReviewCard({ it, onDone }: { it: It; onDone: () => void }) {
  const [stars, setStars] = useState(5);
  const [body, setBody] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="rounded-2xl panel p-4">
      <div className="flex gap-3">
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg soft">
          <Image src={it.image} alt="" fill sizes="48px" className="object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="line-clamp-1 text-[12.5px] font-bold">{it.title}</div>
          <div className="text-[11px] muted">
            {it.store_name} · {it.code}
          </div>
        </div>
      </div>

      <div className="mt-3 flex gap-1">
        {[1, 2, 3, 4, 5].map((s) => (
          <button key={s} onClick={() => setStars(s)} aria-label={`${s} stars`}>
            <Star
              size={19}
              className={`transition-transform hover:scale-110 ${
                s <= stars ? "fill-amber-400 text-amber-400" : "muted"
              }`}
            />
          </button>
        ))}
      </div>

      <textarea
        rows={2}
        className={`${inputCls} mt-2`}
        placeholder="How was the delivery and the seller?"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      {err && <div className="mt-2 text-[11.5px] text-rose-400">{err}</div>}
      <Btn
        className="mt-2 flex items-center gap-2"
        disabled={pending || body.trim().length < 4}
        onClick={() =>
          start(async () => {
            const r = await submitReviewAction({ orderCode: it.code, sellerId: it.seller_id, stars, body });
            if (!r.ok) return setErr(r.error || "Could not submit review.");
            onDone();
          })
        }
      >
        {pending && <Loader2 size={13} className="animate-spin" />} Submit review
      </Btn>
    </div>
  );
}
