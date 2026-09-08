# Phase 19 — currency everywhere, identity, panel context, admin-driven sell wizard

Build: `✓ Compiled successfully`. Verified in a real browser; test data removed afterwards.

---

## 1. No more India signals

- Phone placeholder `+91 …` → **"Phone number"**; country placeholder `India` → **"Country"**.
- Google sign-up no longer hardcodes `country = 'India'` — it starts blank.
- The KYC country list was **India-first**; it is now sorted A–Z (Argentina, Australia,
  Bangladesh, …) with **no country pre-selected**. Both KYC forms now open on
  "Select country" and require a deliberate choice.

Nothing in the UI now hints at where the business is based.

## 2. Currency works across the whole site

**Root cause.** Two different `money()` helpers existed. The buyer pages used the
locale-aware hook, but **every seller component imported `money` from `@/lib/fmt`, which
hardcodes `"$"`** and ignores the selected currency entirely. Five server pages had the
same problem.

Fixes:
- 8 seller/dash client components switched to the `useMoney()` hook.
- 5 server pages now use the existing `serverLocale()` helper.
- Hardcoded strings cleaned up: the `$10` withdrawal minimum, the `$0.30` gateway fee, and
  the username-rename fee messages.

Verified page by page with INR selected — **zero stray dollar amounts** on `/seller`,
`/seller/finance`, `/seller/offers`, `/dashboard`, `/dashboard/wallet`, `/dashboard/orders`
and `/dashboard/profile`. Prices are still *stored* in USD and converted at render, so
nothing about the money logic changed.

## 3. Panel context + prominent switch

New `PanelBadge` at the top of both panels:

- **Buyer** — purple "You are in the Buyer Panel", with an **amber** CTA:
  *Switch to Seller Panel* (or *Become a Seller* if they have no store yet).
- **Seller** — amber "You are in the Seller Panel", with a **purple** *Switch to Buyer Panel*.

The switch lives inside the badge deliberately: the element people already look at to
orient themselves is the best place for the action, and the contrasting colour makes the
seller CTA impossible to miss from the buyer dashboard.

## 4. Buyers are identified by user ID, not their name

New `src/lib/handle.ts`. Buyers now appear as **`@cobra_768`** everywhere: the header, the
user menu, the dashboard sidebar and the "Welcome back" greeting.

I also found and closed a **privacy leak** while checking this — sellers could see a
buyer's **real name and email address** on orders, disputes, reviews and in chat. Those
queries now return the handle. Admins still see real identities, which they need for KYC
and moderation. The Profile page still shows your own name, since that is your own data.

## 5. The sell wizard (images 1–6), fully admin-configurable

New flow: **My Offers → New offer → category → game → product → offer form.**

What each category asks for is **not hardcoded** — it is stored per category and editable
in Admin → Categories → the new **Sell flow** button:

| Setting | Effect |
|---|---|
| Unit label | "K", "unit", "account"… drives *Price per K*, quantity suffixes |
| Commission % | Shown in the fee card, per category |
| Require offer title | Shows the title box |
| Allow offer photos | Shows the uploader |
| Collect account credentials | Adds the encrypted login/2FA vault + Automatic-vs-Manual delivery |
| Ask for quantity | Off for one-off services |
| Allow volume discounts | Bulk pricing tiers |
| Notice title + body | The card above the game picker (e.g. accounts' "5 Day money hold system") |

Extra per-category fields (Account Level, Tier, Ban History, Current/Target Rank…) come
from the existing **Field Templates**, so the admin can add whatever a product needs
without a code change. Defaults are seeded to match your screenshots — Accounts 10% with
the 5-day notice, Items 15%, Currency/Top-Up 5%, credentials only on Accounts and
Subscriptions. Boosting and Top Up work the same way automatically.

## 6. Delivered account view (image-7)

The buyer's credential panel is rebuilt as the approved design: a green **Account
Delivered / Completed** header, one labelled row per field with its own **Copy** button,
notes as a block, and Reveal/Hide. Copy works while masked, so a password can be pasted
without being displayed.

---

## Bugs found and fixed during verification

1. **Accounts and Boosting had an empty game picker.** Those two categories have *no*
   admin-defined products — every account is unique, so their inventory lives in the
   `listings` table. The wizard only queried `products`. It now lists any game attached to
   the category and, when there are no products, skips the product step and goes straight
   to the form, writing a `listings` row instead of an `offers` row.
2. **Duplicated fields on the Currency and Top-Up forms.** Old seed data defined Price,
   Stock and Delivery Time as generic templates *and* as real controls, so the form asked
   for each twice. Reserved keys are now filtered out of the template list on both the
   client and the server.
3. **A `dropdown` template with no configured options rendered an empty, unusable select** —
   it now falls back to a text box, and `switch` fields render a proper Yes/No control.
4. A React hooks violation (`useMoney` called inside a `.map()`) that would have crashed
   the buyer disputes page.

## Deploy reminder
Run `npm run db:migrate` against Turso — this phase adds the category sell-flow columns
and several `offers` columns. The runtime schema guard also self-repairs them.
