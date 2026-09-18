# Phase 45 — Message Badges Fixed + Fully Automated Razorpay Payments

Build: `npx next build` ✓ 87.5kB shared — ESLint clean

## 1. User Requests

**A. Message notification badge missing**
- Screenshot: thread list shows red `1` unread on conversation, but sidebar `Messages` (buyer `/dashboard/messages` and seller `/seller/messages`) shows no badge, and navbar message icon (Header) shows no badge.
- Expected: when a new message arrives, show unread count on:
  - Navbar message icon (Header.tsx) — red badge like bell
  - Buyer sidebar DashboardNav → Messages
  - Seller sidebar SellerNav → Messages
  - Thread list per-conversation badge (already worked)

**B. Payment system fully automated with Razorpay**
- User has Razorpay key, wants end-to-end wiring: checkout + wallet top-up + webhook + admin gateway config.
- Previous system was demo/simulated — `placeOrderAction` and `topUpWalletAction` instantly credited without external verification.
- New: real Razorpay Checkout (client script), server order creation, HMAC signature verification, webhook for reliability, admin UI to configure keys, escrow hold after verified payment, emails, KYC post-payment.

## 2. Message Badge Fix — Root Cause & Solution

### Root Cause
- `SiteShell.tsx` only fetched notification unread:
  ```sql
  SELECT COUNT(*) FROM notifications WHERE user_id=? AND read_flag=0
  ```
  Passed as `unread` to `Header.tsx` which only badges bell.
- `DashboardNav.tsx` groups defined badge only on Notifications (`badge:true`), `unread` prop was notification count, Messages had no badge logic.
- `SellerNav.tsx` badge only for Orders (`toDeliver`), Messages no badge.
- `queries.ts` `getThreads` computes per-thread unread via `(SELECT COUNT(*) FROM messages m WHERE m.thread_id=t.id AND m.read_flag=0 AND m.sender_id<>?) AS unread` but no total unread helper. `getUnreadCount` only counted notifications.
- `src/app/(site)/dashboard/layout.tsx` called `getUnreadCount(u.id)` for sidebar — only notifications.
- `sendMessageAction` sent email but no in-app notification, so bell also didn't show message.

### Fix

**`src/lib/queries.ts` — new helpers**
```ts
export const getMessageUnreadCount = async (userId: string) => {
  const r = await one<{ n: number }>(
    `SELECT COUNT(*) AS n FROM messages m
       JOIN threads t ON t.id=m.thread_id
      WHERE (t.buyer_id=? OR t.seller_id=?) AND m.sender_id<>? AND m.read_flag=0`,
    [userId, userId, userId]
  );
  return Number(r?.n ?? 0);
};
export const getCombinedUnread = async (userId: string) => {
  const [notif, msg] = await Promise.all([getUnreadCount(userId), getMessageUnreadCount(userId)]);
  return { notif, msg, total: notif + msg };
};
```

**`src/components/SiteShell.tsx`**
- Now fetches both counts in parallel:
  ```ts
  mr = one<{n}>(`SELECT COUNT(*) ... messages ... WHERE (buyer_id=? OR seller_id=?) AND sender_id<>? AND read_flag=0`, [u.id, u.id, u.id])
  ```
- Passes `msgUnread` to Header.

**`src/components/Header.tsx`**
- Props: `msgUnread?: number`
- Message icon now:
  ```tsx
  {msgUnread > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">{msgUnread > 99 ? "99+" : msgUnread}</span>}
  ```

**`src/components/dash/DashboardNav.tsx`**
- Groups now: `{ href: "/dashboard/messages", badge: "msg" }` and `badge: "notif"` for notifications.
- Props: `msgUnread?: number`
- Badge logic:
  ```ts
  const badgeVal = badge === "msg" ? msgUnread : badge === "notif" ? unread : 0;
  ```
- Renders red badge on both Messages and Notifications.

**`src/app/(site)/dashboard/layout.tsx`**
- Fetches both:
  ```ts
  const [stats, unread, msgUnread] = await Promise.all([one(...), getUnreadCount(u.id), getMessageUnreadCount(u.id)]);
  ```
- Passes to DashboardNav.

**`src/app/(site)/seller/layout.tsx` + `SellerNav.tsx`**
- Seller layout fetches `msgUnread` via `getMessageUnreadCount`.
- SellerNav prop `msgUnread`, badge logic for Messages (rose) vs Orders (amber).

**`src/lib/actions/shop.ts`**
- `sendMessageAction` now creates in-app notification for other participant:
  ```ts
  await notify(otherId, `New message from ${u.name}`, body.slice(0,120), `/seller/messages?t=${threadId}` or `/dashboard/messages?t=${threadId}`, "message");
  ```
