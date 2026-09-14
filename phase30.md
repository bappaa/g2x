# Phase 30 — Build fixes + consolidated phase (removes previous phases)

Build now passes `npm run build` — only `<img>` warnings remain (intentional).

---

## Build errors fixed this phase

### 1. `OffersView.tsx` unused vars
```
8:46 Error: 'TrendingDown' is defined but never used.
8:60 Error: 'TrendingUp' is defined but never used.
```
- Removed `TrendingDown, TrendingUp` from lucide-react import after market green text removal in Phase 29.
- File now: `import { Plus, Search, Pause, Play, Trash2, Pencil, Link2, Check }`

### 2. Previous phases consolidated
- Removed all old phase docs per user request: `phase.md`, `phase28.md`, `phase29.md`, `PHASE26.md`, `PHASE27.md`, `ARRANGED.md`, `HOTFIX-*.md`, `PERF-AND-FIXES.md`, `PROGRESS.md`, `STRUCTURE_OVERVIEW.md`, `VPS-DATABASE.md`
- Kept only `README.md`, `DEPLOYMENT.md`, and this `phase30.md` — future updates will delete `phase30.md` and create `phase31.md`, etc.

---

## Consolidated fixes (Phases 28-30)

### Messaging separation & no duplicate chats
- `MessagesView.tsx`: `basePath = isSeller ? "/seller/messages" : "/dashboard/messages"` — seller stays in seller panel, buyer in buyer panel.
- `Header.tsx`: message icon now `href={path.startsWith("/seller") ? "/seller/messages" : "/dashboard/messages"}`
- `startThreadAction`, `sellerMessageBuyerAction`, `sellerOrderMessageAction`: exact `order_id` match first, then fallback to most recent thread for same buyer+seller pair — prevents new chat per order for same product. Order code still prefixed in message `[Order CODE]`.

### Copy Order ID
- Buyer `OrderDetail.tsx` header: Copy ID button
- Seller `SellerOrders.tsx`: Order ID row with Copy button

### Account page fixes
- `ListingGrid.tsx`: removed `Level | Outfits` line from card
- `ListingDetail.tsx`: removed Level/Outfits tags, replaced hardcoded `What's included` with dynamic `Details` from `custom_fields` JSON, fallback generic safe list. Added `custom_fields` to `DbListing` type to fix `any` error.

### Checkout category-aware
- `getCart` now returns `category_slug`
- `CheckoutView.tsx`: `needsGameId` for currency/top-up/items/boosting shows UID field, `isAccountOnly` for accounts/gift-cards/subscriptions hides UID field and shows "No game ID needed".

### Become seller contact links
- DB: `whatsapp, telegram, discord` columns added to `seller_profiles` via `schema.sql` + `schema-patches.mjs` (85 statements, 16 applied)
- `BecomeSeller.tsx` + `StoreSettings.tsx`: 3 optional inputs
- Backend `kyc.ts` + `seller.ts`: save contact fields

### OfferForm email removal
- Removed Email details (Optional) section from `OfferForm.tsx`

### Seller username fee (2 free then pay)
- `saveStoreAction`: now checks `username_changes`, `FREE_CHANGES=2`, `usernameChangeFee()` from settings. If store rename changes username and used >=2, charges fee from wallet, uses transaction with `SPEND_SQL`. Returns error if balance insufficient.

### Commission hiding
- Removed market green text, removed service fee rows from cart/checkout/order detail, seller orders shows only `seller_net`.

---

## Files changed Phase 30

- `src/components/seller/OffersView.tsx` — remove TrendingDown/Up import
- `src/app/(site)/seller/store/page.tsx` — Prof includes whatsapp/telegram/discord (Phase 29 fix)
- `src/lib/queries.ts` — DbListing custom_fields
- `src/components/browse/ListingDetail.tsx` — no any
- `src/lib/actions/seller.ts` — paid rename + contact fields
- `src/components/Header.tsx` — context-aware messages href
- `phase30.md` — this file (only phase doc now)

---

## VPS deploy

```bash
cd ~/g2x
git pull
rm -rf .next
npm run build   # ✓ Compiled successfully, only img warnings
pm2 restart g2x
```

All previous phase*.md removed per request — only phase30.md remains for this update. Next update should delete phase30.md and create phase31.md.
