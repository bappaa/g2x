# G2X.GG — Multi-Vendor Gaming Marketplace

Next.js 14 (App Router) · React 18 · TypeScript · Tailwind · Framer Motion · **Turso / libSQL** · JWT sessions · Server Actions.

Everything runs on a **real database** — no mock data, no localStorage. Buyers, sellers, orders, escrow,
disputes, messaging, payouts *and all site content* are persisted and editable from the admin panel.

---

# 🚀 What to do after `npm install`

Follow these five steps in order. Total time: about two minutes.

```bash
cd g2x
npm install                    # you have already done this
```

### Step 1 — create your environment file

```bash
cp .env.example .env.local
```

Then open `.env.local` and set **one required value**:

```bash
# Sign the session cookie — generate a fresh random string:
#   openssl rand -base64 48
AUTH_SECRET=paste-a-long-random-string-here
```

Everything else can stay blank for local development. Leave `TURSO_DATABASE_URL`
empty and the app automatically uses a local SQLite file at `./g2x.db` — no cloud
account needed to start.

> **Windows without `openssl`?** Any 32+ character random string works, e.g. run
> `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`.

### Step 2 — build the database

```bash
npm run db:setup
```

One command that runs all six seeders in the correct order. Expect roughly:

```
✓ demo accounts + offers seeded
✓ migration done — 63 applied
✓ 192 games, 815 products, 798 offers
✓ option lists — 93 created
✓ cms blocks — 15 created
✓ nav links — 22 created
```

<details>
<summary>What each step does (if you prefer to run them individually)</summary>

| Order | Command | Creates |
|---|---|---|
| 1 | `npm run db:seed` | Schema + demo buyer/seller/admin accounts + sample offers |
| 2 | `npm run db:migrate` | All later schema changes + the 5 admin roles |
| 3 | `npm run db:catalog` | The full client catalog — 192 games, 815 products |
| 4 | `npm run db:options` | 93 dropdown options (login/delivery/region/platform) |
| 5 | `npm run db:cms` | 15 homepage CMS blocks (hero, trust bar, section headings) |
| 6 | `npm run db:nav` | 22 footer links across 4 columns |

Every script is **idempotent** — re-running skips rows that already exist, so your
admin edits are never overwritten.
</details>

### Step 3 — start the app

```bash
npm run dev          # http://localhost:3000
```

### Step 4 — log in

| Role | Email | Password |
|---|---|---|
| **Admin** | `admin@g2x.gg` | `Password123!` |
| Seller | `seller@g2x.gg` | `Password123!` |
| Buyer | `buyer@g2x.gg` | `Password123!` |

Open **http://localhost:3000/admin** as the admin to reach the control panel.

### Step 5 — make it yours

The homepage contains **zero hardcoded content**. Everything below is editable in the
admin panel, and any section you empty simply disappears from the site:

| To change… | Go to |
|---|---|
| Headline, hero copy, perks, trust points | Admin → **CMS Blocks** |
| Hero slider & promo banners | Admin → **Banners** |
| Games, categories, products | Admin → **Games / Categories / Products** |
| Game icons (upload an image) | Admin → **Games** (edit) or **Media Library** |
| Product dropdowns (region, platform, login, delivery) | Admin → **Dropdown Options** |
| Footer link columns | Admin → **Navigation & Footer** |
| Site name, fees, SEO title/description | Admin → **Settings** |
| Delete all the demo/seed data | Admin → **Settings → Remove seeded content** |

---

## Going to production

**→ Quick client demo on Netlify: [NETLIFY.md](./NETLIFY.md)** (~15 min, needs Turso)
**→ Full production VPS guide: [DEPLOYMENT.md](./DEPLOYMENT.md)** (Contabo, PM2, Nginx, HTTPS)

That document covers Turso, Resend email, Google OAuth, DNS, a hardened Contabo
Ubuntu server, PM2, Nginx, free HTTPS, backups and a pre-launch checklist.

Quick version:

```bash
cp .env.example .env.local     # set AUTH_SECRET + NEXT_PUBLIC_APP_URL at minimum
npm run check:env              # verifies config + DB + mail; must report 0 errors
npm run build
npm start
```

### Use a cloud database (Turso)

```bash
turso db create g2x
turso db show g2x --url            # -> TURSO_DATABASE_URL
turso db tokens create g2x         # -> TURSO_AUTH_TOKEN
```

Put both in `.env.local`, then run `npm run db:setup` once to populate the cloud DB.
All scripts respect `TURSO_DATABASE_URL` and fall back to the local file when unset.
On an existing live database use `npm run db:content` instead — it refreshes catalog
and CMS content without touching users or orders.

