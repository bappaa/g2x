# Phase 17 — navigation, ordering & Google listing

Build: `✓ Compiled successfully`. All four items verified in a real browser (desktop
1440px and mobile 390px, dark **and** light themes).

---

## 1. Category dropdown navigation (images 1–4)

New `src/components/NavMenu.tsx`, driven by a new `navMenu()` query in
`src/lib/homepage.ts`. **Everything is built from your own catalog tables**
(`categories`, `games`, `game_categories`) — no markup, styling, copy or assets were
copied from any other site, so there is nothing to attract a copyright complaint. It
reuses your existing design tokens (`--panel`, `--line`, brand purple), your
`AnyLogo`/`Image` icon renderer, your Framer Motion timings and your i18n dictionary.

**Desktop** — each category is now a dropdown button with a chevron. The panel spans the
header width and has two columns:
- *Popular games* — top 10 by sort order, two-up, plus a "See All <Category>" link.
- *All games* — the complete list with a live **Search for game** box.

Opens on hover *and* on click/keyboard (`aria-haspopup`/`aria-expanded`), so it is usable
without a mouse.

**Mobile** — the hamburger opens the sheet (image-2) → a flat **Categories** list with
chevrons (image-3) → tapping one slides to that category's games with a back arrow, its
own search, and Popular/All sections (image-4).

Verified: 6 dropdowns render, games load from the DB, typing "wow" filters the All-games
column only, links navigate (`/g/8-ball-pool/currency`), and the mobile drill-down and
back arrow behave. New i18n keys added (`nav.categories`, `nav.popularGames`,
`nav.allGames`, `nav.searchGame`, `nav.noGames`, `nav.noMatch`) with English defaults and
a `t(key, fallback)` so the other 10 languages degrade gracefully.

## 2 & 3. Listing order on the homepage and in the footer (images 5–6)

Both the homepage tiles and the footer's "Our Services" now follow the navbar order:

**Currency → Top Up → Items → Accounts → Subscriptions → Boosting**

**Root cause.** Both read `categories` with `ORDER BY sort_order, name`. On a database
where `sort_order` was never populated every row sits at `0`, so SQLite silently falls
back to *name* — which is exactly the alphabetical "Accounts, Boosting, Currency…" in your
screenshot. I fixed it in two layers so it cannot regress:

1. `CATEGORY_ORDER` + a `CASE` in the SQL pins the six known slugs regardless of what is
   in `sort_order`; anything an admin adds later sorts after them by its own value.
2. Re-wrote the correct `sort_order` values (1–6) into the database.

The same ordering now also drives the nav dropdowns, so all three stay in sync.

## 4. Google listing (image-7)

The site had **no SEO metadata, no canonical, no structured data, no robots.txt, no
sitemap and no favicon** — which is why Google showed a bare "g2x" with a generic
description and a blank icon.

- **Bold site name** — added `WebSite` + `Organization` JSON-LD with
  `name: "G2X.GG"` and `alternateName: ["G2X", "G2X GG", "g2x.gg"]`. This is the signal
  Google uses to render the bold site name above a result.
- **Title & description** — real defaults instead of the bare brand:
  *"G2X.GG — Buy & Sell Game Accounts, Coins, Top-Ups & Items"* plus a description
  covering accounts, currency, items, top-ups, subscriptions, boosting, instant delivery,
  escrow and 24/7 support. A `%s | G2X.GG` template keeps the brand on every page.
  Still fully overridable in Admin → Settings (`seo_title`, `seo_description`).
- **`src/app/icon.tsx`** — generates the purple "G" tile favicon matching the navbar, so
  the result gets your logo instead of a blank globe.
- **`src/app/robots.ts`** — allows the public site, blocks `/admin`, `/dashboard`,
  `/seller`, `/api`, `/cart`, `/checkout`, and points at the sitemap.
- **`src/app/sitemap.ts`** — 205 URLs from the live catalog (categories, games, content
  pages).
- Canonical URL, Open Graph and Twitter cards, and `max-image-preview: large`.

> **Note:** Google re-crawls on its own schedule — expect a few days to a couple of weeks
> for the new title, description and icon to appear. You can speed it up by submitting
> `https://g2x.gg/sitemap.xml` in Google Search Console and using "Request indexing".
> Also make sure `NEXT_PUBLIC_APP_URL=https://g2x.gg` is set on Netlify — the canonical
> and sitemap URLs are derived from it.

---

## Standing note recorded
All UI is original work built on your own components and data. No third-party site's
markup or assets are used anywhere in this project.
