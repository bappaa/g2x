# Phase 20 — admin login crash, blank-page latency, per-product sell flow

Build: `✓ Compiled successfully`, `tsc --noEmit` clean. Verified in a real browser with
zero page errors.

---

## 1. Admin login crash (image-2)

```
Error: useLocale must be used inside <LocaleProvider>
  src/components/LocaleProvider.tsx (88:17)
```

**Cause.** The admin dashboard imports `SalesChart` from the seller panel. Last phase I
converted that component to the `useMoney()` hook so seller prices follow the selected
currency — but the admin panel is deliberately **not** wrapped in `<LocaleProvider>`
(admins work in USD so the numbers match the ledger). The hook threw, and because it threw
during render it took the entire panel down the moment you logged in.

**Fix.** `useLocale()` now falls back to a neutral locale (English, USD, unconverted)
instead of throwing. That is exactly what the admin panel wants, and it means a shared
component can never crash a tree just by being reused somewhere without a provider.
I kept a strict variant (`useLocaleStrict`) for the one component that genuinely requires
the provider — the locale switcher itself.

Verified in a browser: `/admin`, `/admin/products`, `/admin/orders`, `/admin/categories`,
`/admin/users` all render with **0 hydration errors**.

## 2. Blank page / slow response (image-1)

Your screenshot shows the sidebar and panel badge rendered with an **empty content area** —
the page had not finished streaming and there was nothing in its place.

**Cause.** The whole `/seller/sell/*` wizard had **no `loading.tsx`**. Next streams the
layout immediately and leaves the slot blank until the server finishes, so clicking
"New offer" looked like a broken half-rendered page.

**Fix.**
- Added a loading skeleton to every step of the sell wizard.
- Audited the entire app: `/dashboard/orders/[id]`, `/dashboard/verification` and
  `/p/[slug]` were missing one too. **Every route now has a skeleton.**
- Added `prefetch` to the "New offer" button and the sidebar category links, so the next
  page is already being fetched before the click lands.

Local timings after the change (the win is larger on Netlify, where each round-trip is
real network latency):

| Page | Size | Time |
|---|---|---|
| `/seller` | 128 KB | 35 ms |
| `/seller/offers` | 296 KB | 83 ms |
| `/seller/orders` | 123 KB | 30 ms |
| `/seller/finance` | 124 KB | 34 ms |

## 3. Per-product sell flow (images 3–5)

**The problem.** Sell-flow settings only existed per *category*, so every product in a
category was asked for the same things. A Crunchyroll subscription was being asked for a
Region, a Platform, a Login method and twelve delivery methods it will never use.

**The fix.** Every setting is now overridable **per product**, and each one is tri-state —
*Inherit* leaves the category in charge, so nothing changes until you deliberately
override it.

New **Sell flow** button on every row in Admin → Products / Offers:

| Control | Effect |
|---|---|
| **How is this product fulfilled?** | *Seller chooses* / *Automatic only* / *Manual only* |
| Unit label, Commission % | Per-product override |
| Offer title, Offer photos | Show / Hide |
| **Account credentials** | The encrypted login / 2FA vault |
| Quantity, Volume discounts | Show / Hide |
| Delivery method list, Region, Platform, Login method | Show / Hide |
| Notice for the seller | Replaces the category notice |

**Automatic** (image-4) shows the credential vault — the seller pre-fills login, email,
2FA and notes, and the buyer receives them the instant they pay.
**Manual** (image-5) hides the vault entirely and shows the guaranteed-delivery-time +
notes block instead; the seller delivers through the order chat.

Verified end to end. A subscription set to *Manual only* with the extras hidden now renders
**only** Plan / Duration / Warranty, delivery time, manual-delivery notes, quantity and
price — everything else correctly gone:

```
Delivery method    hidden      Login method                           hidden
Region             hidden      Volume discount                        hidden
Platform           hidden      Account information shared with buyer  hidden
Manual delivery    SHOWN
```

Saving from the admin modal persists correctly and takes effect immediately on the seller
side.

---

## Deploy
`npm run build` migrates the database first (this phase adds the per-product override
columns), so just push. The runtime guard also self-repairs them if a deploy reaches an
older database.
