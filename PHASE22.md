# Phase 22 — per-category seller forms, seller-created offers, admin order & speed

Build: `✓ Compiled successfully`, `tsc --noEmit` clean. Verified in a real browser with
zero page errors.

---

## 1. Seller form now matches your spec, per category

Each category asks for exactly what you specified — no more identical form everywhere.
Seeded by `npm run db:sellflow`, and every value stays editable in
Admin → Categories → Sell flow.

| | Currency | Top Up | Accounts | Items | Gift Cards |
|---|---|---|---|---|---|
| Offer title | – | – | ✓ | ✓ | ✓ |
| Photos | – | – | ✓ | ✓ | – |
| Region | ✓ | ✓ | – | – | ✓ |
| Delivery method list | ✓ | ✓ | – | ✓ | – |
| Credential / code vault | – | – | ✓ | – | ✓ |
| Volume discount | ✓ | ✓ | – | ✓ | – |
| Unit | **K** | unit | account | unit | gift card |
| Fulfilment | manual | manual | **auto or manual** | manual | **auto or manual** |
| Commission | 5% | 5% | 10% | 15% | 10% |

**Guaranteed Delivery Time** is now exactly your list: 20 min, 1 H, 5 H, 12 H, 1 day,
2 days, 3 days, 7 days, 14 days, 30 days.

**Delivery methods** are your list too: In-game trade, Game Pass, Auction House, Mail
Trade, Island Delivery, Epic Gifting, Login Method, In-game delivery.

**Accounts** get the "Original Email" dropdown; **auto** shows the credential vault
(login, email, 2FA, additional info, + Add Additional Account) and **manual** replaces it
with the delivery-time promise, as in your two screenshots.

**Gift Cards** is a new category. It reuses the vault but asks only for a code and an
optional redemption URL — "Gift Card #1", "+ ADD ADDITIONAL GIFT CARD".

I added **Top Up** myself as you asked: same shape as Currency, but per-unit and with
Region, Platform and Login method, since a top-up is tied to a store region and a device.

## 2. Sellers can create their own offers

Previously a seller could only pick from the admin's catalogue. The product step now ends
with **"Selling something not listed here? → Create my own offer"**, which drops them into
the same form with a required title. So a seller with "100 UC" can list it without waiting
for an admin. Picking a pre-defined product is still the default, because that is what
keeps offers comparable on one product page.

## 3. Seller photos are now visible to buyers — bug fixed

**Cause.** The sell wizard saved uploads into `offers.images` (a JSON array of data URIs),
but the buyer-facing offer rows only ever rendered a store-initial avatar. The photos were
stored and never displayed.

**Fix.** Offer rows on the product page (desktop table and mobile cards) now show the
seller's first uploaded photo as a thumbnail, falling back to the initial avatar when
there is none. Verified end to end: seeded an offer with a photo → it renders on the buyer
product page.

## 4. Admin lists are alphabetical

Games and Products now sort **numbers first, then A-Z** — the same collation as the
storefront, so an admin finds a game where a visitor would. (Categories deliberately keep
their manual `sort_order`, since that drives the navbar order you specified earlier.)

## 5. Speed — pagination

`/admin/games` was rendering all 169 games in one table.

| Page | Before | After |
|---|---|---|
| `/admin/games` | **663 KB / 102 ms** | **197 KB / 66 ms** |
| `/admin/products` | — | 121 KB / 33 ms |

Both tables are paginated (40 games, 50 products per page) with pagers that preserve the
active filters. Game search moved server-side — with pagination, filtering in the browser
would only have searched the visible page.

---

## Commands
- `npm run db:sellflow` — apply the per-category form spec + option lists
- `npm run db:catalog-new` — rebuild the game catalog from `scripts/catalog.json`
- `npm run db:times` — reseed delivery times

## Note
The catalog still has **0 products** by design — you said you'd add them yourself. The
seller wizard handles that correctly: with no products in a game, it goes straight to the
free-form offer form.