### Turn on transactional email

Email is **inactive until you add a key** — until then messages are printed to the
server console, so nothing escapes during development.

1. Create an API key at **resend.com → API Keys**.
2. Add `RESEND_API_KEY=re_...` to `.env.local`.
3. Verify the `g2x.gg` domain in Resend (add the DKIM/SPF DNS records it gives you)
   so the 10 sender addresses can send. Until then, set `MAIL_DOMAIN` to a domain
   you have already verified.
4. Confirm delivery from **Admin → Settings → Transactional email → Send test
   email** — it reports the exact provider error when something is misconfigured.
5. Toggle individual email types in the same settings group.

### Turn on Google login

Create an OAuth client at **console.cloud.google.com → Credentials**, with the
authorised redirect URI `<NEXT_PUBLIC_APP_URL>/api/auth/google?callback=1`, then set
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `NEXT_PUBLIC_APP_URL`.
Without them the Google button signs in a demo account.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `npm error Missing script: "db:setup"` | Your copy is older than this README. Pull the latest files (or just run the six `db:*` commands from the table below in order). |
| `LibsqlError: SERVER_ERROR: Server returned HTTP status 404` | `TURSO_DATABASE_URL` still holds the example placeholder. The app now detects this and falls back to the local file automatically — if you see it, update your copy. To silence the warning, comment that line out in `.env.local`. |
| `Cannot find module` / `ERR_MODULE_NOT_FOUND` | Run `npm install` — `node_modules` is not committed. |
| `no such table: …` | You skipped a seeder. Run `npm run db:setup`. |
| Homepage looks empty | The CMS blocks are missing or disabled. Run `npm run db:content`, or re-enable them in Admin → CMS Blocks. |
| Emails are not arriving | `RESEND_API_KEY` is unset — check the server console; messages are logged there instead. |
| Admin pages redirect to login | Sign in as `admin@g2x.gg`, not the buyer or seller account. |
| Copy button does nothing | The Clipboard API needs HTTPS or `localhost` — the app falls back automatically, but a LAN IP like `192.168.x.x` will not work. |
| Want a clean slate | Delete `g2x.db*` and run `npm run db:setup` again. |

---

## Command reference

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server on :3000 |
| `npm run build` / `npm start` | Production build and serve |
| `npm run lint` | ESLint |
| `npm run db:setup` | **All seeders in order — use this for a new install** |
| `npm run db:content` | Re-seed content only (migrate + options + cms + nav) — safe on a live DB |
| `npm run db:push` | Schema only, no data |
| `npm run db:seed` | Schema + demo accounts + sample offers |
| `npm run db:migrate` | Apply schema migrations + admin roles |
| `npm run db:catalog` | Load the full 192-game client catalog |
| `npm run db:options` | Seed the product dropdown options |
| `npm run db:cms` | Seed the homepage CMS blocks |
| `npm run db:nav` | Seed the footer links |
| `npm run check:env` | **Pre-flight check** — verifies env vars, DB connection, tables, admin user and mail config |
| `npx tsc --noEmit` | Type-check without building |

---

## Environment variables

| Var | Required | Purpose |
|---|---|---|
| `AUTH_SECRET` | **Yes** | 32+ random chars — signs the JWT session cookie |
| `TURSO_DATABASE_URL` | No | libSQL URL. Falls back to `file:./g2x.db`. |
| `TURSO_AUTH_TOKEN` | Cloud only | Turso token |
| `NEXT_PUBLIC_APP_URL` | **In production** | Public origin, no trailing slash. Builds the Google redirect URI, email links, and the POST origin allowlist — a wrong value causes 403 on every form. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | No | Real Google login; without them a demo account is used |
| `RESEND_API_KEY` | No | Transactional email; without it mail is logged, not sent |
| `MAIL_DOMAIN` | No | Verified sending domain override, e.g. while `g2x.gg` is still pending in Resend |
| `KYC_STORAGE_DIR` | No | Where ID documents are written (defaults outside `public/`) |

---

## Architecture

