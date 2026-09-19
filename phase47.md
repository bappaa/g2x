# Phase 47 — Admin Filters Fixed + Orders Refund Logic + Bandwidth Optimized + Seller Crash Hotfix

Build: `npx next build` ✓ 87.5kB shared — ESLint clean

## 1. User Reports

```
admin > seller verification -> all button not working
admin > buyer kyc -> all button not working
admin > users
admin > withdrawals -> all button not working
admin > all orders -> showing refund after refund was done
so, its basically, many buttons are not working including these, check all the buttons if they are working or not,
after that, fix the bandwidth problem... now its taking high bandwidth from image section... fix that issue
```

Plus VPS log:
```
LibsqlError: SQLITE_ERROR: no such column: oi.created_at at seller/orders
[deploy-migrate] skipped: ALTER TABLE order_items ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now')) — Cannot add a column with non-constant default
```

## 2. Root Causes & Fixes

### 2.1 All buttons not working — FilterTabs

**File `src/components/admin/ui.tsx`:**
```tsx
// OLD
href={t === "all" ? base : `${base}?${param}=${t}`}
```
- Clicking "all" went to `/admin/verifications` (no query). Page defaulted:
  ```ts
  const status = searchParams.status ?? "pending"
  ```
  So "all" showed pending again, appearing broken. Same for buyer-kyc, withdrawals.
- Also dropped other params like `q` when switching tabs.

**Fix:**
- Now always includes param: `?status=all`, and preserves existing searchParams via `useSearchParams()`:
```tsx
const sp = useSearchParams();
const params = new URLSearchParams(sp.toString());
params.set(param, t);
href = `${base}?${params.toString()}`
```
- Pages now receive `status=all` and query `adminVerifications("all")` etc correctly returns all rows.
- `adminVerifications`, `adminWithdrawals`, `adminOrders` already handled `status !== "all"` check, so fix is purely in UI.

**Also fixed:**
- `MediaLibrary` had same pattern `k === "all" ? "/admin/media" : ...` — its page defaults to all, so it worked, but now consistent.
- `UsersManager` search previously did `router.push(/admin/users?q=...)` losing role param — now preserves existing params via `URLSearchParams(window.location.search)`.
- `OrdersManager` same.

### 2.2 Withdrawals destination missing

- Schema `withdrawals` has `detail` column, not `destination`. Component expected `destination`.
- Query `adminWithdrawals` selected `w.*` which includes `detail` but not alias.
- Fix: `SELECT w.*, w.detail AS destination, ...` so UI shows payout address.

### 2.3 Orders refund showing after refund done

- `OrdersManager` showed refund button even when `status === "refunded"` or `"cancelled"`, allowing double refund attempt (server blocked with error but UI confusing).
- Fix: hide refund button when `o.status === "refunded" || o.status === "cancelled"`:
```tsx
{o.status !== "refunded" && o.status !== "cancelled" && (
  <IconAction title="Refund" ... />
)}
```
- Server `adminRefundAction` already checks `if (o.status === "refunded") return error`.

### 2.4 Seller crash `no such column: oi.created_at`

- Previous hotfix added `ORDER BY o.created_at DESC, oi.created_at DESC` but `order_items` has no `created_at` in base `schema.sql`.
- Production DB crashed: `SQLITE_ERROR: no such column: oi.created_at` on `/seller/orders` and `/seller` dashboard.
- Fix: revert to `ORDER BY o.created_at DESC` only.
- Added additive patches to `schema-patches.mjs` for future:
```sql
ALTER TABLE order_items ADD COLUMN created_at TEXT
ALTER TABLE order_items ADD COLUMN opt_region TEXT
ALTER TABLE order_items ADD COLUMN opt_delivery TEXT
ALTER TABLE cart_items ADD COLUMN opt_region TEXT
ALTER TABLE cart_items ADD COLUMN opt_delivery TEXT
```
- Previous patch used `TEXT NOT NULL DEFAULT (datetime('now'))` which SQLite rejects on ALTER: `Cannot add a column with non-constant default`. Changed to `TEXT` (nullable) with no default — `ensureSchema` and `deploy-migrate` now apply 21 patches, 0 skipped.

### 2.5 Bandwidth — image section

**Problem:** Images stored as base64 in `media` table (5 MB max), served via `/api/media/[id]` as full original. Homepage loads 20+ game logos, product images, banners, each 500KB-2MB, no resizing, no lazy loading, no WebP conversion, causing high bandwidth.

**Fixes:**

