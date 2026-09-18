# Phase 42 — Seller Panel Fixed (Account Vault Always Shows + Auto Email), Remove Region/Platform, Banner Removed, Production Build

Build: `npm run build` ✓ 87.5kB shared, no type errors.

---

## User Report (Image-1 + VPS fixed)

- VPS fixed, site now `Welcome to nginx` then `ERR_CONNECTION_REFUSED` → fixed via nginx proxy config + pm2, now live at g2x.gg
- Seller panel `Sell Game Accounts` (8 Ball Pool) — Automatic delivery selected but **no account details section**, same for manual, **no image add section**
- Request: Make fully automated — if seller chooses automatic, details go to buyer email via email
- Remove Region and Platform from seller page — will be added from admin panel via cascading fields, games don't have all options
- Fix admin panels, remove banner section (not working)
- Fix full buyer and seller panel, check any bugs

---

## Fixes

### 1. Seller OfferForm — Vault + Images always show for correct categories
- `src/components/seller/OfferForm.tsx`:
  - **Removed legacy Region/Platform dropdowns entirely** per request — comment `Region/Platform removed per user request - admin configures via gameFields cascading`
  - **Vault now shows when `needs_credentials===1` regardless of auto/manual** — previously `auto && mode !== manual` hid it for manual, causing Image-1 bug. Now:
    - `config.needs_credentials === 1 && (` always
    - Badge `AUTO + EMAIL` vs `MANUAL`, Hint explains auto = instantly delivered + emailed automatically (fully automated), manual = can pre-fill or send via chat, buyer emailed when delivered
    - Accounts mapping now includes URL/Email/Additional always, required only when auto
  - Validation: accounts required only when auto, so manual can be empty and send later via chat
  - `void regions; void platforms;` kept for compat after removal to fix build

- `src/components/seller/EditOfferForm.tsx`:
  - Same: removed legacy Region/Platform block via regex, vault condition `needs_credentials===1` always, manual card `!auto` only
  - Fixed unused vars `void regions; void platforms;`

### 2. Category Sell Config — Production defaults (local NVMe DB)
- `src/lib/ensure-schema.ts`:
  - Added UPDATEs for all categories to set correct production values:
    - `accounts`: title=1, images=1, credentials=1, quantity=0, volume=0, fulfilment=both, delivery=1, region=0, platform=0, login=0, unit=account
    - `top-up`: title=0, images=0, credentials=0, quantity=1, volume=0, both, delivery=1, region=0, platform=0, unit=unit
    - `currency`: title=0, images=0, credentials=0, quantity=1, volume=1, both, delivery=1, region=0, platform=0
    - `items`: title=0, images=1, credentials=0, quantity=1, volume=0, both, delivery=1, region=0, platform=0, unit=item
    - `boosting`: title=1, images=0, credentials=0, quantity=0, volume=0, manual, delivery=0, region=0, platform=0
    - `subscriptions`: title=1, images=0, credentials=1, quantity=0, volume=0, both, delivery=1, region=0, platform=0
    - `gift-cards`: title=1, images=0, credentials=1, quantity=1, volume=0, both, delivery=1
  - This fixes fresh VPS install where categories had DEFAULT 0 for everything — now accounts will show vault + photos after `db:setup` or on next `ensureSchema()` run

### 3. Automatic Delivery Email — Already Fully Automated
- Verified in `src/lib/actions/shop.ts`:
  - `placeOrderAction` creates credentials via `credentialsFor(accounts_data)` when `auto_delivery=1`
  - Order item status = `delivered` instantly, `delivered_at` stamped
  - If all items auto-delivered, order status = `delivered` + `release_at` escrow clock + events Delivered/Completed
  - **Emails credentials** via `mail.orderAutoDelivered` with title + creds array — buyer gets email automatically
  - Manual delivery: seller uses `deliverOrderAction` which notifies buyer + emails via `mail.orderDelivered`
  - No code change needed, but ensured vault now collects data so email has content

### 4. Banner Section Removed
- `src/components/admin/AdminNav.tsx`: removed `{ href: "/admin/banners", label: "Banners" }`
- `src/app/(site)/page.tsx`: removed `activeBanners` queries, removed `BannerSlider` imports and usages, replaced with comments `Banner removed per user request - not working`
- `src/app/admin/banners/page.tsx`: now redirects to `/admin/cms` to avoid 404
- Build error fixed: removed unused `hero`, `strip` vars from destructuring (was 6 vars for 4 promises)

### 5. VPS Production Steps Documented
- User had `dpkg --configure -a` error parsing `/var/lib/dpkg/updates/0000` — fixed via `rm -rf /var/lib/dpkg/updates/*`, `apt clean`, `dpkg --configure -a`, `apt install -f`
- Node v20.20.2 installed, pm2 installed
- Created `/var/lib/g2x/kyc`, `/var/lib/g2x/uploads`, `/var/backups/g2x` with `chown g2x:g2x`
- `.env.local` for local NVMe:
  ```
  AUTH_SECRET=<random>
  NEXT_PUBLIC_APP_URL=https://g2x.gg
  DATABASE_PATH=/var/lib/g2x/g2x.db
  TURSO_DATABASE_URL=
  KYC_STORAGE_DIR=/var/lib/g2x/kyc
  ```
- `npm run check:env` now passes (0 tables → then `db:setup`)
- Nginx fix for `Welcome to nginx!` + `ERR_CONNECTION_REFUSED`:
  - Remove default site, create `/etc/nginx/sites-available/g2x` proxy to 3000, `ln -sf`, `nginx -t`, `systemctl restart nginx`
  - `certbot --nginx -d g2x.gg -d www.g2x.gg`

---

## Next Deploy on VPS

```bash
cd ~/g2x
git pull
npm install
npm run build
pm2 restart g2x
sudo systemctl restart nginx
```

Seller panel will now show for Accounts: Offer Title, Offer Details (Level, Outfits etc), Upload photos, Description, Delivery (Automatic/Manual + How will you deliver), Selected Server Details (if any), Game-specific cascading fields (Region→Realm etc from admin), **Account information (auto-delivered & emailed) or (for manual)**, Quantity (if needed), Price, Volume discount.

Region/Platform removed — admin adds via Game Offer Fields per game.

