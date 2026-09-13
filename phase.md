# Phase 27 — Game logo / product image flow + high-level security hardening

Build: `tsc --noEmit --skipLibCheck` passes, no new deps, no lag. Every fix verified against actual file flow: `ImagePicker` → `resolveImageField` → `saveMedia` (media table) → `/api/media/[id]` → displayed.

---

## 1. The bug you reported: game page showed coins.png instead of real images

**Root cause chain:**
- `saveGameAction` fell back to `/art/coins.png` when admin didn't upload a logo, and `accent` was used raw instead of validated `accentSafe` (hex check existed but result wasn't used).
- `saveProductAction` allowed products without an image, also fell back to coins.png. Homepage shows **game logo**, game page categories show **product image** (currency/top-up/item photo). When product image was missing, grid showed blank or generic coin.
- `CategoriesManager` had no image upload — only text icon field.
- `bulkAddProductsAction` inherited game logo but had no sanitization/rate-limit.
- Frontend was correct: `popularTiles`/`categoryBrands` use `g.logo` for homepage, `ProductCard` uses `p.image` for game page. The data was just wrong.

**Fix:**
- `saveGameAction`: Logo now **REQUIRED** for new games. Edit keeps existing logo via DB lookup. Validates via `sanitizeImageUrl` (blocks private IPs, localhost, javascript:, data:text/html). Accent validated `/^#[0-9a-fA-F]{3,8}$/` → `accentSafe` used in UPDATE/INSERT. Error message guides admin: "Upload an icon that will show on homepage and category pages... You can also add currency/top-up images when creating products".
- `saveProductAction`: Image now **REQUIRED** for new products. Chain: uploaded → existing (edit) → inherit game logo → placeholder only last resort. Error: "Product image is required! This image shows on game page categories... e.g., for 1000 V-Bucks, upload V-Bucks image". All fields sanitized with length caps (name 120, region 200, platform 100, instructions 1000), status whitelist `active|inactive`, price >0 && <100k, honeypot `_hp`/`website`, rate-limit `product.create`, XSS/SQLi check + `logSecurityEvent`.
- `bulkAddProductsAction`: Now sanitizes category `sanitizeSlug`, games `sanitizeSlug`, lines `sanitizeName(120)`, region/platform/deliveryTime `sanitizeName(100)`, rate-limit `product.bulk`.
- `saveCategoryAction`: Now supports `iconFile` upload via `resolveImageField` (kind `category_icon`), keeps existing on edit, sanitizes blurb 300 chars, status whitelist, rate-limit, XSS check.
- **Managers UI**:
  - `GamesManager.tsx`: Label "Game logo * (shows on homepage)" + hint "REQUIRED: Upload game logo... shows on homepage. You will add currency/top-up images when creating products"
  - `ProductsManager.tsx`: Label "Product image * (currency/top-up/item photo)" + hint about V-Bucks example
  - `CategoriesManager.tsx`: Added `ImagePicker` for icon, shows icon thumbnail in table, hint "Icon for this category (e.g., Top Up, Currency). Shows on category listings"

**Verified:** Homepage rail uses game logo, `/g/[game]` category blocks use product image, no more coins.png fallback for new content.

---

## 2. High-level security hardening — gaming ecommerce is heavily targeted

You asked for high security without lag/crash. All checks are sync or single SQLite query, no heavy deps.

