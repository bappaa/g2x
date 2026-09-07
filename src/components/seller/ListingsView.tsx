"use client";
import Image from "next/image";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pause, Play, Trash2, Pencil, X, Loader2 } from "lucide-react";
import { Btn, Empty, Field, Tag, inputCls } from "@/components/ui";
import { money, statusTone, label } from "@/lib/fmt";
import { saveListingAction, listingStatusAction, deleteListingAction } from "@/lib/actions/seller";
import { img } from "@/lib/img";

type L = {
  id: string; game_slug: string; category_slug: string; game_name: string; category_name: string;
  title: string; description: string | null; image: string; price: number; stock: number;
  tier: string | null; level: number | null; outfits: number | null; delivery_time: string | null;
  status: string;
};
type Opt = { slug: string; name: string };

const ART = [
  "/art/bgmi.png", "/art/vp.png", "/art/uc.png", "/art/freefire.png",
  "/art/genshin.png", "/art/pokemongo.png", "/art/item-pass.png", "/art/coins.png",
];

export default function ListingsView({
  listings, games, categories,
}: {
  listings: L[]; games: Opt[]; categories: Opt[];
}) {
  const router = useRouter();
  const [edit, setEdit] = useState<L | null>(null);
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();

  const act = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-[18px] font-black sm:text-[22px] tracking-tight">Listings</h1>
          <p className="text-[11.5px] muted">Your own account & boosting listings (not tied to a catalog product).</p>
        </div>
        <Btn className="ml-auto flex items-center gap-1.5" onClick={() => { setEdit(null); setOpen(true); }}>
          <Plus size={14} /> New listing
        </Btn>
      </div>

      {listings.length === 0 ? (
        <Empty
          title="No listings yet"
          sub="Sell a game account or a boosting service with your own title, art and price."
          action={<Btn onClick={() => setOpen(true)}>Create listing</Btn>}
        />
      ) : (
        <div className="space-y-2.5">
          {listings.map((l) => (
            <motion.div key={l.id} layout className="flex flex-wrap items-center gap-3 rounded-2xl panel p-4">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg soft">
                <Image src={img(l.image)} alt="" fill sizes="48px" className="object-cover" />
              </div>
              <div className="min-w-[170px] flex-1">
                <div className="line-clamp-1 text-[13px] font-bold">{l.title}</div>
                <div className="text-[11px] muted">
                  {l.game_name} · {l.category_name} · {l.stock} in stock
                </div>
              </div>
              <div className="text-[15px] font-black text-brand-500">{money(l.price)}</div>
              <Tag tone={statusTone(l.status)}>{label(l.status)}</Tag>
              <div className="flex gap-1">
                <button
                  onClick={() => act(() => listingStatusAction(l.id, l.status === "active" ? "paused" : "active"))}
                  className="grid h-8 w-8 place-items-center rounded-lg soft hover:bg-brand-500/15 hover:text-brand-400"
                >
                  {l.status === "active" ? <Pause size={13} /> : <Play size={13} />}
                </button>
                <button
                  onClick={() => { setEdit(l); setOpen(true); }}
                  className="grid h-8 w-8 place-items-center rounded-lg soft hover:bg-brand-500/15 hover:text-brand-400"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => act(() => deleteListingAction(l.id))}
                  className="grid h-8 w-8 place-items-center rounded-lg soft hover:bg-rose-500/15 hover:text-rose-400"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {open && (
          <Modal
            listing={edit}
            games={games}
            categories={categories}
            onClose={() => { setOpen(false); setEdit(null); }}
            onSaved={() => { setOpen(false); setEdit(null); router.refresh(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Modal({
  listing, games, categories, onClose, onSaved,
}: {
  listing: L | null; games: Opt[]; categories: Opt[]; onClose: () => void; onSaved: () => void;
}) {
  const [err, setErr] = useState("");
  const [image, setImage] = useState(listing?.image ?? ART[0]);
  const [pending, start] = useTransition();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-full max-w-[660px] overflow-y-auto rounded-2xl panel p-4 sm:p-5"
      >
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-[16px] font-black">{listing ? "Edit listing" : "New listing"}</h2>
          <button onClick={onClose} className="ml-auto rounded-lg p-1.5 soft hover:text-rose-400">
            <X size={15} />
          </button>
        </div>

        <form
          action={(fd) =>
            start(async () => {
              setErr("");
              const r = await saveListingAction(fd);
              if (!r.ok) return setErr(r.error || "Could not save listing.");
              onSaved();
            })
          }
          className="space-y-3"
        >
          <input type="hidden" name="id" value={listing?.id ?? ""} />
          <input type="hidden" name="image" value={image} />

          <Field label="Title">
            <input name="title" defaultValue={listing?.title ?? ""} className={inputCls} placeholder="Conqueror BGMI Account · 200+ Outfits" required />
          </Field>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Game">
              <select name="game" defaultValue={listing?.game_slug ?? games[0]?.slug} className={inputCls}>
                {games.map((g) => (
                  <option key={g.slug} value={g.slug}>{g.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Category">
              <select name="category" defaultValue={listing?.category_slug ?? categories[0]?.slug} className={inputCls}>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>{c.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select name="status" defaultValue={listing?.status ?? "active"} className={inputCls}>
                {["active", "paused", "draft"].map((s) => (
                  <option key={s} value={s}>{label(s)}</option>
                ))}
              </select>
            </Field>
            <Field label="Price (USD)">
              <input name="price" type="number" step="0.01" defaultValue={listing?.price} className={inputCls} required />
            </Field>
            <Field label="Stock">
              <input name="stock" type="number" defaultValue={listing?.stock ?? 1} className={inputCls} />
            </Field>
            <Field label="Delivery time">
              <input name="deliveryTime" defaultValue={listing?.delivery_time ?? "5 - 30 min"} className={inputCls} />
            </Field>
            <Field label="Tier / rank">
              <input name="tier" defaultValue={listing?.tier ?? ""} className={inputCls} placeholder="Conqueror" />
            </Field>
            <Field label="Account level">
              <input name="level" type="number" defaultValue={listing?.level ?? ""} className={inputCls} />
            </Field>
            <Field label="Outfits / skins">
              <input name="outfits" type="number" defaultValue={listing?.outfits ?? ""} className={inputCls} />
            </Field>
          </div>

          <Field label="Description">
            <textarea name="description" rows={3} defaultValue={listing?.description ?? ""} className={inputCls} />
          </Field>

          <div>
            <div className="mb-1.5 text-[11.5px] font-medium muted">Cover art</div>
            <div className="flex flex-wrap gap-2">
              {ART.map((a) => (
                <button
                  type="button"
                  key={a}
                  onClick={() => setImage(a)}
                  className={`relative h-12 w-16 overflow-hidden rounded-lg border-2 transition ${
                    image === a ? "border-brand-500" : "border-transparent opacity-70 hover:opacity-100"
                  }`}
                >
                  <Image src={img(a)} alt="" fill sizes="64px" className="object-cover" />
                </button>
              ))}
            </div>
          </div>

          {err && <div className="rounded-lg bg-rose-500/10 px-3 py-2 text-[11.5px] text-rose-400">{err}</div>}

          <div className="flex gap-2">
            <Btn className="flex items-center gap-2" disabled={pending}>
              {pending && <Loader2 size={13} className="animate-spin" />} Save listing
            </Btn>
            <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
