# Phase 25 — accounts auto-delivery, seller listings, navbar, avatars

Build: `✓ Compiled successfully`, `tsc --noEmit` clean. Everything verified by running it.

---

## The handoff folder — you do **not** need it

`/home/user/handoff` was only my staging copy of files that already exist in the repo.
Nothing references it. Ignore it; it is not part of the app.

## 1 & 2. Accounts: not listed, and automatic delivery not working — one root cause

Both symptoms came from the same gap: **`listings` had no delivery columns.**

Accounts and Boosting are one-of-a-kind items stored in `listings`. Every other category
is an `offer` against a shared product. But `listings` only had
`title / price / stock / delivery_time` — there was nowhere to put `auto_delivery` or the
seller's pre-filled credentials. So:

- an account sold as **Automatic** silently behaved as **manual** (subscriptions worked
  because they use `offers`, which has those columns);
- and **"My Offers" only ever queried `offers`**, so a seller who listed an account saw an
  empty page and reasonably assumed the listing had failed.

Fixed:
- `listings` gains `auto_delivery`, `accounts_data`, `images`, `delivery_method`,
  `instructions`, `min_qty`, `custom_fields`.
- The wizard writes them, and the cart reads them (it previously hardcoded
  `0 AS auto_delivery` for listings).
- `getSellerOffers` now **unions `offers` and `listings`**, so everything a seller has
  listed appears in one place. The pager counts both.

Verified end to end with a real accounts listing sold as Automatic:

| Check | Result |
|---|---|
| Seller → All listings | shows |
| Seller → Accounts tab | shows |
| Public `/c/accounts` | shows |
| Order status after purchase | `delivered` instantly |
| Credentials attached | all 4 fields |
| Timeline | Order Placed → Delivered → **Completed** |
| Seller action required | none |

## 3. Seller no longer told to change the password of an account they sold

The delivered-details panel is shared between buyer and seller. Its advice — *"Change the
email and password as soon as you log in…"* — is correct for the buyer and nonsense on the
seller's own order page.

It is now scoped with an `audience` prop: buyers see it, sellers do not.

## 4. Navbar: avatar only

The username is gone from the header. The avatar is a 36px circle that opens the same
dropdown, with the handle still shown as the first line inside it. Verified: no username
text in the header, dropdown opens, handle present inside.

## 5. Profile photo upload

- Click the avatar (or "Change photo") on **Profile**, with a live preview and a Remove
  option. It saves with the rest of the form — no second button, no half-applied state.
- Images are **downscaled to 256px in the browser** before upload: a phone photo is 3–8 MB,
  which the 1 MB server cap would reject and which is absurd for a circle. The stored
  WebP came out at **1 KB** in testing.
- Stored as a data URI on `users.avatar`, so it works on a host with no writable disk and
  appears immediately in the header.

### Bug found while testing this
The first implementation converted the preview with `fetch("data:…")`, which the site's CSP
blocks (`connect-src` has no `data:`). It failed with *"Failed to fetch"* and silently
dropped the photo — the form said nothing. Replaced with a direct `atob` decode. Verified:
a 900×600 PNG now persists to the database and renders in the navbar.

---

## Deploy

```bash
cd ~/g2x && git pull && rm -rf .next && npm ci && npm run build && pm2 restart g2x
```

`npm run build` applies the new columns automatically. Existing account listings keep
working — they simply default to manual delivery until the seller edits them.