```
src/lib/schema.sql        base libSQL schema
src/lib/migrations.sql    incremental migrations (idempotent)
src/lib/db.ts             Turso client — all / one / run / tx / nid
src/lib/session.ts        JWT cookie sessions (g2x_session), requireUser / requireSeller
src/lib/admin.ts          PERMISSIONS, requireAdmin(perm), DEFAULT_ROLES
src/lib/queries.ts        server-only read layer (buyer + seller)
src/lib/queries-admin.ts  admin read layer
src/lib/homepage.ts       CMS blocks, catalog tiles, live stats, footer nav
src/lib/mail.ts           Brevo transactional email — 10 department mailboxes
src/lib/media.ts          DB-backed image uploads (2 MB cap) + resolveImageField
src/lib/i18n.ts           11 languages, 10 currencies
src/lib/locale.ts         server-side locale + FX rates
src/lib/moderation.ts     chat scanning for off-platform contact attempts
src/lib/actions/*.ts      all Server Actions (auth, shop, seller, kyc, admin)
```

All writes go through **Server Actions** with server-side validation, ownership checks and
price/stock revalidation at checkout. Every admin write is recorded in `/admin/activity`.

---

## Marketplace model

Admin creates **Games → Categories → Products/Denominations → Service Templates (dynamic fields)**.
Sellers create **Offers** on those products (price, stock, delivery time/method, instructions).
Buyers see **every seller's offer side by side** and buy the best one. **Admin never sets price or stock.**

Accounts & Boosting use standalone seller **Listings** instead (own title, art, price).

### Money flow

1. Checkout charges **subtotal + 2% service fee**.
2. Each item snapshots the seller's **commission %** (default 8%) at purchase time.
3. `seller_net` moves into the seller's **pending (escrow) balance**; stock decrements atomically.
4. Buyer clicks **Confirm Receipt** → funds move to **available balance**.
5. Seller cancels → buyer refunded to wallet, stock restored, escrow reversed.
6. Withdrawals: min $10, max 3 pending.

Order lifecycle: `Pending Payment → Paid/Confirmed → Processing → Delivered → Completed`,
plus `Cancelled`, `Refunded`, `Disputed`. Codes: orders `G2X######`, disputes `DSP#####`, tickets `TCK#####`.

---

## Buyer side

| Route | Purpose |
|---|---|
| `/` | Homepage — fully CMS-driven, sticky promo marquee + navbar, animated hero |
| `/c/[category]` | Category hub: Top Up, Currency, Accounts, Items, Boosting, Subscriptions |
| `/g/[game]` | Game landing with all its categories |
| `/g/[game]/[category]/[slug]` | **Product page with multi-seller offer comparison** |
| `/cart`, `/checkout` | DB-backed cart, 2% fee, wallet/card/UPI/PayPal/crypto, escrow |
| `/support` | Help Center, FAQ, policies, real support tickets |
| `/login`, `/register` | Email + password and **direct Google login** |

**Buyer dashboard** (`/dashboard/*`): Overview · Orders (5-step timeline, reveal/copy delivered
credentials, confirm receipt, open dispute) · Purchased Products · Wallet · Transactions · Disputes ·
Reviews · Wishlist · Notifications · Messages · Profile · Security (2FA, session revoke) · Become a Seller.

---

## Seller panel — `/seller/*`

Dashboard KPIs · Offers (with live market-lowest hint) · Listings · Orders (deliver with custom
credential fields) · Reviews · Disputes · Finance (available vs escrow, withdrawals) · Store profile.

Access is gated: no seller profile, or not yet approved → redirected to *Become a Seller*.

---

## Admin panel — `/admin`

| Section | Routes |
|---|---|
| Dashboard | `/admin` |
| Catalog | `games`, `categories`, `templates`, **`options`** |
| Products & Offers | `products`, `offers`, `bulk`, `import` |
| Orders | `orders`, `order-status`, `delivery-logs` |
| Users & Sellers | `users`, `sellers`, `seller-requests`, `verifications`, `levels` |
| Finance | `payments`, `wallets`, `withdrawals`, `transactions`, `commission` |
| Disputes & Support | `disputes`, `tickets`, `messages` |
| Content | `promotions`, `announcements`, `cms`, **`banners`**, **`media`**, **`navigation`** |
| Reports | `reports/{sales,revenue,products,sellers,users}` |
| System | `roles`, `permissions`, `settings`, `activity` |

Roles: Super Admin, Support Staff, Seller Manager, Finance Manager, Content Manager.
Permissions are enforced server-side by `requireAdmin(perm)` — the sidebar only renders
sections the signed-in admin can access.

### Seller KYC
`/dashboard/become-seller` → multi-country ID type dropdown + document upload → stored outside
`public/`, served only through the authenticated `/api/kyc/[...key]` route → reviewed at
`/admin/verifications`. A seller cannot list until an admin approves.

### Chat monitoring
`src/lib/moderation.ts` scans every message for emails, phone numbers, social handles, external
links and off-platform payment wording. Score ≥ 3 notifies all admins. `/admin/messages` shows any
transcript plus a Clear / Warn / Ban queue. Every message box displays the "monitored by admin" notice.

