# Phase 28 — Separate seller/buyer messaging, no duplicate chats, copy order ID, account page fixes, category-aware checkout, contact links, OfferForm email removal

Build: fixed 2 ESLint `react/no-unescaped-entities` errors that blocked `npm run build`. All other changes are additive, no lag.

---

## 1. Build failed fix (your log)

```
./src/app/(site)/dashboard/verification/page.tsx 37:58 Error: `'` can be escaped...
./src/components/seller/SellerOrders.tsx 141:106 Error: `'` can be escaped...
```

- `verification/page.tsx`: `You're verified` → `You are verified` (JSX text node)
- `SellerOrders.tsx`: `you don't get confused` → `you do not get confused`

Other apostrophes in `BuyerKyc.tsx` and `OfferForm.tsx` are inside JS strings (`"..."`) not JSX text, so ESLint does not error.

---

## 2. Seller vs Buyer message sections separated (confusion fix)

**Bug:** `MessagesView.tsx` hardcoded `router.push("/dashboard/messages?...")` for thread list and back button. When seller clicked a thread in `/seller/messages`, it navigated to buyer panel `/dashboard/messages`.

**Fix:**
- Added `basePath = isSeller ? "/seller/messages" : "/dashboard/messages"` in `MessagesView.tsx`
- Both `onClick={() => router.push(basePath)}` and `onClick={() => router.push(`${basePath}?t=${id}`)}` now respect `isSeller`
- Seller page `src/app/(site)/seller/messages/page.tsx` passes `isSeller={true}`, buyer pages pass false (default)

Result: seller stays in seller panel, buyer stays in buyer panel. Threads are shared in DB but UI routes are separate.

---

## 3. No duplicate chats for same product

**Bug:** Every time buyer opened order and tapped "Open chat", a new thread was created for same product. Root cause: buyer `OrderDetail.tsx` passed `order.code` (e.g. ORD-123) as `orderId` to `startThreadAction`, while seller side stored `orders.id` (uuid). `COALESCE(order_id,'') = ?` never matched, so new row each time. Also `sellerMessageBuyerAction` and `sellerOrderMessageAction` created per-order threads.

**Fix:**
- `OrderDetail.tsx`: added `id` to `Order` type, now passes `order.id` (uuid) to `startThreadAction`. `MessageBox` now takes `orderId` + `orderCode`, uses `orderId` for thread lookup, `orderCode` only for display `[Order CODE]`.
- `src/lib/actions/shop.ts` `startThreadAction`: now tries exact `order_id` match first, then falls back to most recent thread for same `buyer_id + seller_id` regardless of `order_id` — reuses same chat for same product/buyer pair. If fallback thread has no `order_id`, it attaches the new one via `COALESCE`.
- `seller.ts` `sellerMessageBuyerAction` and `sellerOrderMessageAction`: same fallback logic — exact order match first, then any thread for same buyer+seller, prevents duplicate chats.

Now same buyer+seller pair always reuses same thread, order code is still prefixed in message body for context.

---

## 4. Copy button for Order ID

- **Buyer** `OrderDetail.tsx`: added button `Copy ID` next to Order CODE header, `navigator.clipboard.writeText(order.code)`
- **Seller** `SellerOrders.tsx`: replaced simple `Info l="Order ID"` with custom div showing code + `Copy` button (brand-600). Both use same clipboard API.

---

## 5. Account page fixes (image-1, image-2)

**image-1 — listing card:** `src/components/browse/ListingGrid.tsx` had `Level {a.level} | {a.outfits} Outfits` line. Removed per request.

**image-2 — product detail:** `ListingDetail.tsx` had:
- Tags `Level X` and `Y Outfits` — removed
- Hardcoded `What's included` list with `Original email + password`, `${outfits} outfits & skins`, etc. — seller never added those. Replaced with dynamic `Details` section:
  - Parses `listing.custom_fields` JSON (if present) and shows key: value rows
  - If no custom fields, shows generic safe list: verified account, instant delivery, buyer protection, full access, warranty (for accounts) or pro boosters, safe service (for boosting)
- Description still shown if present.

---

## 6. Checkout fix (image-3) — category-aware delivery

**Bug:** Checkout always asked for `In-game UID / Login ID` even for accounts, where no ID is needed — seller delivers account credentials.

**Fix:**
- `src/lib/queries.ts` `getCart`: now selects `p.category_slug AS category_slug` and `l.category_slug AS category_slug` in both UNION parts, and return type includes `category_slug`
- `CartView.tsx` `CartRow` type extended with `category_slug?`
- `CheckoutView.tsx`:
  - Computes `cats = items.map(i => category_slug)`
  - `needsGameId = cats.some(c => ["currency","top-up","topup","items","boosting"].includes(c))`
  - `isAccountOnly = cats.every(c => ["accounts","gift-cards","subscriptions"].includes(c))`
  - If `isAccountOnly`, shows text "Account credentials will be delivered automatically after payment. No game ID needed" and hides UID input
  - If `needsGameId`, shows UID/Login field (label derived from `opt_delivery` as before)
  - Email receipt always shown
  - Note placeholder adapts: "Any special request..." for account-only, else server/region hint

