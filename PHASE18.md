# Phase 18 — automated ranking, subscription escrow, shared wallet, seller panel

Build: `✓ Compiled successfully`. Every money rule below was proven with an end-to-end
simulation against the real functions (not mock-ups); test data removed afterwards.

---

## 1 & 2. Automatic popularity + 0-9 then A-Z ordering

**"Popular games" now ranks itself by actual sales.** `sold` is real delivered/completed
quantity for that game *in that category*, counted across both `order_items → products`
(currency, top-ups, items, subscriptions) **and** `order_items → listings`
(accounts, boosting). Nobody curates it — sell more, rank higher.

**Everything else lists numbers first, then A-Z.** A shared `NAME_SORT()` SQL helper and a
matching JS `collate()` keep the nav menu, the category index and the game lists
identical. SQLite's default ordering is case-sensitive ("Zelda" before "apex"), so the
sort lowercases and forces the numeric block first.

**Category pages** (image-2) rebuilt as `GameIndex.tsx`, in our own design language:
- *Trending now* — top 5 by real sales.
- Search box reading "Search by N games", a clickable **0-9 A B C…** letter bar that only
  shows letters with games behind them, and the full list with per-game live offer counts.

Verified live: with seeded sales of Roblox 55 / 8 Ball 30 / GTA V 20, Trending rendered in
exactly that order while "All games" stayed alphabetical.

## 3. Subscription drip-release — the runaway-seller problem

Your exact scenario: Netflix Premium 12 months, seller vanishes after month 1.

A subscription is now **paid to the seller monthly instead of in one lump**:

    instalment = seller_net / months

Month 1 unlocks with the normal 7-day escrow release; each later month unlocks 30 days
after the previous. Everything not yet released stays in the seller's escrow — real money
the buyer can still recover. New `src/lib/subscription.ts`; the plan is written
automatically when the seller marks Delivered, and released by the existing escrow sweep.
Rounding is absorbed by the final instalment so instalments always sum to the cent.

Simulated $120 / 12 months, 8% commission (seller_net $110.40, $9.20/month):

| step | result |
|---|---|
| purchase | escrow $110.40, available $0 |
| 12 instalments scheduled | sum **$110.40** exactly |
| month 1 due | released $9.20 → available $9.20 |
| through month 5 | available $46.00, escrow $64.40 |
| **seller vanishes, buyer disputes** | months 6-7 come due → **released 0, frozen** |
| partial refund | buyer credited **$64.40** for 7 unused months |
| final check | paid $46.00 + refunded $64.40 = **$110.40** ✓ |

The seller keeps exactly the 5 months they actually provided.

## 4. One shared wallet — spendable vs withdrawable

New `src/lib/wallet.ts`. A seller spends from the **same** balance they earn into, but
only earned money can leave the platform:

    balance      = topped-up money + seller earnings   (all spendable on G2X)
    withdrawable = seller earnings only                (cashable to a bank)

Top-ups raise `balance` but not `withdrawable`, so card money can never be cashed out —
that closes a money-laundering hole. Spending draws down site credit **first**, preserving
cashable earnings. The withdrawal cap is `min(available_bal, withdrawable)`, and the
`UPDATE … WHERE withdrawable >= ?` guard makes a concurrent double-withdrawal impossible.

Verified: $100 top-up + $46 earned → withdraw cap $46 (not $146); spend $30 then $80 →
site credit consumed first; withdraw $30 succeeded, $999 rejected with 0 rows affected.

## 5. Seller dispute chat with evidence

`/seller/disputes` is now a **conversation per dispute** (image-3 replaced), carrying the
same red highlighted "Order disputed by buyer / Reason: …" banner as the buyer panel.
Sellers can attach **images and video** (PNG/JPEG/WEBP/GIF/MP4/WEBM/MOV, 8 MB), with an
image lightbox and inline video player.

**10-day auto-delete** (`src/lib/retention.ts`): attachment payloads are blanked 10 days
after upload and the bubble becomes "Attachment expired", so history still reads
correctly. Media on a dispute that is still open/under review is **kept as evidence**
until it closes. Runs automatically on page renders (no cron on this host).

Verified: 30-day-old media on an *open* dispute kept; 30-day-old media on a *resolved*
dispute purged; 2-day-old media kept.

## 6. Seller sidebar (image-4) and offers page (image-5)

"Listings" removed as a standalone item and folded into an expandable **My Offers** drawer
containing All listings, Currency, Accounts, Top Ups, Items, Subscriptions, Boosting. Each
filters the offers table via `?cat=`, the status tabs preserve the category, and
`/seller/listings` redirects so old bookmarks still work. Built in our own UI — no markup
or assets from the reference screenshots.

---

## Bug found and fixed during verification
`SUM()` over floats produced `$64.39999999999999` in the refund path. Money is now rounded
to cents at every boundary in the subscription module.

## Deploy reminder
Run `npm run db:migrate` against Turso — this phase adds `users.withdrawable`,
`sub_months` on products/offers/order_items, the `subscription_schedule` table, and the
dispute-attachment columns. The runtime schema guard also self-repairs them.
