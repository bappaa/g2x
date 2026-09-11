# Phase 24 — seller listings visible, mail delivery, navbar, KYC gate

Build: `✓ Compiled successfully`, `tsc --noEmit` clean. Buyer panel left alone except
where a fix was explicitly required.

---

## 1. Emails returning 422 — root cause found

Resend's JSON API is **camelCase and rejects unknown keys**. We were sending
`reply_to` (the older snake_case form), so *every* message was rejected with
`422 Unprocessable Entity` and silently never left. It affected all ten addresses, not
just `notification@`.

Fixed: `reply_to` → `replyTo`, and tag values are now sanitised to the character set
Resend allows (`A-Z a-z 0-9 _ -`) instead of being trusted. Verified by intercepting the
outgoing payload:

```
PAYLOAD KEYS: from, to, subject, html, text, replyTo, tags
  replyTo: notification@g2x.gg | reply_to present: false
  tags:    [{"name":"type","value":"order"},{"name":"type","value":"delivered"}]
```

## 2. Seller offers never appeared on the site — root cause found

With no admin product for a game, the wizard sent the seller down the "free-form" path,
which wrote a **`listings`** row for *every* category. But only Accounts and Boosting are
rendered from `listings` — Currency, Items, Top Up, Gift Cards and Subscriptions come from
`products` + `offers`. So the seller's offer saved successfully and then existed nowhere a
buyer could reach.

Now, for a product-backed category the seller's item **becomes a real product** (reusing an
identical one if another seller already created it, so the catalog doesn't fill with
duplicates), the offer hangs off it, and the game is linked to the category. Accounts and
Boosting still use `listings`, which is correct for one-of-a-kind items.

Verified end to end — one seller-created Currency offer, no admin involvement:

| Surface | Visible |
|---|---|
| `/c/currency` | ✓ |
| `/g/roblox/currency` | ✓ |
| `/admin/products` | ✓ |
| `/admin/offers` | ✓ |
| Seller → All listings | ✓ |
| Seller → Currency | ✓ |

`listings` count stayed 0, confirming it took the product path.

## 3. Navbar

- **Home** and **Subscriptions** removed (logo already links home; Subscriptions is still
  in the footer, the category tiles and `/c/subscriptions`).
- **Messages icon** added between the bell and the cart — measured at x=987 / 1031 / 1075.
- Only rendered when signed in; sellers go to `/seller/messages`, buyers to
  `/dashboard/messages`.
- Search narrowed to `150 → 190 → 220px`. Header no longer overflows at 1440px.

## 4. Buyer KYC submit button did nothing

The photo inputs were `required` **and** `className="hidden"`. A browser refuses to submit
a form containing an invalid *hidden* required field, and cannot scroll to it or show a
bubble — so the button silently did nothing with no error anywhere.

Removed `required` from the hidden inputs and added explicit validation that names the
missing photo ("Please upload the photo of your ID"). **The seller verification form had
the identical bug** and is fixed the same way.

## 5. Unverified buyers were still receiving the goods

KYC was *recorded* but never *enforced* — `kyc_due_at` was set and then ignored, so an
unverified buyer could read the account details on a high-value order.

`getOrder` now strips credentials server-side (they never reach the browser) when the gate
is on, the order is at/above the threshold, and the buyer is not approved. `pending` still
blocks — an unreviewed submission is not a verified identity. The order stays fully
visible; only the secret is withheld, behind a clear "Verify your identity to unlock your
delivery" panel. Payment is still never blocked, which is deliberate and unchanged.

## 6. Automatic delivery — email + status

- The credentials are now **emailed** to the buyer the moment payment clears, in a
  formatted table, so nothing depends on them keeping the tab open. HTML-escaped.
- The tracker logged `Delivered` and then sat there for the 7-day escrow window, which
  reads as unfinished. Both automatic **and** manual delivery now also log `Completed`
  once every line is handed over. `orders.status` and the escrow timer are untouched —
  the payout hold is genuinely still running and is shown separately.

Verified: `Order Placed → Delivered → Completed`, credentials attached, seller did nothing.

## 7. Demo content removed
- "Demo: approve instantly →" button gone from Become a Seller, and
  `selfApproveSellerAction` deleted from the server so it cannot be called at all.
- Hero badge said **"INDIA'S #1 GAMING STORE"**. That is CMS data, not code, so it
  survives deploys — `npm run db:fix-hero` rewrites it to "TRUSTED WORLDWIDE". Run it once
  on the VPS.

## 8. Seller offers page
- "Create your first offer" → **New offer**, and it now opens the guided wizard instead of
  the old modal that skipped every per-category question.
- The offer form shows the live conversion: *"Buyers see ₹1,020.00 per K"*, so a seller
  working in INR is not guessing. Prices are still stored in USD to keep offers comparable.

---

## Deploy

```bash
cd ~/g2x && git pull && rm -rf .next && npm ci && npm run build
npm run db:fix-hero        # once — removes the India badge from CMS data
pm2 restart g2x
```

## Not done in this pass
Per-offer custom buyer fields ("seller asks the buyer for their UID"). The plumbing exists
(`field_templates`, `custom_fields`) but wiring it into checkout is a change to the buyer
purchase flow, which you asked me not to touch unless necessary. Say the word and I'll do
it as a focused change.