- `sendAttachmentAction` same — notifies for image.

Result: new message → thread unread increments → `getMessageUnreadCount` >0 → SiteShell + dashboard layout + seller layout propagate → navbar icon shows red badge, sidebar Messages shows red badge, thread list shows per-thread badge. Opening thread calls `markThreadReadAction` which sets `read_flag=1` → counts drop.

## 3. Razorpay Fully Automated

### Architecture

**Credentials — two sources (priority: DB > env)**
- Admin → Payment Gateways → Razorpay: fields Key ID, Key Secret, Webhook Secret, Currency (INR/USD) stored as JSON in new column `payment_gateways.config` (fallback: parse from note `<!--rzp:{json}-->` for old DB).
- Env fallback: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_CURRENCY`.

**New lib `src/lib/razorpay.ts`**
- `getRazorpayConfig()` — reads DB row `code='razorpay'` config JSON + env.
- `createRazorpayOrder({ amount, currency, receipt, notes })` — POST `https://api.razorpay.com/v1/orders` with Basic auth, amount in paise (amount*100), returns `{ id, amount, currency }`.
- `verifyPaymentSignature({ order_id, payment_id, signature, secret })` — HMAC SHA256 of `order_id|payment_id`.
- `verifyWebhookSignature({ body, signature, secret })` — HMAC SHA256 of raw body.
- `fetchRazorpayPayment(paymentId)` — for manual verification.

**Schema patches `src/lib/schema-patches.mjs`**
```sql
ALTER TABLE payment_gateways ADD COLUMN config TEXT;
ALTER TABLE orders ADD COLUMN razorpay_order_id TEXT;
ALTER TABLE orders ADD COLUMN razorpay_payment_id TEXT;
ALTER TABLE orders ADD COLUMN razorpay_signature TEXT;
ALTER TABLE transactions ADD COLUMN razorpay_order_id TEXT;
ALTER TABLE transactions ADD COLUMN razorpay_payment_id TEXT;
CREATE TABLE razorpay_intents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  razorpay_order_id TEXT NOT NULL UNIQUE,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  purpose TEXT NOT NULL DEFAULT 'checkout',
  status TEXT NOT NULL DEFAULT 'created',
  gateway_code TEXT NOT NULL DEFAULT 'razorpay',
  meta TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  verified_at TEXT
);
```

**API Routes**

1. `POST /api/payments/razorpay/create-order`
   - Auth: session user.
   - Body: `{ purpose: 'checkout'|'topup', gateway_code, amount?, uid?, note? }`
   - For topup: validates amount 1-5000, computes fee via `feeFor`, total = raw+fee.
   - For checkout: loads cart server-side via `getCart(u.id)`, computes subtotal + 2% service fee + gateway fee (same as placeOrderAction), ignores client total.
   - Calls `createRazorpayOrder`, stores intent in `razorpay_intents` with meta `{ uid, note, subtotal, ... }`.
   - Returns `{ razorpayOrderId, amount, currency, keyId, intentId }`.

2. `POST /api/payments/razorpay/verify`
   - Body: `{ razorpay_order_id, razorpay_payment_id, razorpay_signature, uid, note, idemKey }`
   - Verifies HMAC signature using secret from `getRazorpayConfig`.
   - Looks up intent, checks `user_id` ownership, idempotency (`status='verified'` returns existing order code).
   - **Topup branch**: credits wallet via `transactions` INSERT with `idem_key = topup:user:payment_id` UNIQUE (prevents double credit), `UPDATE users SET balance`, sends `mail.walletTopUp`, handles KYC `kycDueFor`/`markKycDue`, returns `verifyAfter` if needed.
   - **Checkout branch**: validates cart not empty, `uid` required, stock checks, self-buy block, computes totals server-side, creates order via `tx`:
     - `INSERT orders` with `payment_status='paid'`, `gateway_code='razorpay'`, `razorpay_order_id/payment_id/signature`
     - For each cart item: commission calc, auto_delivery credentials handling (same as existing `credentialsFor`), `INSERT order_items`, stock decrement, `pending_bal` increment.
     - `order_events`, `DELETE cart_items`
     - Update intent status to `verified`
     - If auto-delivered (all items delivered): set `status='delivered'`, `release_at = now + escrowHoldHours()`, events Delivered/Completed, `scheduleSubscriptions`, email credentials via `mail.orderAutoDelivered`.
     - Notifications to buyer and sellers, `mail.orderConfirmed`, `mail.newSale`, `mail.actionRequired`
     - KYC post-payment: `markKycDue` if `kycDueFor(total)` true, returns `verifyAfter`
   - Revalidates paths.

