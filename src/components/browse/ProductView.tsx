"use client";
import { useMoney, useT } from "@/components/LocaleProvider";
import { useMemo, useState, useTransition, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  ShieldCheck,
  Clock,
  Globe,
  Monitor,
  KeyRound,
  ChevronDown,
  Heart,
  Star,
  ShoppingCart,
  Loader2,
  AlertCircle,
  BadgeCheck,
} from "lucide-react";
import { BrandIcon } from "@/components/BrandIcon";
import { Breadcrumb, Pill, Btn, Tag } from "@/components/ui";
import ProductCard, { CardProduct } from "./ProductCard";
import { useWishlist } from "./WishlistSync";

import { addToCartAction, toggleWishAction } from "@/lib/actions/shop";
import type { DbGame, DbCategory, DbProduct, DbOffer } from "@/lib/queries";
import { img } from "@/lib/img";

const sorts = ["Recommended", "Cheapest First", "Fastest Delivery", "Highest Rated"] as const;
const SORT_KEY: Record<string, string> = {
  "Recommended": "sort.recommended",
  "Cheapest First": "sort.cheapest",
  "Fastest Delivery": "sort.fastest",
  "Highest Rated": "sort.rated",
};
const mins = (s: string) => parseInt(s.replace(/\D/g, "")) || 999;


/**
 * First photo the seller uploaded with an offer, if any.
 *
 * `offers.images` is a JSON array of data URIs written by the sell wizard. The
 * buyer-facing offer rows never read it, so a seller could upload photos of the
 * exact account they were selling and the buyer would never see them. Falls
 * back to null so the store-initial avatar is used as before.
 */
function offerPhoto(o: { images?: string | null }): string | null {
  if (!o.images) return null;
  try {
    const arr = JSON.parse(o.images);
    const first = Array.isArray(arr) ? arr[0] : null;
    return typeof first === "string" && first.startsWith("data:image/") ? first : null;
  } catch {
    return null;
  }
}