Now currency/top-up/items/boosting still ask for UID, accounts/gift-cards/subscriptions do not.

---

## 7. Become a seller — WhatsApp/Telegram/Discord optional

**Request:** Add optional contact fields when becoming seller.

**DB:**
- `src/lib/schema.sql` added `whatsapp TEXT, telegram TEXT, discord TEXT` to `seller_profiles`
- `src/lib/schema-patches.mjs` added 3 ALTER TABLE patches for existing DBs (Phase 28)

**UI:**
- `BecomeSeller.tsx` step 1: added section "Contact links (optional)" with 3 inputs `whatsapp`, `telegram`, `discord`, hint "Optional — helps buyers contact you faster. Shown on your store profile."
- `StoreSettings.tsx`: type extended with 3 fields, added grid of 3 inputs with `defaultValue={profile.xxx}`

**Backend:**
- `src/lib/actions/kyc.ts` `submitVerificationAction`: reads `whatsapp/telegram/discord` from FormData, inserts into `seller_profiles` (7 columns now)
- `src/lib/actions/seller.ts` `saveStoreAction`: reads same 3 fields, updates `seller_profiles` SET `whatsapp=?, telegram=?, discord=?`

---

## 8. OfferForm — remove Email details section (image-4)

**Request:** In Sell Game Subscriptions page, automatic details panel "Account information shared with buyer" had Email details (Optional) Login/Password — remove it.

**Fix:** `src/components/seller/OfferForm.tsx` removed the whole Email details grid (2 inputs). Kept 2FA optional section. `EditOfferForm.tsx` already had no email details, so no change needed.

---

## 9. Automation & bug sweep

- All message actions now auto-notify via `mail.newMessage` and `revalidatePath`
- `getThreads` already joins `orders` to show `order_code` in chat header
- `ensureSchema()` will auto-apply new contact columns on first request, plus `deploy-migrate.mts` applies same PATCHES list
- Deleted `/uploads/image-*.png` after reading (transient folder), kept `public/art` permanent

---

## Files changed Phase 28

- `src/app/(site)/dashboard/verification/page.tsx` — apostrophe fix
- `src/components/seller/SellerOrders.tsx` — apostrophe fix + copy Order ID button
- `src/components/dash/MessagesView.tsx` — basePath separation for seller vs buyer
- `src/lib/actions/shop.ts` — startThreadAction reuse same chat for same buyer+seller
- `src/lib/actions/seller.ts` — sellerMessageBuyerAction + sellerOrderMessageAction reuse, saveStoreAction contact fields
- `src/components/dash/OrderDetail.tsx` — id added, copy ID, orderId fix for thread reuse
- `src/lib/queries.ts` — getCart category_slug
- `src/components/shop/CartView.tsx` — CartRow category_slug
- `src/components/browse/ListingGrid.tsx` — remove Level | Outfits
- `src/components/browse/ListingDetail.tsx` — remove Level/Outfits tags, dynamic Details from custom_fields
- `src/components/shop/CheckoutView.tsx` — category-aware delivery (no UID for accounts)
- `src/lib/schema.sql` + `schema-patches.mjs` — whatsapp/telegram/discord
- `src/components/dash/BecomeSeller.tsx` — contact inputs
- `src/components/seller/StoreSettings.tsx` — contact inputs + type
- `src/components/seller/OfferForm.tsx` — remove Email details section
- `phase28.md` — this file
- `uploads/` — cleared (4 images removed)

---

## VPS deploy

```bash
cd ~/g2x
git pull
rm -rf .next
npm run build   # should now pass, only img warnings
pm2 restart g2x
# check new columns
sqlite3 g2x.db "SELECT whatsapp, telegram, discord FROM seller_profiles LIMIT 1;"
```

Test checklist:
- Seller → Messages → click thread → stays in /seller/messages (not buyer panel)
- Buyer → Order → Contact Seller → Open chat twice → same thread id (no duplicate)
- Buyer & Seller order cards have Copy ID button
- /g/.../accounts listing cards no longer show Level | Outfits
- /g/.../accounts/[id] shows Details from custom_fields, no hardcoded outfits
- Checkout with account only → no UID field, text "No game ID needed"
- Checkout with currency/top-up → UID field still shows
- Become Seller form shows WhatsApp/Telegram/Discord optional
- Store Settings shows same 3 fields and saves
- Sell form → Account information shared with buyer → no Email details section
