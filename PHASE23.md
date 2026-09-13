# Phase 23 — automatic delivery, order completion, currency & layout fixes

Build: `✓ Compiled successfully`, `tsc --noEmit` clean. Every fix verified by running the
real code paths, not by inspection.

---

## 1. Registration crash — `TypeError: (0 , i.xn) is not a function`

I could not reproduce this locally: `/register` and `/login` both render 200 with a clean
server log, and every import in `AuthForm` resolves.

`(0, i.xn)` is a **minified reference to a function that came back `undefined`** — the
classic signature of a compiled `.next` bundle that no longer matches the source it was
built from. Your VPS has been running builds from a repo that was missing my last batch of
changes, so `.next` and `src/` drifted apart.

**Fix on the VPS — a clean rebuild:**

```bash
cd ~/g2x
git pull
rm -rf .next          # this is the important part
npm ci
npm run build
pm2 restart g2x
```

If it survives a `rm -rf .next` rebuild, tell me and I will dig further — but this
signature almost always means a stale bundle.

## 2. Automatic delivery never reached the buyer — **root cause found**

This was a real and significant gap. `placeOrderAction` **never looked at
`offers.auto_delivery` or `offers.accounts_data`**. Every line was written as
`'processing'` with no credentials, so an automatic offer behaved exactly like a manual
one and the buyer saw nothing.

Three things were missing, all now in place:

1. `getCart` did not select `auto_delivery` / `accounts_data` — the checkout could not
   have known, even if it had asked.
2. Checkout now converts the seller's stored credential set into the
   `{label,value}[]` shape the delivered-details panel renders, writes the line as
   `delivered`, and stamps `delivered_at`.
3. When **every** line is auto-delivered the order itself becomes `Delivered`,
   `release_at` is stamped, a `Delivered` event is logged, and subscription instalments
   are scheduled from the same clock — so payout timing is identical to a manual sale.

Verified end to end with one automatic and one manual offer:

| | Automatic | Manual |
|---|---|---|
| Order status | `delivered` | `processing` |
| Item status | `delivered` | `processing` |
| Credentials | all 8 fields attached | none (seller sends) |
| `release_at` | +7 days, set | null until delivery |

The buyer's order page renders **Account Delivered**, the login, and the Reveal/Copy
controls.

Manual is unchanged and still waits for the seller — the two paths now genuinely differ,
driven by the seller's own choice.

## 3. Orders stuck on "Delivered", never "Completed"

The escrow sweep only ran on `/dashboard` and `/seller`. A buyer who opened **their order**
never triggered it, so a completed sale sat on Delivered until somebody happened to load a
dashboard.

The sweep now also runs on `/dashboard/orders`, `/dashboard/orders/[id]` and
`/seller/orders`. Verified: with `release_at` moved into the past the sweep flipped the
order to `completed`, the items to `completed`, logged the `Completed` event, and released
escrow to the seller — no double payment on a second run.

## 4. Wallet showed `$` in the account menu

`UserMenu` in `Header.tsx` was the last place hardcoding `${user.balance.toFixed(2)}`.
Now uses the locale hook. Verified with INR selected: **₹43,372.77**.

## 5. Search box hidden under the notification icon

The input was `min-w-0 flex-1` inside an `ml-auto` group, so as the nav grew the flex item
shrank toward zero and slid beneath the icons. It now has a real width that steps up with
the viewport (`200px → 240px → 260px`), and the icon group is `shrink-0` so it can never be
squeezed. Verified by measuring bounding boxes: search ends at x=1090, cart starts at
x=1157 — no overlap.

## 6. Seller payout currency

Payouts genuinely settle in **USD** — that is what leaves the platform — but showing a bare
"Amount (USD)" box beside INR balances was confusing. The input stays USD and now echoes
the converted value beneath it: *"≈ ₹8,300.00 at today's rate · paid out in USD"*. The
minimum and every other figure on the page already followed the site currency.

---

## Deploy

```bash
cd ~/g2x && git pull && rm -rf .next && npm ci && npm run build && pm2 restart g2x
```

The `rm -rf .next` matters — that is what clears the stale bundle behind issue 1.