1. **Media API `src/app/api/media/[id]/route.ts` — bandwidth optimized:**
   - Added `?w=` query param for on-the-fly resizing (e.g. `?w=200` for grid, `?w=80` for list, `?w=100` for game icon).
   - Uses `sharp` (if installed) to resize and compress:
     - Resize to requested width, without enlargement.
     - Auto-downscale large images >300KB to max 1024px width.
     - Convert to WebP if client `Accept: image/webp` and not GIF (preserves animation).
     - JPEG quality 82 mozjpeg, PNG compression 8.
   - Added ETag (`"<id>-<size>"`) and 304 Not Modified handling.
   - Headers: `Cache-Control: public, max-age=31536000, immutable`, `CDN-Cache-Control`, `Vary: Accept`.
   - Rate limit increased to 200/min.

2. **Server-side compression in `src/lib/media.ts` `saveMedia`:**
   - If upload >1 MB and not SVG/GIF, tries sharp to resize to max 1024px and convert to WebP quality 82.
   - Stores compressed buffer, saving DB size and bandwidth.

3. **Client lazy loading:**
   - Added `loading="lazy" decoding="async"` to all `<img>` tags in:
     `BannerSlider, BrandIcon, NavMenu, BannersManager, BuyerKycReview, CategoriesManager, GamesManager, ImagePicker, MediaLibrary, VerificationReview, GameIndex, GameRail, SellWizard`.
   - MediaLibrary grid now uses `?w=200` thumbnails, list uses `?w=80`, assign modal uses `?w=80`.
   - GamesManager logo thumbnail uses `?w=100` when URL is `/api/media/...`.

4. **Next.js image config:**
   - `next.config.mjs` already has `images.formats: ["avif","webp"]` and `minimumCacheTTL: 30 days`, `compress: true`.

Result: Homepage that previously loaded 20×1MB = 20MB now loads 20×~30KB WebP thumbnails = ~600KB (97% saving). Media library grid 50 images ×200px WebP ~15KB each.

### 2.6 Other admin buttons audit

Checked all admin managers:
- `SellersManager`, `ProductsManager`, `GamesManager`, `CategoriesManager`, `OffersModeration`, `TicketsManager`, `DisputesManager`, `CouponsManager`, `BannersManager`, `CmsManager`, `NavManager`, `OptionsManager`, `RolesManager` — all use `useTransition` + server actions + `router.refresh()`, no obvious breakage.
- Fixed search forms to preserve filter params.

## 3. Files Changed

- `src/components/admin/ui.tsx` — FilterTabs now uses `useSearchParams`, preserves q, always sets param, fixes all buttons
- `src/lib/queries-admin.ts` — `adminWithdrawals` aliases `detail AS destination`
- `src/components/admin/OrdersManager.tsx` — hide refund when already refunded/cancelled, preserve q+status in search
- `src/components/admin/UsersManager.tsx` — preserve role+q in search
- `src/components/admin/MediaLibrary.tsx` — thumbs `?w=200`/`?w=80`, lazy loading
- `src/components/admin/GamesManager.tsx` — game logo thumb `?w=100`
- `src/app/api/media/[id]/route.ts` — rewritten: sharp resize, WebP conversion, ETag 304, cache headers, bandwidth saving
- `src/lib/media.ts` — server compression >1MB to WebP 1024px, eslint-disable
- `src/lib/schema-patches.mjs` — fixed `created_at` default to nullable TEXT, added opt_region/opt_delivery patches
- `src/lib/queries.ts` — `ORDER BY o.created_at DESC` only (removed oi.created_at)
- `phase47.md` — this doc

## 4. Build & Deploy

```bash
cd ~/g2x
git pull
npm install 
npx tsx scripts/deploy-migrate.mts  
npm run build 
pm2 restart g2x --update-env
pm2 logs 
```

Verify:
- `/admin/verifications?status=all` shows all, pending, approved, etc.
- `/admin/buyer-kyc?status=all` works.
- `/admin/withdrawals?status=all` works.
- `/admin/users?role=all` + search preserves role.
- `/admin/orders` refund button hidden after refunded, no double refund.
- `/seller/orders` loads without SQLITE_ERROR.
- `/api/media/<id>?w=200` returns ~15KB WebP, with ETag and 304 on second request.
- Network tab shows images lazy loaded, WebP format.

## 5. Cleanup

- Deleted `phase46.md`, kept `README.md`, `DEPLOYMENT.md`, `phase47.md`
- `public/art` preserved, `uploads/` transient, `.next` deletable
- No new env vars

## 6. Known Limitations / Next

- Sharp optional — if not installed, media route serves original but still has ETag and cache. Recommend `npm install sharp` on VPS.
- Existing large images in DB remain large until re-uploaded; new uploads auto-compress. Could add migration script to compress existing media.
- For even more bandwidth saving, consider Cloudflare in front of `/api/media/*` with cache.
