# Phase 44 — Per-Category Delivery Methods (Eldorado-style) — Items single In-game, Currency 7 BETA, Accounts/Gift Cards Automatic/Manual, Boosting future-ready

Build: `npx next build` ✓ 87.5kB shared – lint fixed

## User Request (Images 1-5)
- Image-1: Sell Game Items (Albion) – Delivery method only one option "In-game delivery" fixed, not all methods – that's good, keep single.
- Image-2/3: Accounts – Delivery method = Automatic / Manual radio, with vault (Account #1 login/pass, Email optional, 2FA optional). When Manual, also Guaranteed Delivery Time + Quantity 1 unit.
- Image-4: Currency (Tarkov Roubles) – Delivery method BETA with 7 radios: In-game trade, Game Pass, Auction House, Mail Trade, Island Delivery, Epic Gifting, Login Method. Quantity Total + Minimum, Volume discount.
- Image-5: Gift Cards – Delivery method Automatic/Manual, Gift card vault (Gift card 1 teal), Price.
- Boosting – no image, user says make from side, future-ready, no many delivery methods.

Previous bug: accounts seller offer page showed ALL delivery methods (all from option_lists) – should only show Automatic/Manual.

## Solution

### 1. New central preset `src/lib/category-delivery.ts`
Defines per category:
- `items`: fulfilment manual, showDeliveryMethods true, methods [{in_game_delivery: In-game delivery}], singleFixed true, showGuaranteedTime true, quantity full, needs_title 1, needs_images 1, allow_volume true
- `currency`: fulfilment manual, showDeliveryMethods true, methods 7 BETA (in_game_trade, game_pass, auction_house, mail_trade, island_delivery, epic_gifting, login_method), singleFixed false, quantity min_total (Total + Min), allow_volume true
- `accounts`: fulfilment both, showDeliveryMethods false (uses Automatic/Manual radio = fulfilment), showGuaranteedTime manual_only, quantity fixed_1, needs_credentials true, needs_images true
- `gift-cards`: fulfilment both, showDeliveryMethods false, quantity hidden (stock = number of codes added via vault), needs_credentials true
- `top-up`: fulfilment manual, singleFixed Top-up, quantity full, allow_volume false
- `subscriptions`: fulfilment both, showDeliveryMethods false, quantity fixed_1, needs_credentials true
- `boosting`: fulfilment manual, showDeliveryMethods false, showGuaranteedTime true, quantity fixed_1, needs_title 1, unit service – future ready, no delivery method, only "Boosting Service will be delivered manually via chat" hint.

`allDeliveryMethodValues()` merges all for seeding.

### 2. `src/lib/ensure-schema.ts` rewritten
- Uses DELIVERY_PRESETS to UPDATE categories: needs_title, needs_images, needs_credentials, needs_quantity, allow_volume_discount, fulfilment, show_delivery_method, unit_label per preset. So DB always matches Eldorado UX.
- Seeds delivery_time 9 options (Instant, 1h,5h,12h,1d,2d,5d,7d,14d)
- Seeds delivery_method option_lists from all preset values + legacy (in_game_delivery, top_up, in_game_trade, game_pass, auction_house, mail_trade, island_delivery, epic_gifting, login_method, boosting_service, automatic_manual) via INSERT OR IGNORE + UPDATE active=1

### 3. `src/components/seller/OfferForm.tsx` – complete per-category UI
- Imports getPreset(config.slug)
- effectiveDeliveryMethods = preset.showDeliveryMethods ? preset.deliveryMethods : []
- deliveryMethod state auto-synced to single fixed value (useEffect, boosting_service for boosting)
- Delivery card:
  - If mode==both: Automatic/Manual radio with description tailored per category (gift-cards vs accounts)
  - showTime logic: preset.showGuaranteedTime true => always, manual_only => only when !auto
  - Delivery method section:
    - currency: BETA badge + Choose delivery method + grid of 7 radios with ? icon (like Image-4)
    - singleFixed (items, top-up): fixed disabled box showing label (like Image-1 "In-game delivery")
    - else: radio grid
  - Boosting hint when slug==boosting
  - Quantity per quantityMode: full (Total + Min), min_total (M unit), fixed_1 (1 unit disabled), hidden (no quantity)
  - Volume discount only when preset.allowVolume && config.allow_volume_discount==1
- Submit validation: needTime based on preset, not just !auto

### 4. `src/components/seller/EditOfferForm.tsx`
- Same preset logic, effectiveDeliveryMethods, showTime, quantityMode, boosting_service handling
- Fixed lint warnings, added useEffect for boosting

### 5. `src/components/admin/BulkProducts.tsx`
- Now imports getPreset(category)
- Shows Category dropdown with delivery methods hint in option label
- Third column: Delivery method per preset – singleFixed shows fixed div + hidden input, multi shows select with BETA, both=false shows Automatic/Manual note + hidden input (boosting_service)
- Info box with Package icon explains preset description per category (mirrors Eldorado)
- Keeps gameFields cascading dropdowns for Server selection (fix duplicate glitch still)

### 6. `src/components/browse/ProductView.tsx`
- splitOpts filters out internal values boosting_service, automatic_manual so buyer doesn't see them as chips
- Methods chip row now only shows real methods (e.g., currency shows in-game trade etc if product has them)

### 7. Wiring & Bugfixes
- Seller → Buyer → Admin connected:
  - Seller creates offer with category-specific deliveryMethod (e.g., currency in_game_trade) – saved to offers.delivery_method
  - Buyer ProductView shows correct delivery method chips, filtering via gameFields still works
  - Admin bulk creates products with correct delivery_method per preset (hidden input ensures singleFixed still submitted)
  - Orders: delivery_method carried via cart opt_delivery, stored in order_items.opt_delivery, visible to seller in SellerOrders
  - Automatic delivery for accounts/gift-cards still emails buyer via mail.orderAutoDelivered (existing logic)
- No all-methods leak: accounts/gift-cards/subscriptions/boosting showDeliveryMethods false, so old global option_lists no longer appears
- Boosting future-ready: preset exists, category exists in DB, sell wizard will work when admin adds games to boosting category – shows only Guaranteed Delivery Time + Price, no delivery method list, quantity fixed 1

## Testing Checklist
- Items: Sell → Offer Details Server (from gameFields), Offer Title, Upload photos, Description, Delivery Guaranteed Time Choose + Delivery method fixed "In-game delivery", Price per item, Quantity Total+Min, Volume discount
- Currency: Offer Details Server, Description optional, Delivery Guaranteed Time + Delivery method BETA 7 radios, Quantity Total+Min M, Price per M, Volume discount
- Accounts: Offer Details Device/Original Email (field_templates), Offer Title, Upload photos, Description, Delivery Automatic/Manual radio, when Auto show Account vault, when Manual show Guaranteed Time + Quantity 1 unit + vault optional, Price, Fee
- Gift Cards: Offer Details Steam Game Account dropdown, Delivery Automatic/Manual, Gift card vault teal, Price, no Quantity (hidden)
- Top-up: single fixed Top-up method, Guaranteed Time, Quantity, Price
- Boosting: Title, Description, Delivery Guaranteed Time only + hint "Boosting service will be delivered manually", Price, Quantity 1 unit fixed, no delivery method list
- Buyer: product page shows only relevant delivery chips, FILTER OFFERS for gameFields
- Admin Bulk: Category select shows preset hint, Delivery method column shows per-category method, Server fields show when game selected

## Deploy
```bash
cd ~/g2x
git pull
npm install
npm run build
pm2 restart g2x
```
After deploy, ensureSchema seeds new delivery_method values and updates categories.

## Files Changed
- src/lib/category-delivery.ts (new)
- src/lib/ensure-schema.ts (rewrite with presets)
- src/components/seller/OfferForm.tsx (rewrite delivery UI per category)
- src/components/seller/EditOfferForm.tsx (same)
- src/components/admin/BulkProducts.tsx (per-category delivery method + preset info)
- src/components/browse/ProductView.tsx (filter internal methods)
