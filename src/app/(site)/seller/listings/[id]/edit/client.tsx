"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Field, inputCls, Btn } from "@/components/ui";
import { saveListingAction } from "@/lib/actions/seller";
import { label } from "@/lib/fmt";

type L = {
  id: string; game_slug: string; category_slug: string;
  title: string; description: string | null; image: string; price: number; stock: number;
  delivery_time: string | null; status: string; tier?: string | null; level?: number | null; outfits?: number | null;
};

export default function EditListingClient({ listing, games, categories }: { listing: L; games: { slug: string; name: string }[]; categories: { slug: string; name: string }[] }) {
  const router = useRouter();
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="rounded-2xl panel p-4 sm:p-5 space-y-4">
      <form
        onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget as HTMLFormElement);
          start(async () => {
            setErr("");
            const r = await saveListingAction(fd);
            if (!r.ok) return setErr(r.error || "Could not save.");
            router.push("/seller/offers?cat=" + listing.category_slug);
            router.refresh();
          })
        }}
        className="space-y-4"
      >
        <input type="hidden" name="id" value={listing.id} />
        <input type="hidden" name="image" value={listing.image} />

        <Field label="Offer Title">
          <input name="title" defaultValue={listing.title} className={inputCls} required />
          <div className="mt-1 text-[11px] muted">Give your item a descriptive title. Most searchable words first.</div>
        </Field>

        <Field label="Description (Optional)">
          <textarea name="description" rows={4} defaultValue={listing.description ?? ""} className={inputCls} placeholder="Type here..." />
        </Field>

        <div className="rounded-2xl soft p-4 space-y-3">
          <div className="text-[13px] font-bold">Delivery</div>
          <Field label="Guaranteed Delivery Time">
            <input name="deliveryTime" defaultValue={listing.delivery_time ?? "5 - 30 min"} className={inputCls} required />
            <div className="mt-1 text-[11px] muted">Faster delivery improves ranking.</div>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Game">
              <select name="game" defaultValue={listing.game_slug} className={inputCls}>
                {games.map((g) => (
                  <option key={g.slug} value={g.slug}>{g.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Category">
              <select name="category" defaultValue={listing.category_slug} className={inputCls}>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>{c.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select name="status" defaultValue={listing.status} className={inputCls}>
                {["active", "paused", "draft"].map((s) => (
                  <option key={s} value={s}>{label(s)}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        <div className="rounded-2xl soft p-4 space-y-3">
          <div className="text-[13px] font-bold">Quantity</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Total Quantity available">
              <input name="stock" type="number" defaultValue={listing.stock} className={inputCls} />
            </Field>
          </div>
        </div>

        <div className="rounded-2xl soft p-4 space-y-3">
          <div className="text-[13px] font-bold">Price</div>
          <Field label="Price per unit">
            <input name="price" type="number" step="0.01" defaultValue={listing.price} className={inputCls} required />
          </Field>
        </div>

        {err && <div className="rounded-lg bg-rose-500/10 px-3 py-2 text-[11.5px] text-rose-400">{err}</div>}

        <div className="flex gap-2">
          <Link href="/seller/offers" className="rounded-xl soft px-5 py-2.5 text-[12.5px] font-semibold">Back</Link>
          <Btn className="flex items-center gap-2" disabled={pending}>
            {pending && <Loader2 size={13} className="animate-spin" />} Save changes
          </Btn>
        </div>
      </form>
    </div>
  );
}