export default function ProductView({
  game,
  category,
  product,
  offers,
  related,
  wished = false,
}: {
  game: DbGame;
  category: DbCategory;
  product: DbProduct;
  offers: DbOffer[];
  related: CardProduct[];
  wished?: boolean;
}) {
  const money = useMoney();
  const tr = useT();
  const { ids, ready } = useWishlist();
  const splitOpts = (v?: string | null) =>
    String(v ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const regions = useMemo(() => splitOpts(product.region), [product.region]);
  const methods = useMemo(() => splitOpts(product.delivery_method), [product.delivery_method]);
  const [region, setRegion] = useState(regions[0] ?? "");
  const [method, setMethod] = useState(methods[0] ?? "");

  const [sort, setSort] = useState<(typeof sorts)[number]>("Recommended");
  const [show, setShow] = useState(5);
  const [howOpen, setHowOpen] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [heart, setHeart] = useState(wished);
  useEffect(() => {
    if (ready) setHeart(ids.has(product.id));
  }, [ready, ids, product.id]);
  const [, start] = useTransition();
  const router = useRouter();
  const href = `/g/${game.slug}/${category.slug}/${product.slug}`;

  const sorted = useMemo(() => {
    const l = [...offers];
    if (sort === "Cheapest First") l.sort((a, b) => a.price - b.price);
    if (sort === "Highest Rated") l.sort((a, b) => b.rating - a.rating);
    if (sort === "Fastest Delivery") l.sort((a, b) => mins(a.delivery_time) - mins(b.delivery_time));
    if (sort === "Recommended")
      l.sort((a, b) => b.verified - a.verified || b.rating - a.rating || a.price - b.price);
    return l;
  }, [offers, sort]);

  const buy = (o: DbOffer, go: boolean) => {
    // Do NOT pre-judge auth from client state here. `signedIn` arrives from an
    // async fetch, so an early click used to look like a guest and bounced a
    // logged-in buyer to /login (which then forwards to /dashboard) instead of
    // checkout. The server action is the authority: it returns "AUTH" when the
    // visitor really is signed out, and we redirect only then.
    setErr("");
    setBusy(o.id);
    start(async () => {
      const r = await addToCartAction({
        offerId: o.id,
        qty: 1,
        region: region || undefined,
        deliveryMethod: method || undefined,
      });
      setBusy(null);
      if (!r.ok) {
        if (r.error === "AUTH") router.push("/login?next=" + encodeURIComponent(href));
        else setErr(r.error || "Could not add to cart.");
        return;
      }
      if (go) router.push("/checkout");
      else {
        setAdded(o.id);
        router.refresh();
        setTimeout(() => setAdded(null), 1500);
      }
    });
  };

  const cheapest = offers.length ? Math.min(...offers.map((o) => o.price)) : product.base_price;

  /**
   * "Best price" and "Buyer protection" live in the right sidebar on desktop,
   * but on mobile the client wants them inline, directly under the product
   * details and ABOVE the offers list. Defining them once here and placing the
   * same variable in both spots keeps the two layouts in sync.
   */
  /**
   * The offer the two buttons below will actually buy. Showing the price
   * without naming the seller meant a buyer could hit "Buy Cheapest Offer"
   * with no idea who they were buying from, so the seller, their rating and
   * their review count are surfaced right next to the action.
   */
  const cheapestOffer = offers.length > 0 ? [...offers].sort((a, b) => a.price - b.price)[0] : null;

  const bestPriceCard = offers.length > 0 && cheapestOffer && (
    <div className="rounded-2xl panel p-4 sm:p-5">
      <div className="text-[11.5px] muted">{tr("prod.bestPrice")}</div>
      <div className="mt-1 text-[18px] font-black text-brand-500 sm:text-[28px]">{money(cheapest)}</div>

      {/* Who you are buying from — kept above the buttons on every screen size. */}
      <div className="mt-3 flex items-center gap-2.5 rounded-xl soft p-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 to-brand-700 text-[11px] font-bold text-white">
          {cheapestOffer.store_name.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="truncate text-[12.5px] font-bold">{cheapestOffer.store_name}</span>
            {cheapestOffer.verified ? (
              <BadgeCheck size={13} className="shrink-0 text-brand-400" />
            ) : null}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10.5px] muted">
            <span className="flex items-center gap-0.5 text-amber-400">
              <Star size={10} className="fill-amber-400" />
              {cheapestOffer.rating}%
            </span>
            <span aria-hidden>·</span>
            <span>
              {Number(cheapestOffer.total_orders ?? 0).toLocaleString("en-US")} reviews
            </span>
          </div>
        </div>
      </div>

      <Btn
        className="mt-3 w-full"
        onClick={() => buy([...offers].sort((a, b) => a.price - b.price)[0], true)}
      >
        {tr("prod.buyCheapest")}
      </Btn>
      <Btn
        variant="ghost"
        className="mt-2 w-full"
        onClick={() => buy([...offers].sort((a, b) => a.price - b.price)[0], false)}
      >
        {tr("common.addToCart")}
      </Btn>
      <Link
        href="/support"
        className="mt-3 block text-center text-[11.5px] muted transition-colors hover:text-brand-500"
      >
        {tr("prod.needHelp")}
      </Link>
    </div>
  );

  const protectionCard = (
    <div className="rounded-2xl panel p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2 text-[13px] font-bold">
        <ShieldCheck size={15} className="text-emerald-400" /> {tr("prod.buyerProtection")}
      </div>
      {["100% Secure Transactions", "Money-back Guarantee", "24/7 Live Support", "Escrow protected payment"].map((t) => (
        <div key={t} className="flex items-center gap-2 py-1 text-[12px]">
          <Check size={13} className="text-emerald-400" /> {t}
        </div>
      ))}
    </div>
  );

  const detailsCard = (
    <div className="rounded-2xl panel p-4 sm:p-5">
      <div className="mb-2 text-[13px] font-bold">{tr("prod.productDetails")}</div>
      <p className="text-[11.5px] leading-relaxed muted">
        You will receive {product.name} directly in your {game.name} account. Safe, secure and
        handled by verified G2X sellers. Open a dispute within 24 hours if anything is wrong.
      </p>
    </div>
  );

  return (
    <main className="mx-auto w-full max-w-[1220px] overflow-x-hidden px-3 py-4 sm:px-4 sm:py-6">
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: category.name, href: `/c/${category.slug}` },
          { label: game.name, href: `/g/${game.slug}/${category.slug}` },
          { label: product.name },
        ]}
      />

      <div className="mt-4 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-5">
          <div className="rounded-2xl panel p-4 sm:p-5">
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:gap-5">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative h-[130px] w-full shrink-0 overflow-hidden rounded-xl soft sm:h-[170px] sm:w-[190px]"
              >
                <Image src={img(product.image)} alt={product.name} fill sizes="200px" className="object-contain p-4" />
              </motion.div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-3">
                  <h1 className="min-w-0 flex-1 text-[19px] font-black leading-tight tracking-tight sm:text-[26px]">{product.name}</h1>
                  <button
                    onClick={() => {
                      const n = !heart;
                      setHeart(n);
                      start(async () => {
                        const r = await toggleWishAction({
                          id: product.id, title: product.name, sub: game.name,
                          image: product.image, price: cheapest, href,
                        });
                        if (!r.ok) {
                          setHeart(!n);
                          if (r.error === "AUTH") router.push("/login?next=" + encodeURIComponent(href));
                        }
                      });
                    }}
                    className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--line)] transition-all hover:scale-110 hover:border-rose-400"
                  >
                    <Heart size={15} className={heart ? "fill-rose-500 text-rose-500" : "muted"} />
                  </button>
                </div>

                <div className="mt-2.5 flex flex-wrap gap-2">
                  <Tag>{game.name}</Tag>
                  <Tag tone="slate">{category.name}</Tag>
                  <Tag tone={offers.length ? "green" : "red"}>
                    {offers.length ? `${offers.length} ${tr("prod.inStockSellers")}` : tr("common.outOfStock")}
                  </Tag>
                </div>

                <div className="mt-3.5 grid gap-2 text-[12px] sm:mt-4 sm:grid-cols-2 sm:text-[12.5px]">
                  <Info icon={Clock} label={tr("prod.deliveryTime")} value={product.delivery_time} />
                  <Info icon={Monitor} label={tr("prod.platform")} value={product.platform} />
                </div>

                {/* Buyer picks the server + how they want it delivered. Both
                    lists are configured per-product by the admin. */}
                {regions.length > 0 && (
                  <ChipRow
                    icon={<Globe size={13} className="text-brand-500" />}
                    label={tr("prod.gameServer")}
                    options={regions}
                    value={region}
                    onChange={setRegion}
                  />
                )}
                {methods.length > 0 && (
                  <ChipRow
                    icon={<KeyRound size={13} className="text-brand-500" />}
                    label={tr("prod.deliveryMethod")}
                    options={methods}
                    value={method}
                    onChange={setMethod}
                  />
                )}

                <button
                  onClick={() => setHowOpen((o) => !o)}
                  className="mt-4 flex items-center gap-1.5 text-[12px] font-medium text-brand-500"
                >
                  {tr("prod.howWork")}
                  <ChevronDown size={13} className={`transition-transform ${howOpen ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence>
                  {howOpen && (
                    <motion.ol
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-2 space-y-1.5 overflow-hidden text-[11.5px] muted"
                    >
                      {[
                        "Pick the seller offering the best price & delivery time.",
                        "Pay securely — your money is held in escrow.",
                        `Provide your ${product.delivery_method} at checkout.`,
                        "Seller delivers, you confirm, funds are released.",
                      ].map((s, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-brand-600/20 text-[9px] font-bold text-brand-400">
                            {i + 1}
                          </span>
                          {s}
                        </li>
                      ))}
                    </motion.ol>
                  )}
                </AnimatePresence>

                <div className="mt-4 flex items-center gap-2.5 text-[11.5px] muted">
                  Share:
                  {["telegram", "discord", "x", "instagram", "youtube"].map((s) => (
                    <button
                      key={s}
                      className="grid h-7 w-7 place-items-center rounded-full border border-[var(--line)] transition-all hover:-translate-y-0.5 hover:border-brand-500"
                    >
                      <BrandIcon name={s} size={12} color="currentColor" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Mobile order: details -> best price -> protection -> offers.
              On lg+ these same cards render in the sticky sidebar instead. */}
          <div className="space-y-5 lg:hidden">
            {bestPriceCard}
            {protectionCard}
          </div>

          <div className="rounded-2xl panel p-4 sm:p-5">
            <div className="mb-3.5 sm:mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-[14px] font-bold">{tr("prod.bestOffers")} ({offers.length})</h2>
                <span className="ml-auto hidden text-[11.5px] muted sm:block">{tr("prod.sortBy")}:</span>
              </div>
              <div className="no-scrollbar -mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:mt-2 sm:flex-wrap sm:justify-end sm:px-0">
                {sorts.map((s) => (
                  <Pill key={s} active={sort === s} onClick={() => setSort(s)}>
                    <span className="whitespace-nowrap">{tr(SORT_KEY[s] ?? "", s)}</span>
                  </Pill>
                ))}
              </div>
            </div>

            {err && (
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11.5px] text-rose-400">
                <AlertCircle size={13} /> {err}
              </div>
            )}

            {offers.length === 0 ? (
              <div className="py-10 text-center text-[12.5px] muted">
                No seller is currently offering this product. Check back soon.
              </div>
            ) : (
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-[12.5px] md:min-w-[640px]">
                  <thead>
                    <tr className="border-b border-[var(--line)] text-left text-[11px] muted">
                      <th className="pb-2.5 font-medium">{tr("prod.seller")}</th>
                      <th className="pb-2.5 font-medium">{tr("common.price")}</th>
                      <th className="pb-2.5 font-medium">{tr("prod.stock")}</th>
                      <th className="pb-2.5 font-medium">{tr("prod.deliveryTime")}</th>
                      <th className="pb-2.5 font-medium">{tr("prod.rating")}</th>
                      <th className="pb-2.5 text-right font-medium">{tr("prod.action")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence initial={false}>
                      {sorted.slice(0, show).map((o, i) => (
                        <motion.tr
                          key={o.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className="group border-b border-[var(--line)] last:border-0 transition-colors hover:bg-brand-600/[.06]"
                        >
                          <td className="py-3">
                            <div className="flex items-center gap-2.5">
                              {offerPhoto(o) ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={offerPhoto(o) as string}
                                  alt=""
                                  className="h-7 w-7 shrink-0 rounded-md object-cover"
                                />
                              ) : (
                                <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 to-brand-700 text-[9.5px] font-bold text-white">
                                  {o.store_name.slice(0, 2).toUpperCase()}
                                </span>
                              )}
                              <div>
                                <div className="flex items-center gap-1 font-semibold">
                                  {o.store_name}
                                  {o.verified === 1 && <BadgeCheck size={12} className="text-brand-400" />}
                                </div>
                                <div className="text-[9.5px] text-brand-400">{o.level}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3">
                            <div className="font-bold">{money(o.price)}</div>
                            {o.old_price && (
                              <div className="text-[10px] line-through muted">{money(o.old_price)}</div>
                            )}
                          </td>
                          <td className="py-3 muted">{o.stock}</td>
                          <td className="py-3 muted">{o.delivery_time}</td>
                          <td className="py-3">
                            <span className="flex items-center gap-1">
                              <Star size={11} className="fill-amber-400 text-amber-400" />
                              {o.rating}%
                              <span className="muted">({o.total_orders})</span>
                            </span>
                          </td>
                          <td className="py-3">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => buy(o, false)}
                                disabled={busy === o.id}
                                className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--line)] transition-all hover:border-brand-500 hover:text-brand-500 disabled:opacity-50"
                                title="Add to cart"
                              >
                                {busy === o.id ? (
                                  <Loader2 size={13} className="animate-spin" />
                                ) : added === o.id ? (
                                  <Check size={14} className="text-emerald-400" />
                                ) : (
                                  <ShoppingCart size={14} />
                                )}
                              </button>
                              <button
                                onClick={() => buy(o, true)}
                                disabled={busy === o.id}
                                className="rounded-lg bg-brand-600 px-3.5 py-1.5 text-[12px] font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-brand-500 disabled:opacity-50"
                              >
                                {tr("common.buyNow")}
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            )}

            {/* mobile: the same offers as tap-friendly cards */}
            {offers.length > 0 && (
              <div className="space-y-2.5 md:hidden">
                <AnimatePresence initial={false}>
                  {sorted.slice(0, show).map((o, i) => (
                    <motion.div
                      key={o.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="min-w-0 overflow-hidden rounded-xl border border-[var(--line)] soft p-3"
                    >
                      <div className="flex items-center gap-2.5">
                        {offerPhoto(o) ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={offerPhoto(o) as string}
                            alt=""
                            className="h-8 w-8 shrink-0 rounded-md object-cover"
                          />
                        ) : (
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 to-brand-700 text-[10px] font-bold text-white">
                            {o.store_name.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1 text-[12.5px] font-semibold">
                            <span className="truncate">{o.store_name}</span>
                            {o.verified === 1 && <BadgeCheck size={12} className="shrink-0 text-brand-400" />}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] muted">
                            <Star size={9} className="fill-amber-400 text-amber-400" />
                            {o.rating}% ({o.total_orders})
                            <span className="text-brand-400">{o.level}</span>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="whitespace-nowrap text-[15px] font-black">{money(o.price)}</div>
                          {o.old_price && (
                            <div className="text-[10px] line-through muted">{money(o.old_price)}</div>
                          )}
                        </div>
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] muted">
                        <span className="flex items-center gap-1"><Clock size={10} /> {o.delivery_time}</span>
                        <span>{o.stock} in stock</span>
                      </div>

                      <div className="mt-2.5 flex gap-2">
                        <button
                          onClick={() => buy(o, false)}
                          disabled={busy === o.id}
                          className="grid h-9 w-10 shrink-0 place-items-center rounded-lg border border-[var(--line)] transition active:scale-95 disabled:opacity-50"
                          aria-label="Add to cart"
                        >
                          {busy === o.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : added === o.id ? (
                            <Check size={15} className="text-emerald-400" />
                          ) : (
                            <ShoppingCart size={15} />
                          )}
                        </button>
                        <button
                          onClick={() => buy(o, true)}
                          disabled={busy === o.id}
                          className="h-9 flex-1 rounded-lg bg-brand-600 text-[12.5px] font-semibold text-white transition active:scale-[.98] disabled:opacity-50"
                        >
                          {tr("common.buyNow")}
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {show < sorted.length && (
              <div className="mt-4 text-center">
                <Btn variant="primary" onClick={() => setShow(sorted.length)}>
                  {tr("prod.viewMore")} ({sorted.length - show})
                </Btn>
              </div>
            )}
          </div>

          {related.length > 0 && (
            <div className="rounded-2xl panel p-4 sm:p-5">
              <h3 className="mb-4 text-[14px] font-bold">{tr("prod.related")} {tr(`cat.${category.slug}`, category.name)}</h3>
              <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                {related.map((p, i) => (
                  <ProductCard key={p.id} p={p} i={i} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Desktop sidebar. Hidden below lg because the same cards are
            rendered inline in the left column on mobile (see above). */}
        <div className="hidden min-w-0 space-y-4 lg:sticky lg:top-[130px] lg:block lg:self-start">
          {protectionCard}
          {bestPriceCard}
          {detailsCard}
        </div>

        {/* Product details always sits last on mobile. */}
        <div className="lg:hidden">{detailsCard}</div>

      </div>
    </main>
  );
}

function Info({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={14} className="shrink-0 text-brand-500" />
      <span className="muted">{label}:</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}


/** Selectable option row (game server / delivery method), as on the mockup. */
function ChipRow({
  icon, label, options, value, onChange,
}: {
  icon: React.ReactNode;
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold">
        {icon} {label}
      </div>
      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {options.map((o) => {
          const on = o === value;
          return (
            <button
              key={o}
              onClick={() => onChange(o)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-semibold transition-all active:scale-95 sm:px-3 sm:py-2 sm:text-[12px] ${
                on
                  ? "border-amber-400 bg-amber-400/10 text-amber-300"
                  : "border-[var(--line)] soft muted hover:border-brand-500/60 hover:text-brand-300"
              }`}
            >
              {on && <Check size={12} />}
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}
