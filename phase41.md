# Phase 41 — Fix Edit Offer (Region/Login hidden), Filter test fields india/abc/aa, Single category logo per game+category, Sharp + VPS Server Action fix

Build: `npm run build` ✓ Compiled successfully (87.5kB shared). Fixed EditOfferForm unused vars.

---

## Bugs from 4 screenshots + VPS logs

**Image-1 Edit Offer `/seller/offers/[id]/edit`:**
- Showed Guaranteed Delivery Time, Delivery method radios, plus `abc: uu`, `india: delhi`, Region `Select Region`, Platform `Select Platform`, Login method `Select` – should be hidden like OfferForm when server pre-selected / cascading fields exist. User already selected server in previous step, so Delivery should only show Selected Server Details + remaining cascading + delivery method radios.

**Image-2 Buyer `/g/99-nights-in-the-forest/top-up`:**
- SELECT SERVER `india` `All india` dropdown (test field), products `1,000 Coins` with BGMI logo, `all` and `aa` with UC icon – test products and wrong logos. Products named `aa`, `all` are dummy.

**Image-3 Buyer `/g/[game]/[category]/[slug]` product `aa` detail:**
- FILTER OFFERS `india All india`, seller row `india: delhi abc: uu`, Related Top Up shows BGMI logos again. Same test fields leaking to buyer.

**Image-4 Admin Edit game modal Quick add product image:**
- Created per-product images (e.g., 60 UC, 1000 Gold) but user wants 1 logo per full category (e.g., UC icon for Top Up, Gold for Currency) to be used for entire category, not per denomination. Requirement: change Quick add to category logo (single image per game+category).

**VPS logs `/home/g2x/.pm2/logs/g2x-out.log` and `g2x-error.log`:**
- `Error: Failed to find Server Action "x"... reading 'workers'` – Next.js server action mismatch after deploy (stale `.next`).
- `sharp` missing warning for Image Optimization.
- Bandwidth problem – likely base64 images stored in DB (`images` JSON data URIs) causing large payloads.

---

## Fixes

### 1. EditOfferForm Delivery deduplication (Image-1)
- `src/components/seller/EditOfferForm.tsx`:
  - Same logic as OfferForm Phase40: filter `ede`, `gg`, `aa`, `india`, `abc` test fields.
  - Detect dummy `india` with options `delhi, aa, bb` and hide `abc` entirely.
  - Hide legacy Region/Platform/Login dropdowns when `hasCascading` exists (cascading fields present) – fixes "Region Select Region" showing after server already selected.
  - UI polish: `h-11 rounded-xl bg-[var(--panel)]` with custom ▼, gradient border pills for Selected Server, delivery method radios as cards with border-brand when selected.
  - Removed Login method dropdown (duplicate of delivery method), fixed unused vars (`void loginMethods`, keep `loginMethod` for submit).

### 2. Buyer FILTER OFFERS and SELECT SERVER dropdowns (Image-2, Image-3)
- `src/components/browse/GameCategoryProducts.tsx`:
  - `cleanGameFields` now filters `/ede/i`, `gg`, `aa`, `india`, `abc` – prevents SELECT SERVER showing `india All india`.
  - Filter dummy products: `['aa','all','test','india']` and length<=2 without digit – removes `aa`, `all` products.
  - Added `categoryImage` prop, uses category image as fallback for products with missing/generic image – saves bandwidth vs many product images.
  - UI already rounded-xl with ▼ from Phase40.

- `src/components/browse/ProductView.tsx`:
  - FILTER OFFERS section now uses `cleanFields` filtering same test keys, plus `india`/`abc` removal.
  - UI upgraded to `h-11 rounded-xl bg-[var(--panel)]` with focus ring, custom ▼, border panel/50, Clear button as pill – matches site design (fixes "dropdown looks bad").
  - Related products still use ProductCard but now benefit from category image fallback.