3. `POST /api/payments/razorpay/webhook`
   - Raw body text, header `x-razorpay-signature`
   - Verifies using webhook secret (or key secret fallback) via `verifyWebhookSignature`
   - Handles `payment.captured`, `order.paid`: marks `razorpay_intents` status `captured`, updates `orders` and `transactions` with payment_id if missing, ensures `payment_status='paid'`.

**Client Integration**

`src/components/shop/CheckoutView.tsx`
- Detects Razorpay: `method.toLowerCase().includes('razorpay')`
- Preloads script `https://checkout.razorpay.com/v1/checkout.js` via `loadRazorpay()`.
- On Pay click if Razorpay:
  1. POST create-order with `purpose: checkout, gateway_code: method, uid, note`
  2. Open Razorpay modal: `{ key, amount*100, currency, name: G2X.GG, order_id, prefill: { email }, theme: { color: "#8b3dff" }, handler: verify, modal: { ondismiss } }`
  3. Handler POSTs to `/api/payments/razorpay/verify` with Razorpay response + uid/note.
  4. On success redirects to `/dashboard/orders/[code]` or verification if `verifyAfter`.
  5. `payment.failed` shows error.

`src/components/dash/WalletView.tsx`
- Same pattern for top-up:
  - Preset amounts + custom input, gateway selector includes Razorpay.
  - If Razorpay selected, create-order with `purpose: topup, amount: amt`
  - Checkout modal, handler verifies via `/api/payments/razorpay/verify` with `idemKey` for idempotency.
  - Shows "Funds added!" and refreshes.

**Admin UI `src/components/admin/GatewaysManager.tsx`**
- Parses config from `config` column or `<!--rzp:...-->` in note.
- Card shows "configured ✓" if key_id present, else "missing keys".
- Form: when code == `razorpay`, shows extra section:
  - Key ID, Key Secret (password), Webhook Secret, Currency select INR/USD
  - Hint with webhook URL `/api/payments/razorpay/webhook` and events.
- `saveGatewayAction` now accepts `rzpKeyId`, `rzpKeySecret`, `rzpWebhookSecret`, `rzpCurrency`, stores JSON in `config` column (fallback to note comment if column missing).

**Seed `scripts/seed-gateways.mts`**
- Adds Razorpay row: `code: razorpay, name: Razorpay, logo: razorpay, pct: 2.0, topup:1, checkout:1, note: UPI, Cards, NetBanking, Wallets`
- Ensures existing install gets enabled.

**Security & Idempotency**
- Server computes totals, never trusts client amount.
- HMAC verification for both client callback and webhook.
- `razorpay_intents` UNIQUE on `razorpay_order_id` prevents reuse.
- Wallet top-up uses `transactions.idem_key = topup:user:payment_id` UNIQUE — double verification returns `already:true`.
- Checkout uses same cart validation as before (stock, self-buy, email verified).
- `placeOrderAction` and `topUpWalletAction` now reject `code === razorpay` with message to use secure checkout, preventing bypass.
- Webhook provides reliability if client disconnects after payment but before verify — marks order as paid.

**Emails & KYC**
- Same as existing flow: `orderConfirmed`, `newSale`, `actionRequired`, `orderAutoDelivered` for automatic accounts/gift-cards.
- KYC threshold check is post-payment (same as before) — `kycDueFor(total)` → `markKycDue` → `verifyAfter` → redirect to verification.

## 4. Files Changed / Added

- `src/lib/queries.ts` — added `getMessageUnreadCount`, `getCombinedUnread`
- `src/components/SiteShell.tsx` — fetch msg unread, pass to Header
- `src/components/Header.tsx` — `msgUnread` prop, badge on message icon
- `src/components/dash/DashboardNav.tsx` — `msgUnread` prop, badge on Messages + Notifications
- `src/app/(site)/dashboard/layout.tsx` — fetch msg unread
- `src/app/(site)/seller/layout.tsx` — fetch msg unread
- `src/components/seller/SellerNav.tsx` — `msgUnread` prop, rose badge on Messages
- `src/lib/actions/shop.ts` — notify other side on message + attachment (fixes missing notification)
- `src/lib/schema-patches.mjs` — Phase45 patches: config column, razorpay columns, razorpay_intents table
- `src/lib/razorpay.ts` — new, server wrapper
- `src/app/api/payments/razorpay/create-order/route.ts` — new
- `src/app/api/payments/razorpay/verify/route.ts` — new
- `src/app/api/payments/razorpay/webhook/route.ts` — new
- `src/components/shop/CheckoutView.tsx` — Razorpay checkout flow, script loader, verify
- `src/components/dash/WalletView.tsx` — Razorpay top-up flow
- `src/components/admin/GatewaysManager.tsx` — Razorpay config UI, parseConfig
- `src/lib/actions/admin.ts` — saveGatewayAction handles Razorpay config JSON in config column
- `scripts/seed-gateways.mts` — add razorpay gateway

