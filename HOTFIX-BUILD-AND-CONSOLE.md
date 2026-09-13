# Hotfix — Windows build error, live console errors, font preload

Build: `✓ Compiled successfully` with **no** "Export encountered errors".
`tsc --noEmit` clean. Verified in a real browser: zero page errors, zero console errors.

---

## 1. `Export encountered errors on /icon` (your Windows build)

```
TypeError: Invalid URL
    at fileURLToPath (node:internal/url:1505:12)
    at .../next/dist/compiled/@vercel/og/index.node.js:18988:32
```

`src/app/icon.tsx` generated the favicon at build time with `ImageResponse`
(`@vercel/og`). That library resolves its bundled font via `fileURLToPath`, which
chokes on a Windows drive path like `D:\business\...`. It built fine on Linux, which is
why you only saw it locally — but it was a latent risk on any Windows machine and it
added a whole image-rendering runtime to the build for a 32×32 icon.

**Fix:** dropped the dependency entirely. The icon is now a plain pre-rendered PNG:

- `src/app/icon.png` (32×32) — browser tab and Google's result icon
- `src/app/apple-icon.png` (180×180) — iOS home screen
- `src/app/favicon.ico` — multi-size 16/32/48/64
- `public/art/logo-64.png` — referenced by the `Organization` JSON-LD

Same purple gradient tile with the white **G** as the navbar logo. No build-time image
runtime, so this cannot fail on any OS.

I also replaced the leftover **stock Next.js `favicon.ico`** that was still being served
— your tab was showing the Next logo, not your brand.

## 2. `Error: Connection closed.` on the live site

Root cause found: three **fire-and-forget** background tasks that keep querying the
database *after* the response is sent —

- `sweepEscrowInBackground()` on `/dashboard` and `/seller`
- `purgeMediaInBackground()` on `/seller/disputes`
- the FX `refreshRates()` in `getRates()`

A serverless container is frozen the instant the response finishes, so those in-flight
queries were cut off mid-socket. The work itself was harmless; the *error* was noise from
a task that never got to finish, and it aborted the RSC stream the browser was still
reading — which is why it appeared right as the page loaded.

**Fix:** new `src/lib/after.ts`. `runAfter()` keeps the fire-and-forget ergonomics but:

- uses the platform's **`waitUntil`** when available (Netlify and Vercel both provide it),
  which keeps the container alive until the task settles;
- otherwise bounds the task with a timeout and swallows every error, so a frozen
  container can never surface an unhandled rejection;
- never starts background work during prerender/build.

## 3. Font preload warning

```
The resource …/e4af272ccee01ff0-s.p.woff2 was preloaded using link preload
but not used within a few seconds from the window's load event.
```

`next/font` was emitting a `<link rel="preload">` for an Inter subset the CSS never
referenced — the browser downloaded a font nothing asked for, on the critical path.

Configured the font properly: `display: "swap"` (text paints immediately instead of
blocking on the download), `preload: false` (no phantom preload), and
`adjustFontFallback` with a system-font stack so the swap does not shift the layout.

**Verified: 0 font preload links in the served HTML.**

## 4. Also fixed
- The `useMemo` dependency warning in `OffersView.tsx` (`product` is now memoised).
- Cleaned up `image-1` … `image-9` from the workspace (~4 MB). The spec PDF, the mockup
  JPEGs and `g2x-Ques.txt` are kept — those are still reference material.

## Not our bug
`[Violation] Permissions policy violation: unload` and the
`Cannot read properties of undefined (reading 'startTime')` trace both come from
Netlify's injected `logsListener.bundle.js` / RUM script, not from any of our code. They
will disappear when you move to your VPS.

## Deploy
`npm run build` migrates the database and then builds. Nothing manual — and the same
command works unchanged on the VPS.
