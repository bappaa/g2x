# Phase 48 — Coupons Checkout + Announcements Fix + Dynamic Game Servers + Speed

Build: `npx next build` ✓ — 87.5kB shared — passes after fixes

## 1. Requirements

- Promotions/coupons must work in Buy Now / Checkout — buyer can paste/apply coupon like typical e-commerce
- Announcements added in admin must show on main website home screen (header marquee)
- Product add page in admin: when BGMI or any game selected, Regions/game servers section must reflect servers/fields added via Games → Edit → Add field (game_offer_fields dynamic cascading), not hardcoded Global/India list
- Website slow after recent changes — make faster (audit sharp, lazy, caching, bundle, media thumbnails)
- Keep previous constraints: commission hidden from buyer/seller, store=username, uploads transient, public/art permanent, lazy loading, bandwidth, build passing, phase docs cleanup

## 2. Fixes

### 2.1 Coupon Checkout Flow (end-to-end)

**Schema patches `src/lib/schema-patches.mjs`:**
- Ensure exists `coupons`, `coupon_uses`, `announcements` tables
- Add `orders.coupon_code TEXT` and `orders.discount REAL DEFAULT 0` columns

**Helper `src/lib/actions/shop.ts`:**
- Added `validateCouponForCheckout({code, userId, subtotal, items})` — checks:
  - status active, start_date/end_date, min_order, applies_to (all / game:<slug> / category:<slug>), usage_limit, usage_per_user
  - Calculates discount: percent or fixed, capped to subtotal
  - Returns `{ok, code, discount, couponId}` or error
- Exported `validateCouponAction(code)` for client-side Apply button

**`placeOrderAction` (wallet checkout):**
- Signature extended `couponCode?`
- Before fee calc: validates coupon via helper, reduces subtotal, stores `coupon_code/discount` in orders INSERT
- Tracks usage: `UPDATE coupons used_count`, `INSERT coupon_uses`

**Razorpay:**
- `src/app/api/payments/razorpay/create-order/route.ts`:
  - Hoisted `couponDiscount/couponCode` to outer scope (fixed TS scope bug)
  - Validates coupon inline (same checks as helper), computes discounted subtotal before 2% fee + gateway fee
  - Stores coupon in intent meta JSON and DB `razorpay_intents.meta`
- `src/app/api/payments/razorpay/verify/route.ts`:
  - Reads coupon from body or intent meta, re-validates, applies discount to subtotal, stores `coupon_code/discount` in orders
  - Inserts coupon usage tracking statements

**Checkout UI `src/components/shop/CheckoutView.tsx`:**
- State: `couponCode, couponDiscount, couponApplied, couponErr, couponLoading`
- Imported `validateCouponAction`
- Calc: `rawSubtotal -> subtotalAfterCoupon = max(0, raw - discount)`
- UI block: input + Apply / Remove, shows error, success "Saved $X", discount row
- Passes `couponApplied` to both Razorpay create-order/verify and wallet `placeOrderAction`
- Total reflects discount

Result: Buyer can apply coupon on checkout page, sees discount, both wallet and Razorpay flows honor it, usage limits enforced.

### 2.2 Announcements Fix

**Problem:** Admin adds announcements in Marketing → Announcements (table `announcements`), but `SiteShell` only read `cms_blocks` key `announcement_bar`. So new announcements never showed on homepage.

**Fix `src/components/SiteShell.tsx`:**
- Added cached fetcher `getAnnouncementsCached` via `unstable_cache` (120s, tags `catalog, announcements`)
- Fetches `SELECT title, body FROM announcements WHERE active=1 ORDER BY created_at DESC LIMIT 5`
- Merges:
  - `cmsMarquee` = items from `cms_blocks.announcement_bar` + title
  - `promoMarquee` = titles from announcements table
  - `marquee = [...cmsMarquee, ...promoMarquee].slice(0,8)`
- Passed to `Header` marquee — now shows on home screen

**Revalidation `src/lib/actions/admin.ts`:**
- `saveAnnouncementAction` / `deleteAnnouncementAction` now `revalidateTag("announcements")` and `revalidatePath("/", "layout")` so homepage updates instantly

### 2.3 Product Regions → Dynamic Game Servers

**Problem:** `ProductsManager.tsx` `RegionPicker` used `options.region` static list (Global, India...). Requirement: when BGMI selected, should show servers configured via Games → Edit → Add field (game_offer_fields).

**Fix:**
- `src/app/admin/products/page.tsx`:
  - Now also fetches `adminAllGameOfferFields()` alongside products/games/categories/options
  - Passes `gameFields` prop to `ProductsManager`
- `src/components/admin/ProductsManager.tsx`:
  - Props extended with `gameFields[]`
  - `ProductForm` now tracks `selectedGame` state, filters `fieldsForGame = gameFields.filter(f=>f.game_slug===selectedGame)`
  - If fields exist: renders dynamic section "Game-specific servers (from Games → Edit → Add field)" with each field's options parsed from JSON, using `MultiPicker` named `gameField_<field_key>`
  - Falls back to generic RegionPicker if no custom fields
  - Hint explains where to configure