## 5. How to Configure Razorpay (Admin)

1. Razorpay Dashboard → Settings → API Keys → Generate Test/Live keys → copy Key ID (`rzp_test_...`) and Key Secret.
2. G2X Admin → Payment Gateways → Edit Razorpay (or Add gateway code `razorpay`) → paste Key ID, Key Secret, Webhook Secret (from Webhooks page), Currency INR, enable for Top-up and Checkout, Save.
3. Razorpay Dashboard → Settings → Webhooks → Add webhook: URL `https://yourdomain.com/api/payments/razorpay/webhook`, Secret same as above, Events `payment.captured`, `order.paid`, Active.
4. Env fallback (VPS): `.env.local`:
   ```
   RAZORPAY_KEY_ID=rzp_test_...
   RAZORPAY_KEY_SECRET=...
   RAZORPAY_WEBHOOK_SECRET=...
   RAZORPAY_CURRENCY=INR
   ```
5. Test: buyer checkout select Razorpay → Pay → Razorpay modal (UPI/Card) → success → order appears in `/dashboard/orders/[code]` with status processing/delivered, seller notified, email sent. Wallet top-up same.

## 6. Cleanup

- Deleted `phase44.md`, kept only `README.md`, `DEPLOYMENT.md`, `phase45.md`
- `uploads/` transient — none present, `public/art` preserved (22 PNGs)
- `.next` build artifact — 87.5kB shared

## 7. Deploy

```bash
cd ~/g2x
git pull
npm install
npx tsx scripts/deploy-migrate.mts  # applies Phase45 patches
npx tsx scripts/seed-gateways.mts    # ensures razorpay row
npm run build
pm2 restart g2x
```

Verify: `/admin/gateways` shows Razorpay configured, `/checkout` with Razorpay selected opens modal, `/dashboard/wallet` top-up via Razorpay credits instantly after verification, message badges appear on navbar and sidebars when new message arrives.

## 8. Known Limitations / Next

- Currency: Razorpay primarily INR; USD works only if international payments enabled on Razorpay account. Config allows switching.
- Amount conversion: currently 1 USD = 1 INR unit for demo; for production add FX conversion (USD→INR) using `getRates()`.
- Webhook secret optional — if not set, falls back to key secret (not recommended for prod).
- No subscription recurring via Razorpay yet — uses escrow schedule same as before.

## 9. Hotfix — CSP blocking Razorpay (Image-1 bug)

**Error from console:**
```
Loading the script 'https://checkout.razorpay.com/v1/checkout.js' violates CSP directive: "script-src 'self' 'unsafe-inline' https://www.google.com https://www.gstatic.com"
```
Page showed "Failed to load Razorpay" and Pay button did nothing.

**Root cause:** `src/middleware.ts` set strict CSP:
```
script-src 'self' 'unsafe-inline' https://www.google.com https://www.gstatic.com
connect-src 'self' https://api.exchangerate-api.com https://api.frankfurter.app
```
No Razorpay domains allowed, so browser blocked `checkout.js`. Also missing `frame-src` for Razorpay modal iframe, and `Permissions-Policy payment=()` disabled Payment Request API.

**Fix in `src/middleware.ts`:**
```ts
const razorpayScript = "https://checkout.razorpay.com https://api.razorpay.com";
const razorpayConnect = "https://api.razorpay.com https://checkout.razorpay.com https://lumberjack.razorpay.com https://lumberjack-cx.razorpay.com";
const razorpayFrame = "https://api.razorpay.com https://checkout.razorpay.com";

script-src ... ${razorpayScript}
connect-src ... ${razorpayConnect}
frame-src 'self' https://www.google.com https://www.gstatic.com ${razorpayFrame}
Permissions-Policy payment=(self "https://checkout.razorpay.com")
```
Also added better error message when script fails to load.

**Other bugfixes in same hotfix:**
- Wallet preset buttons showed hardcoded `$10` while balance is in ₹ (INR) via `money()` — now shows `money(a)` so $10 becomes ₹959 etc matching breakdown.
- `create-order` API now converts USD → charge currency using live FX rate from `settings fx_*` (fallback to CURRENCIES table). Previously charged $10 as ₹10 — now charges ₹959 for $10 when INR rate 95.9.
- `verify` route USD mismatch check fixed to compare `meta.usd` not `intent.amount` (which is now INR charge amount).
- Improved Razorpay load error UI: tells user to disable ad-blocker and check CSP.

Build: still 87.5kB, passing.