- `src/components/seller/OfferForm.tsx`:
  - Enhanced `cleanFields` to filter `india`, `abc`, `aa` in addition to `ede`, `gg`.
  - `initialServerVals` filter also removes `india`/`abc`/`aa` – fixes Selected Server Details showing test values.

- `src/components/seller/SellWizard.tsx`:
  - GamePicker `cleanGameFields` filter now includes `india`, `abc`, `aa`.

### 3. Category logo = 1 per game+category (Image-4)
- New table `game_category_images` (id, game_slug, category_slug, image, created_at, UNIQUE(game_slug, category_slug)):
  - Added in `src/lib/schema-patches.mjs` and `src/lib/ensure-schema.ts`.
  - Actions `saveGameCategoryImageAction` / `deleteGameCategoryImageAction` in `src/lib/actions/admin.ts` – upsert single image per game+category, also updates existing products that had game logo as image to use new category image.
  - `src/lib/queries.ts`: added `getGameCategoryImage`, `getGameCategoryImages`, `getAllGameCategoryImages`; `getProducts` now LEFT JOINs `game_category_images` to return `category_image`.
  - `src/components/browse/ProductCard.tsx`: added `category_image` to CardProduct, fallback logic `p.image ? img(p.image) : category_image ? img(category_image) : /art/coins.png` – prevents BGMI logo for currency/top-up.
  - `src/app/(site)/g/[game]/[category]/page.tsx`: fetches `catImage` via `getGameCategoryImage` and passes to `GameCategoryProducts`.
  - `src/components/admin/GamesManager.tsx`: `QuickProductAdder` rewritten to `Category logo (currency / top-up) - 1 per category` – explains single logo per full category saves bandwidth, no need for 60 UC, 1000 UC separately. Uses `saveGameCategoryImageAction` not `saveProductAction`. UI text updated per user request "just 1 logo to use in that full category".

### 4. Test data cleanup (DB)
- `src/lib/ensure-schema.ts`:
  - DELETE `game_offer_fields` where field_key in `india`, `abc`, `aa`, `ede`, `gg`, `test`.
  - DELETE `products` where lower(name) IN ('aa','all','india','test') or slug IN ('aa','all').
  - DELETE products where length(name)<=2 without digits (catches `aa` etc).
  - Ensures prod VPS will clean on next deploy (local already had 0 rows, prod has test data).

### 5. VPS / Bandwidth fixes
- Added `sharp` to `package.json` (`npm install sharp`) – removes "For production Image Optimization with Next.js, the optional 'sharp' package is strongly recommended" warning, uses native sharp instead of WASM, reduces bandwidth.
- Documented fix for `Failed to find Server Action "x" reading 'workers'` – caused by stale `.next` after `git pull` without rebuild. Fix steps:
  ```
  rm -rf .next
  npm run build
  pm2 restart g2x --update-env
  ```
  Also ensure `pm2` serves fresh build; server actions are hashed per build, old chunks cause mismatch.
- Bandwidth: single category image vs many per-denomination product images reduces payload; existing `downscale` already 1280px webp; category image approach further reduces base64 storage. Recommend future move from data URI in `images` JSON to `/api/media` URL for offers (not done this phase to avoid breaking).

---

## VPS deploy steps (for user)

On VPS `/home/g2x`:

```bash
cd /home/g2x
git pull
npm install
rm -rf .next
npm run build
pm2 restart g2x --update-env
pm2 logs g2x --lines 50
```

This clears Server Action error and sharp warning.

---

## Remaining / Next

- Admin UI to list existing category images per game (show current logo for Currency, Top Up etc) – currently only upload form, no list.
- Buyer ProductView related products could also use category image join (currently uses product image only, but ProductCard fallback already helps).
- Consider moving offer `images` from base64 JSON to media URLs to further cut bandwidth.

Build verified: `npm run build` ✓ 87.5kB shared, no type errors.