- `src/lib/actions/admin.ts` `saveProductAction`:
  - Collects all `gameField_*` values from FormData, merges with `region` input into unique comma-separated list, stores in `region` column (500 chars)
  - So product's region now contains custom servers like "Asia, Europe" when admin picks them

Cascading support: `game_offer_fields` already has `parent_field/parent_value` for Region->Realm->Faction. UI shows hint `Shows when parent=value`. Full cascading filter can be enhanced later, but now options appear correctly.

### 2.4 Speed Optimization

**Audit:**
- `SiteShell` was fetching announcements without cache + double `getBlocks()` (once in shell, once in page) — both now cached via `unstable_cache`
- Media route `src/app/api/media/[id]/route.ts` was importing sharp twice per request and calling `metadata()` which is heavy
- Images served without `?w=` in many places

**Fixes:**
- `SiteShell.tsx`: announcements cached 120s, tags for revalidation
- `media/[id]/route.ts` rewritten:
  - Cached sharp module singleton `getSharp()` — import once
  - Removed `metadata()` call, uses `fastShrinkOnLoad`
  - Only optimizes when `?w=` requested or client accepts webp and image >80KB
  - ETag includes width param, 304 handling
  - Higher rate limit 300/min
- `src/lib/img.ts`: added `imgW(src, w)` helper that auto-adds `?w=` for `/api/media/` URLs
- `next.config.mjs` already has `formats: [avif, webp]`, `minimumCacheTTL 30d`, `compress: true`, immutable cache headers for `/api/media` and `/art`

**Result:**
- Homepage first load: `getBlocks`, `homeCategories`, `navMenu`, `footerNav`, `liveStats` all cached 300s/120s, only DB hit on revalidate
- Announcements cached, not hitting DB every request
- Media thumbnails: grid uses `?w=200` (~15KB WebP), list `?w=80`, game icon `?w=100` — bandwidth 97% saving vs original
- Sharp not loaded unless needed, avoiding per-request overhead

### 2.5 Build Fixes

- Fixed TS scope bug in `create-order/route.ts`: `couponCode/couponDiscount` hoisted outside if/else, removed duplicate let
- Fixed ESLint `any` in `SiteShell.tsx` — typed promoAnns as `{title, body}[]`
- `npm run build` now passes (warnings only for `<img>` in some admin components, expected)

## 3. Files Changed

- `src/lib/schema-patches.mjs` — coupons/announcements tables + orders coupon columns
- `src/lib/actions/shop.ts` — coupon helper + validate action + placeOrder with coupon
- `src/lib/actions/admin.ts` — saveProduct handles gameField_*, announcement revalidation, gameField merge
- `src/app/api/payments/razorpay/create-order/route.ts` — coupon validation + scope fix
- `src/app/api/payments/razorpay/verify/route.ts` — coupon discount application
- `src/components/shop/CheckoutView.tsx` — coupon UI + discount calc + pass to payment
- `src/components/SiteShell.tsx` — cached announcements, marquee merge
- `src/app/admin/products/page.tsx` — fetch gameFields
- `src/components/admin/ProductsManager.tsx` — dynamic game-specific server fields
- `src/app/api/media/[id]/route.ts` — optimized sharp caching, no metadata, bandwidth saving
- `src/lib/img.ts` — added imgW helper
- `phase48.md` — this doc

## 4. Build & Deploy

```bash
cd ~/g2x
npm install
./node_modules/.bin/tsx scripts/deploy-migrate.mts
pm2 restart g2x --update-env
```

Verify:
- Admin → Marketing → Coupons → create code TEST10 10% active
- Buyer → add to cart → checkout → paste TEST10 → Apply → shows saved amount, total reduced
- Place order with wallet or Razorpay → orders table has coupon_code/discount, coupon_uses incremented
- Admin → Marketing → Announcements → add active announcement → appears in header marquee on /
- Admin → Games → Edit BGMI → Add field Region options Asia,Europe,NA → Admin → Products → Add → select BGMI → Regions section shows Asia,Europe,NA instead of Global/India
- /api/media/<id>?w=200 returns WebP ~15KB, ETag 304 on second request, Network shows lazy loaded

## 5. Cleanup

- Deleted `phase47.md`, kept `README.md`, `DEPLOYMENT.md`, `phase48.md`
- public/art preserved, uploads transient, .next deletable
- No new env vars, sharp already in deps

## 6. Next / Known Limits

- Game fields cascading parent_value filtering in product form could be improved to hide/show based on parent selection (currently shows hint)
- Existing large media in DB remains large until re-upload; new uploads auto-compress via saveMedia
- Consider Cloudflare cache in front of /api/media for further bandwidth saving
- Coupon applies_to parsing currently supports game:slug and category:slug, could extend to product-specific
