# G2X.GG — remove stale Phase-1/Phase-2 files that were replaced by the DB-backed versions.
# Run from the project root:  powershell -ExecutionPolicy Bypass -File .\cleanup-stale.ps1

$stale = @(
  # old homepage — the real one now lives at src/app/(site)/page.tsx inside SiteShell
  "src\app\page.tsx",

  # old client-side state — replaced by the DB + server actions
  "src\lib\store.tsx",
  "src\lib\auth.tsx",

  # old mock-data browse components — replaced by ProductCard / ListingGrid / ProductView / ListingDetail
  "src\components\browse\GameCategoryView.tsx",
  "src\components\browse\AccountGrid.tsx",
  "src\components\browse\BoostGrid.tsx",
  "src\components\browse\AccountDetail.tsx",
  "src\components\browse\BoostDetail.tsx",
  "src\components\browse\CategoryHub.tsx",
  "src\components\browse\SubscriptionsView.tsx"
)

foreach ($f in $stale) {
  if (Test-Path $f) {
    Remove-Item $f -Force
    Write-Host "deleted  $f" -ForegroundColor Yellow
  } else {
    Write-Host "already gone  $f" -ForegroundColor DarkGray
  }
}

# clear the Next build cache so no stale route manifest survives
if (Test-Path ".next") {
  Remove-Item ".next" -Recurse -Force
  Write-Host "cleared  .next" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Done. Now run:  npm run build" -ForegroundColor Green
