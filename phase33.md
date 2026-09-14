# Phase 33 — Fix build error unused Info import + prevent future unused-var errors

Build now: `✓ Compiled successfully` — only 3 `<img>` warnings (intentional).

---

## Error reported

```
./src/components/seller/StoreSettings.tsx
4:55  Error: 'Info' is defined but never used.  @typescript-eslint/no-unused-vars
```

After Phase 32 we added `Info, AtSign` import but only used `AtSign`. ESLint in Next.js build treats unused vars as errors (not warnings), so build failed.

**Fix:**
- Removed `Info` from import: `import { Check, Loader2, Star, BadgeCheck, Upload, X, AtSign }`

---

## Why error repeats every time & prevention

Next.js `npm run build` runs ESLint with `@typescript-eslint/no-unused-vars` = error. Any leftover import after refactoring (e.g. removing market green text removed `TrendingUp/Down` but import stayed) breaks build.

**Prevention added this phase:**
- Audited all `lucide-react` imports via script: no other unused icons found after fix.
- Added pre-build check script `scripts/check-unused.mjs` (optional) that scans `src` for lucide imports not used in file and fails fast with clear message, so you catch before `next build`.
- Rule for future: when removing JSX, always remove its icon import in same edit. Use VSCode auto-organize imports.

**Files:**
- `src/components/seller/StoreSettings.tsx` — fixed
- `scripts/check-unused.mjs` — new helper to prevent recurrence

---

## Phase docs rule

Per your request: only latest phase file kept.
- Deleted `phase32.md`
- Now only `README.md`, `DEPLOYMENT.md`, `phase33.md`
- Next update → delete `phase33.md` → create `phase34.md`

---

## VPS deploy

```bash
cd ~/g2x
git pull
rm -rf .next
npm run build
pm2 restart g2x
```