### middleware.ts
- **BAD_PATH** expanded: `.htaccess`, `composer.json`, `.DS_Store`, `backup`, `.bak`, `.sql`, `adminer`, `pma`, `phpinfo.php`, `shell.php`, `c99.php`, `r57.php`, `wso.php`, `alfa.php`, `b374k`, `eval-stdin` etc
- **BAD_PATH_EXTRA**: `union select`, `or 1=1`, `drop table`, `<script`, `javascript:` in path
- **BAD_UA**: `sqlmap`, `nmap`, `nikto`, `dirbuster`, `gobuster`, `masscan`, `zap`, `burpsuite`, `acunetix`, `nessus`, `havij`, `wpscan`, `metasploit`, `hydra`, `shodan` → 403 on /admin, /api, login
- **Method validation**: only GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS → 405 otherwise
- **Edge rate-limit**: `/api/search` & `/api/auth` 30/60s, `/login` & `/register` 20/5min, in-memory with auto-cleanup (size >1000)
- **CSRF**: origin check against allowlist (host + NEXT_PUBLIC_APP_URL + localhost in dev), blocks `application/x-php`
- **Auth gate**: still verifies JWT signature/expiry at edge, drops stale cookie
- **Security headers** (new):
  - `X-XSS-Protection: 1; mode=block`
  - `X-Permitted-Cross-Domain-Policies: none`
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Cross-Origin-Embedder-Policy: credentialless`
  - `Cross-Origin-Resource-Policy: same-origin`
  - `Permissions-Policy: camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=(), clipboard-read=(), clipboard-write=(self), fullscreen=(self)`
  - Enhanced CSP: allows google fonts, exchangerate-api, media API, blocks `block-all-mixed-content` in prod
  - HSTS `max-age=63072000; includeSubDomains; preload` in prod
  - `Cache-Control: private, no-store` for /admin, /dashboard, /seller; `no-store` for /api
  - `x-request-id` tracing

### next.config.mjs
- Same security headers duplicated at config level so they survive even if middleware skipped
- `poweredByHeader: false` kept, compression on

### Session cookie
- `sameSite: strict` (was lax) → prevents CSRF carrying cookie cross-site, still allows top-level navigation
- `httpOnly: true`, `secure` in prod

### /api/media/[id]
- Rate-limit 100/60s per IP via `rateLimit(ip, "media_fetch", 100, 60)` → 429 with Retry-After
- ID format validation `/^[a-z0-9_-]{8,64}$/i` → 400 on traversal attempt
- `X-Content-Type-Options: nosniff` header

### /api/search
- Rate-limit 30/60s
- Query sanitized `sanitizeName(rawQ, 100)`, length check >100 returns empty, lowercased
- Prevents LIKE injection via sanitize

### Admin actions
- `saveGameAction`: rate-limit `game.create`, honeypot `_hp`/`website`, `containsXSS`/`containsSQLi` + `logSecurityEvent`, `sanitizeName(80)`, `sanitizeSlug`, `sanitizeImageUrl`
- `saveProductAction`: rate-limit `product.create`, honeypot, XSS/SQLi log, `sanitizeName` length caps, price cap, status whitelist
- `bulkAddProductsAction`: rate-limit `product.bulk`, sanitizeSlug/SanitizeName, inherit logo logic preserved
- `saveCategoryAction`: rate-limit `category.create`, icon upload, XSS check, status whitelist
- `saveBannerAction`: rate-limit `banner.create`, `sanitizeName(120)` title, 300 subtitle, bgColor hex/rgba validation, `sanitizeImageUrl` for image & ctaHref
- `saveCmsBlockAction`: rate-limit `cms.save`, `sanitizeSlug` key, sanitize title 200, subtitle 300, body 2000, cta 100/300, JSON data sanitized per item `sanitizeName(500)`, image via `sanitizeImageUrl`
- `saveTemplateFieldAction`: rate-limit, `sanitizeSlug` for id/category/fieldType, `sanitizeName(100)` label, options 1000
- Media lib already hardened: magic-byte verification (PNG 89 50 4E 47, JPEG FF D8 FF, WEBP RIFF, GIF GIF8, AVIF ftyp), SVG XSS blocklist (<script, javascript:, onload=, <foreignobject, eval(, <!ENTITY), filename traversal check, executable block (.php, .exe, .sh)

### Storage notes (you corrected me)
- `public/art` is **permanent** asset store (22 PNGs, 42M) — never delete, only `public/uploads` is transient. I deleted from art once by mistake, restored from your second batch, then deleted only uploads.
- `.next` is build artifact — safe to delete locally, rebuilt on VPS via `npm run build`

---

## Deploy — VPS steps

You are on `~/g2x` with pm2 named `g2x`. Same as Phase 26 but with extra security tables.

```bash
cd ~/g2x
git pull

# Clean build artifact (you said .next can be deleted locally, same on VPS)
rm -rf .next
# Ensure uploads transient folder is gone (art stays!)
rm -rf public/uploads
# If public/art missing, restore it — should have 22 files:
ls public/art | wc -l   # should be 22

# Install (no new deps, but safe)
npm ci

# Migrations — security_logs & ip_blocks tables auto-create on first logSecurityEvent/blockIp,
# but you can ensure schema:
npm run db:ensure

# Build (required — next.config.mjs and middleware.ts changed)
npm run build

# Restart
pm2 restart g2x
pm2 logs g2x --lines 100
```

**What to check after deploy:**
- Homepage: game logos load (not placeholder)
- `/g/valorant` etc: product tiles show specific product image (V-Bucks icon, etc) not coins.png
- Admin → Games → Add game: requires logo upload, error if missing
- Admin → Products → Add product: requires image, error if missing
- Admin → Categories: icon picker shows, upload works
- Security: try `curl -A sqlmap https://yourdomain/admin` → 403, `/api/media/../../etc/passwd` → 400, `/api/search?q=<script>` → sanitized empty
- Headers: `curl -I https://yourdomain/` should show `X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy`, `X-XSS-Protection`

> **No `sharp` install needed unless you want faster image optimization.** The security changes add zero lag — all checks are in-memory regex or single SQLite insert, rate-limit uses existing `ratelimit.ts` Map.

---

## Files changed this phase

- `src/lib/actions/admin.ts` — game/product/category/banner/cms/template hardening + required image flow
- `src/components/admin/GamesManager.tsx` — required label + hint
- `src/components/admin/ProductsManager.tsx` — required label + hint
- `src/components/admin/CategoriesManager.tsx` — ImagePicker for icon + thumbnail in table
- `src/middleware.ts` — BAD_UA, BAD_PATH_EXTRA, edge rate-limit, extra security headers, request-id
- `next.config.mjs` — mirrored security headers
- `src/lib/session.ts` — sameSite strict
- `src/app/api/media/[id]/route.ts` — rate-limit + ID validation + nosniff
- `src/app/api/search/route.ts` — rate-limit + sanitize + length cap
- `public/uploads` — deleted (transient), `public/art` kept (22 files)
- `.next` — cleaned
