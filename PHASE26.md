# Phase 26 — VPS log errors, 404s, the offer-submit crash, alphabetical lists, bulk products

Build: `✓ Compiled successfully`, `tsc --noEmit` clean. Every fix reproduced first, then
verified against a running server.

---

## 1. `Resend responded 422: The \`type\` tag is duplicated`

Every tag was sent as `name: "type"`. A call like `tags: ["order", "delivered"]` therefore
produced **two** `type` entries, and Resend rejects duplicate tag names — so the whole
message was thrown away. This hit order-delivered and auto-delivered emails, which are
exactly the ones that matter.

The first tag keeps the name `type` (so existing Resend filters still work) and extras get
an indexed name (`type_1`, …). Duplicates are also de-duped.

## 2. Message icon 404'd for every user

I pointed the navbar icon at `/seller/messages` for sellers — **that route does not
exist**. There is one inbox, at `/dashboard/messages`. A new buyer with no orders hit it
too, because the link was wrong for everyone, not because the inbox was empty.

Now always `/dashboard/messages`. Verified: a brand-new buyer with zero orders gets 200
and the normal empty state.

## 3. White screen when a seller submits an account offer — root cause

Three failures in a row, one cause:

```
new:1   413 (Request Entity Too Large)
TypeError: Cannot read properties of undefined (reading 'ok')
```

Next.js caps server-action bodies at **1 MB** by default. The offer form accepts 6 photos
at 2 MB each, and base64 adds ~33% on top — so the request was rejected before it ever
reached the action. The client then read `.ok` off an `undefined` response, which React
turned into the blank "Application error" page, losing everything the seller had typed.

Fixed at three levels:
- `serverActions.bodySizeLimit` raised to **12 MB** in `next.config.mjs`.
- Photos are **downscaled to 1280px WebP in the browser** before upload (~100-200 KB each
  instead of multi-megabyte phone photos). GIFs are passed through so animation survives.
- The submit handler treats a missing/failed response as an error and keeps the form on
  screen with a readable message, instead of crashing.

## 4. `/dashboard/support` 404

The wizard's "Contact our support" link pointed at `/dashboard/support`; the real page is
`/support`. Fixed.

## 5. Alphabetical game lists everywhere (image-1)

`getGames` and friends ordered by `sort_order` — insertion order, which looks random. Now
**numbers first, then A-Z**, matching the category index and nav menu, across the sidebar
rail, per-category lists, the search index and the admin catalog pickers.

Verified on `/g/roblox/currency`: *99 Nights in the Forest → +1 Speed Keyboard Escape →
A Universal Time → Abyss → Adopt Me*.

(Categories deliberately keep their manual `sort_order` — that drives your navbar order.)

## 6. Bulk-add products with artwork

`/admin/bulk` was a stub that redirected to the product list. It is now a real tool:

- pick a category, tick any number of games (with search + select-all), paste the
  denominations once as `Name | price`
- live preview of how many products will be created
- **idempotent** — re-running skips anything that already exists
- each product **inherits the game's logo**, and the game is linked to the category
  automatically, so it appears on the storefront straight away
- product tiles fall back to the game's generated art, so nothing renders as a blank square

Verified: 6 products across 3 games in one submit, live on `/c/currency` and
`/g/roblox/currency`, 171 artwork tiles rendered and **0 placeholders**.

---

## Deploy

```bash
cd ~/g2x && git pull && rm -rf .next && npm ci && npm run build && pm2 restart g2x
```

The `bodySizeLimit` change is in `next.config.mjs`, so the rebuild is required — restarting
alone will not pick it up.

> **Note on the `sharp` warning in your log:** it is advisory, not an error. Installing it
> (`npm i sharp`) makes Next optimise images faster in production. Worth doing, but nothing
> is broken without it.
