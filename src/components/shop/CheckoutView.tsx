/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useMoney, useT } from "@/components/LocaleProvider";
import Image from "next/image";
import { useState, useTransition, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ShieldCheck, Loader2, AlertCircle, Check, Lock, Gamepad2 } from "lucide-react";
import { Btn, Field, inputCls } from "@/components/ui";
import { AnyLogo } from "@/components/BrandIcon";

import { placeOrderAction } from "@/lib/actions/shop";
import type { CartRow } from "./CartView";
import { feeFor, limitError, type GatewayView } from "@/lib/gateway-fees";
import { img } from "@/lib/img";

declare global {
  interface Window {
    Razorpay?: unknown;
  }
}

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

type GameGroup = {
  game_slug: string;
  game_name: string;
  category_slug: string;
  items: CartRow[];
  needsDetails: boolean;
};

const NO_DETAILS_CATS = ["accounts", "gift-cards", "giftcards", "subscriptions", "subscription"];
const NEEDS_DETAILS_CATS = ["currency", "top-up", "topup", "items", "boosting"];

export default function CheckoutView({
  items,
  email,
  balance,
  gateways,
}: {
  items: CartRow[];
  email: string;
  balance: number;
  gateways: GatewayView[];
}) {
  const money = useMoney();
  const tr = useT();
  const router = useRouter();
  const [method, setMethod] = useState(gateways[0]?.code ?? "card");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [kycBlocked, setKycBlocked] = useState(false);
  const [pending, start] = useTransition();
  const [rzpLoading, setRzpLoading] = useState(false);

  const gw = gateways.find((g) => g.code === method) ?? null;
  const isRazorpay = method.toLowerCase().includes("razorpay") || method === "razorpay";

  // --- Category & game grouping logic ---
  const distinctCats = useMemo(() => {
    return Array.from(new Set(items.map((i) => (i.category_slug || "").toLowerCase()).filter(Boolean)));
  }, [items]);

  const isMixedCategory = distinctCats.length > 1;

  const gameGroups: GameGroup[] = useMemo(() => {
    const map = new Map<string, GameGroup>();
    for (const it of items) {
      const gSlug = ((it as unknown as { game_slug?: string }).game_slug) || it.sub?.split("·")[0]?.trim() || "unknown";
      const gName = ((it as unknown as { game_name?: string }).game_name) || gSlug;
      const cSlug = (it.category_slug || "").toLowerCase();
      const key = gSlug;
      if (!map.has(key)) {
        const noNeed = NO_DETAILS_CATS.includes(cSlug);
        // If category is in NO_DETAILS list, no details. Otherwise needs details if in NEEDS list or unknown
        const needsDetails = !noNeed;
        map.set(key, {
          game_slug: gSlug,
          game_name: gName,
          category_slug: cSlug,
          items: [],
          needsDetails,
        });
      }
      map.get(key)!.items.push(it);
      // If any item in group needs details, mark group as needsDetails
      if (NEEDS_DETAILS_CATS.includes(cSlug)) {
        map.get(key)!.needsDetails = true;
      }
      if (NO_DETAILS_CATS.includes(cSlug) && map.get(key)!.category_slug && !NEEDS_DETAILS_CATS.includes(map.get(key)!.category_slug)) {
        // keep as is, but if mixed within same game (shouldn't happen), needsDetails wins
      }
    }
    return Array.from(map.values());
  }, [items]);

  const isAccountOnly = distinctCats.length > 0 && distinctCats.every((c) => NO_DETAILS_CATS.includes(c));

  // Per-game delivery details state
  const [deliveryDetails, setDeliveryDetails] = useState<Record<string, string>>({});

  useEffect(() => {
    const init: Record<string, string> = {};
    for (const g of gameGroups) {
      if (g.needsDetails) init[g.game_slug] = deliveryDetails[g.game_slug] || "";
    }
    const keys = Object.keys(init).sort().join(",");
    const curKeys = Object.keys(deliveryDetails).sort().join(",");
    if (keys !== curKeys) {
      setDeliveryDetails(init);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameGroups]);

  const chosen = items.map((i) => i.opt_delivery).filter(Boolean) as string[];
  const deliveryKind = chosen.length ? chosen[0] : "";
  const k = deliveryKind.toLowerCase();
  const baseField = k.includes("uid")
    ? { label: "In-game UID", placeholder: "e.g. 51234987", hint: "Your numeric in-game user ID." }
    : k.includes("login")
    ? { label: "Login ID / Email", placeholder: "e.g. player@mail.com", hint: "The account login the seller will use." }
    : k.includes("redeem") || k.includes("code")
    ? { label: "Delivery email", placeholder: "e.g. player@mail.com", hint: "Where we send your redeem code." }
    : k.includes("friend")
    ? { label: "In-game name / Friend ID", placeholder: "e.g. PlayerOne#1234", hint: "So the seller can add you in-game." }
    : { label: "In-game UID / Login ID", placeholder: "e.g. 51234987 or player@mail.com", hint: "Required for delivery" };

  const optSummary = Array.from(
    new Set(
      items
        .map((i) => [i.opt_region, i.opt_delivery].filter(Boolean).join(" · "))
        .filter(Boolean)
    )
  );
  const subtotal = +items.reduce((t, r) => t + r.price * r.qty, 0).toFixed(2);
  const fee = +(subtotal * 0.02).toFixed(2);
  const gwFee = feeFor(subtotal + fee, gw);
  const total = +(subtotal + fee + gwFee).toFixed(2);
  const lowBal = gw?.code === "wallet" && balance < total;
  const limitMsg = limitError(total, gw);

  const missingDetails = gameGroups.filter((g) => g.needsDetails && !(deliveryDetails[g.game_slug]?.trim()));
  const hasMissingDetails = missingDetails.length > 0;

  const blocked = lowBal || !!limitMsg || isMixedCategory || hasMissingDetails;

  const busy = useRef(false);

  useEffect(() => {
    if (isRazorpay) loadRazorpay();
  }, [isRazorpay]);

  const submitRazorpay = async () => {
    if (busy.current) return;
    if (isMixedCategory) {
      setErr("Mixed categories in cart — checkout one category at a time. Remove items from other categories.");
      return;
    }
    if (hasMissingDetails) {
      setErr(`Enter delivery details for: ${missingDetails.map((g) => g.game_name).join(", ")}`);
      return;
    }
    busy.current = true;
    setErr("");
    setKycBlocked(false);
    setRzpLoading(true);
    try {
      const loaded = await loadRazorpay();
      if (!loaded) {
        setErr("Failed to load Razorpay checkout. Disable ad-blocker and ensure CSP allows https://checkout.razorpay.com");
        setRzpLoading(false);
        busy.current = false;
        return;
      }

      const createRes = await fetch("/api/payments/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: "checkout",
          gateway_code: method,
          uid: Object.values(deliveryDetails)[0] || "",
          deliveryDetails,
          note,
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok || !createData.ok) {
        setErr(createData.error || "Could not initiate Razorpay payment.");
        return;
      }

      const options: Record<string, unknown> = {
        key: createData.keyId,
        amount: Math.round(createData.amount * 100),
        currency: createData.currency || "INR",
        name: "G2X.GG",
        description: `Order payment — ${items.length} items`,
        order_id: createData.razorpayOrderId,
        prefill: { email },
        theme: { color: "#8b3dff" },
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            setRzpLoading(true);
            const verifyRes = await fetch("/api/payments/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                uid: Object.values(deliveryDetails)[0] || "",
                deliveryDetails,
                note,
              }),
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok || !verifyData.ok) {
              setErr(verifyData.error || "Payment verification failed. Contact support with payment ID.");
              setRzpLoading(false);
              return;
            }
            if (verifyData.verifyAfter) {
              router.push(`/dashboard/verification?after=${verifyData.code}`);
              return;
            }
            router.push(`/dashboard/orders/${verifyData.code}?new=1`);
          } catch (e: unknown) {
            setErr((e as Error)?.message || "Verification failed");
            setRzpLoading(false);
          }
        },
        modal: {
          ondismiss: () => {
            setRzpLoading(false);
            busy.current = false;
          },
        },
      };

      const rzp = new (window as unknown as { Razorpay: new (opts: unknown) => { open: () => void; on: (ev: string, cb: (r: unknown) => void) => void } }).Razorpay(options);
      rzp.on("payment.failed", (resp: unknown) => {
        setErr((resp as { error?: { description?: string } })?.error?.description || "Payment failed");
        setRzpLoading(false);
        busy.current = false;
      });
      rzp.open();
    } catch (e: unknown) {
      setErr((e as Error)?.message || "Razorpay error");
    } finally {
      setRzpLoading(false);
      busy.current = false;
    }
  };

  const submit = () => {
    if (busy.current) return;
    if (isMixedCategory) {
      setErr("Mixed categories in cart — checkout one category at a time. Remove items from other categories.");
      return;
    }
    if (hasMissingDetails) {
      setErr(`Enter delivery details for: ${missingDetails.map((g) => g.game_name).join(", ")}`);
      return;
    }
    if (isRazorpay) {
      submitRazorpay();
      return;
    }
    busy.current = true;
    setErr("");
    setKycBlocked(false);
    start(async () => {
      try {
        const r = await placeOrderAction({
          paymentMethod: method,
          uid: Object.values(deliveryDetails)[0] || "",
          deliveryDetails,
          note,
        } as any).catch(() => null);
        if (!r || !r.ok) {
          if (r?.error === "VERIFY_EMAIL") {
            router.push("/verify-email?next=%2Fcheckout");
            return;
          }
          setKycBlocked(!!r?.needsKyc);
          setErr(r?.error || "Payment failed. Please try again.");
          return;
        }
        if (r.verifyAfter) {
          router.push(`/dashboard/verification?after=${r.code}`);
          return;
        }
        router.push(`/dashboard/orders/${r.code}?new=1`);
      } finally {
        busy.current = false;
      }
    });
  };

  const isProcessing = pending || rzpLoading;

  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        {/* Mixed category blocker */}
        {isMixedCategory && (
          <section className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-rose-400" />
              <div>
                <h3 className="text-[13px] font-bold text-rose-300">Mixed categories in cart</h3>
                <p className="mt-1 text-[11.5px] leading-relaxed text-rose-200/80">
                  You have items from different categories: <b>{distinctCats.join(", ")}</b>. You cannot buy from two separate categories at the same time.
                  Please checkout one category at a time — remove items from other categories to continue. For same category but different games, you need to provide delivery details for each game below.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {distinctCats.map((c) => (
                    <span key={c} className="rounded-full bg-rose-500/20 px-2.5 py-1 text-[11px] font-semibold capitalize text-rose-300">{c}</span>
                  ))}
                </div>
                <Link href="/cart" className="mt-3 inline-flex rounded-lg bg-rose-500 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-rose-400">
                  Go to cart to remove
                </Link>
              </div>
            </div>
          </section>
        )}

        <section className="rounded-2xl panel p-4 sm:p-5">
          <h3 className="text-[14px] font-bold">1. {tr("co.delivery")} — per game</h3>
          {isAccountOnly ? (
            <p className="mt-1 text-[11.5px] muted">
              Account credentials will be delivered automatically after payment. No game ID needed — the seller fulfills via secure delivery.
            </p>
          ) : (
            <p className="mt-1 text-[11.5px] muted">
              Provide delivery details for each game below. Seller uses this to deliver your order. Double-check — wrong IDs cause delays.
            </p>
          )}
          {optSummary.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {optSummary.map((o) => (
                <span
                  key={o}
                  className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 text-[11px] font-semibold text-amber-300"
                >
                  {o}
                </span>
              ))}
            </div>
          )}

          {/* Per-game delivery inputs */}
          <div className="mt-4 space-y-4">
            {gameGroups.map((group) => (
              <div key={group.game_slug} className="rounded-xl border border-[var(--line)] bg-[var(--panel)]/50 p-3">
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-600/15 text-brand-400">
                    <Gamepad2 size={13} />
                  </span>
                  <div>
                    <div className="text-[12.5px] font-bold">{group.game_name}</div>
                    <div className="text-[10.5px] capitalize muted">{group.category_slug} · {group.items.length} item{group.items.length>1?"s":""}</div>
                  </div>
                  <span className="ml-auto rounded-full bg-[var(--line)] px-2 py-0.5 text-[10px] muted">
                    {group.items.map((i) => i.title).join(", ").slice(0,60)}
                  </span>
                </div>

                {group.needsDetails ? (
                  <div className="mt-3">
                    <Field label={`${baseField.label} for ${group.game_name} *`}>
                      <input
                        className={`${inputCls} ${missingDetails.some((m)=>m.game_slug===group.game_slug) ? "border-rose-500/60 focus:border-rose-500" : ""}`}
                        value={deliveryDetails[group.game_slug] || ""}
                        onChange={(e) => setDeliveryDetails((prev) => ({ ...prev, [group.game_slug]: e.target.value }))}
                        placeholder={baseField.placeholder}
                      />
                      <span className="mt-1 block text-[10.5px] muted">{baseField.hint} — for {group.game_name} ({group.category_slug})</span>
                    </Field>
                  </div>
                ) : (
                  <div className="mt-2 text-[11px] text-emerald-400">No game ID needed — {group.category_slug} delivered automatically after payment.</div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Email (receipt)">
              <input className={inputCls} value={email} readOnly />
            </Field>
            <Field label="Note to seller (optional)">
              <textarea
                rows={2}
                className={inputCls}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={isAccountOnly ? "Any special request…" : "Server / region, preferred delivery window…"}
              />
            </Field>
          </div>
        </section>

        <section className="rounded-2xl panel p-4 sm:p-5">
          <h3 className="text-[14px] font-bold">2. {tr("co.payment")}</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {gateways.map((m) => {
              const on = method === m.code;
              const mFee = feeFor(subtotal + fee, m);
              return (
                <button
                  key={m.code}
                  onClick={() => setMethod(m.code)}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                    on ? "border-brand-500 bg-brand-500/10" : "border-[var(--line)] soft hover:border-brand-500/50"
                  }`}
                >
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/90">
                    {m.logo ? <AnyLogo logo={m.logo} size={17} /> : <Lock size={14} className="text-slate-800" />}
                  </span>
                  <span className="min-w-0 flex-1 text-[12.5px] font-semibold">
                    {m.name}
                    {m.code === "wallet" ? (
                      <span className="block text-[10.5px] font-normal muted">
                        Balance {money(balance)}
                      </span>
                    ) : (
                      <span className="block text-[10.5px] font-normal muted">
                        {mFee > 0 ? `+ ${money(mFee)} fee` : "No extra fee"}
                      </span>
                    )}
                  </span>
                  {on && <Check size={15} className="text-brand-500" />}
                </button>
              );
            })}
          </div>
          {limitMsg && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11.5px] text-amber-400">
              <AlertCircle size={13} /> {limitMsg}
            </div>
          )}
          {lowBal && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11.5px] text-amber-400">
              <AlertCircle size={13} /> Wallet balance is too low for this order. Top up or pick another method.
            </div>
          )}
          {hasMissingDetails && !isMixedCategory && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11.5px] text-rose-400">
              <AlertCircle size={13} /> Enter delivery details for: {missingDetails.map((g) => g.game_name).join(", ")}
            </div>
          )}
          {isRazorpay && (
            <div className="mt-3 rounded-lg border border-brand-500/30 bg-brand-500/10 px-3 py-2 text-[11px] text-brand-300">
              Secure payment via Razorpay — UPI, Cards, NetBanking, Wallets. Your order is created only after successful payment verification.
            </div>
          )}
        </section>

        <section className="rounded-2xl panel p-4 sm:p-5">
          <h3 className="mb-3 text-[14px] font-bold">3. Review items</h3>
          <div className="space-y-3">
            {items.map((r) => (
              <div key={r.key} className="flex items-center gap-3">
                <div className="relative h-11 w-11 overflow-hidden rounded-lg soft">
                  <Image src={img(r.image)} alt={r.title} fill sizes="48px" className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-1 text-[12.5px] font-semibold">{r.title}</div>
                  <div className="text-[11px] muted">
                    {r.store_name} · ×{r.qty} · {r.delivery} · {r.game_name || ""}
                  </div>
                </div>
                <div className="text-[13px] font-bold">{money(r.price * r.qty)}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="space-y-4 lg:sticky lg:top-[130px] lg:self-start">
        <motion.div layout className="rounded-2xl panel p-4 sm:p-5">
          <h3 className="text-[14px] font-bold">{tr("co.summary")}</h3>
          <div className="mt-3 space-y-2 text-[12.5px]">
            <div className="flex justify-between">
              <span className="muted">{tr("cart.subtotal")}</span>
              <span className="font-semibold">{money(subtotal)}</span>
            </div>
            {gwFee > 0 && (
              <div className="flex justify-between">
                <span className="muted">
                  {gw?.name} fee
                  {gw && (gw.feePercent > 0 || gw.feeFixed > 0) && (
                    <span className="ml-1 opacity-70">
                      ({gw.feePercent > 0 ? `${gw.feePercent}%` : ""}
                      {gw.feePercent > 0 && gw.feeFixed > 0 ? " + " : ""}
                      {gw.feeFixed > 0 ? `$${gw.feeFixed.toFixed(2)}` : ""})
                    </span>
                  )}
                </span>
                <span className="font-semibold text-amber-400">{money(gwFee)}</span>
              </div>
            )}
            <div className="my-2 h-px bg-[var(--line)]" />
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold">{tr("common.total")}</span>
              <span className="text-[20px] font-black text-brand-500">{money(total)}</span>
            </div>
          </div>

          {err && !kycBlocked && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11.5px] text-rose-400">
              <AlertCircle size={13} className="mt-0.5 shrink-0" /> {err}
            </div>
          )}

          {kycBlocked && (
            <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <div className="flex items-start gap-2 text-[11.5px] text-amber-300">
                <ShieldCheck size={14} className="mt-px shrink-0" />
                <span>{err}</span>
              </div>
              <Link
                href="/dashboard/verification"
                className="mt-2.5 flex h-9 items-center justify-center rounded-lg bg-amber-500 text-[12.5px] font-bold text-black transition active:scale-[.98]"
              >
                Verify my identity
              </Link>
            </div>
          )}

          <Btn
            className="mt-4 flex w-full items-center justify-center gap-2"
            disabled={isProcessing || blocked}
            onClick={submit}
          >
            {isProcessing && <Loader2 size={14} className="animate-spin" />}
            {isProcessing ? tr("co.processing") : `${tr("co.pay")} ${money(total)}`}
          </Btn>

          {isMixedCategory && (
            <div className="mt-2 text-center text-[10.5px] text-rose-400">Fix mixed categories to enable Pay</div>
          )}
          {hasMissingDetails && !isMixedCategory && (
            <div className="mt-2 text-center text-[10.5px] text-rose-400">Enter all per-game delivery details to enable Pay</div>
          )}

          <div className="mt-3 flex items-start gap-2 text-[11px] muted">
            <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-400" />
            {isRazorpay
              ? "Razorpay secure checkout. Funds are held in escrow after verified payment."
              : "Funds are held in escrow and released to the seller only after you confirm delivery."}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