---

## Language & currency

11 languages (EN, DE, ES, JP, FR, IT, ID, BR, NL, PL, TR) and 10 currencies
(USD, CAD, AUD, EUR, GBP, JPY, BRL, SGD, CHF, SEK), switchable from the header or footer
and applied site-wide.

Prices are **stored in USD** and converted at render time. Admins can override any FX rate
with a `fx_<CODE>` row in Settings. Admin and seller payout screens intentionally stay in USD.

---

## Transactional email

Ten department mailboxes, each wired to the events that belong to it:

| Mailbox | Sends |
|---|---|
| `no-reply@` | Welcome, OTP, password reset |
| `billing@` | Order confirmation, payout updates |
| `notification@` | Delivery notices |
| `seller@` | New sale alerts, KYC decisions |
| `refund@` | Refunds issued |
| `disputes@` | Dispute updates |
| `security@` | Suspensions, security alerts |
| `support@` | Ticket replies |
| `sales@` | Business enquiries |

---

## Notes

- Dark + light themes (hand-rolled toggle in the header, `darkMode: "class"`).
- Real brand marks via `simple-icons`, with custom SVGs for Xbox, Prime and Disney+.
  Generated key art lives in `public/art/` — **swap for licensed assets before launch**.
- Uploaded images are stored **in the database** (`media` table) and served from
  `/api/media/<id>` with immutable caching, so they survive redeploys.
- `g2x.db*` and `.env.local` are gitignored. `node_modules` is not committed.


## Security

Defence in depth, all enforced server-side — the client is never trusted.

| Layer | Where | What it does |
|---|---|---|
| CSRF / origin pinning | `src/middleware.ts` | Every POST must carry an `Origin` matching the host or `NEXT_PUBLIC_APP_URL`. Missing or foreign origins get a 403 before any code runs. |
| CSP + security headers | `src/middleware.ts` | `frame-ancestors 'none'`, `object-src 'none'`, `form-action 'self'`, HSTS preload, `X-Frame-Options`, `nosniff`, restrictive Permissions-Policy. |
| Exploit-path blocking | `src/middleware.ts` | 404s probes for `.env`, `.git`, `.ssh`, `wp-admin`, `phpmyadmin`, `xmlrpc.php`, … |
| Auth pre-gate | `src/middleware.ts` | `/admin`, `/dashboard`, `/seller` redirect to login without a session cookie, and are marked `no-store` so no proxy caches them. |
| Rate limiting | `src/lib/ratelimit.ts` | Durable SQLite counters (survive cold starts). Login 20/15min per IP **and** 6/15min per account; register 5/hr per IP; checkout 12/hr; top-up 10/hr; KYC submit 5/hr. |
| Password policy | `src/lib/actions/auth.ts` | 8+ chars, 3 of 4 character classes, rejects common passwords and anything containing the user's name or email. bcrypt cost 12. |
| Open-redirect guard | `src/lib/actions/auth.ts` | `?next=` must be a same-site path — `//evil.com` and backslash tricks are dropped. |
| SQL injection | `src/lib/db.ts` | Every query is parameterised; no string interpolation of user input anywhere. |
| Private KYC documents | `src/lib/storage.ts`, `/api/kyc/[...key]` | Stored outside `/public`. The key must match a real verification row and the requester must be the owner or an admin. Strict regex blocks path traversal. `Cache-Control: private, no-store`. |
| Money integrity | `src/lib/actions/shop.ts` | Prices, stock, gateway fees and KYC gates are all re-resolved on the server; a tampered client payload cannot change what is charged. |
| Audit trail | `audit_logs` | Every admin write records who did what, to which record, with a JSON diff. |

Set a strong `AUTH_SECRET` (32+ random chars) in production — the app refuses to boot with a weak one.

## Buyer identity verification (KYC)

Buyers transacting at or above a threshold (default **$30**, `Settings → Trust & Safety → Identity check threshold`) must pass a one-time check before they can deposit or check out.

- Buyer submits at `/dashboard/verification`: full name, country, ID type, ID number, a photo of the ID and a face photo.
- Admin reviews at `/admin/buyer-kyc` — approve, reject, or ask for a resubmission, each with a note.
- Both parties are emailed at every step; `security@g2x.gg` is notified of new submissions.
- The gate is enforced inside `placeOrderAction` and `topUpWalletAction`, not just in the UI.
- Turn the whole thing off with `Settings → Require buyer identity check = off`.
