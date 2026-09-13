# G2X Project Structure (Arranged)

```
g2x/
├── .archive/
├── .next/
├── node_modules/
├── public/
│   └── art/
│       ├── 8ball.png
│       ├── apex.png
│       ├── bgmi.png
│       ├── cash.png
│       ├── coc.png
│       ├── codm.png
│       ├── coins.png
│       ├── diamond.png
│       ├── freefire.png
│       ├── genshin.png
│       ├── gta.png
│       ├── hero.png
│       ├── item-crate.png
│       ├── item-pass.png
│       ├── logo-64.png
│       ├── lol.png
│       ├── placeholder.png
│       ├── pokemongo.png
│       ├── robux.png
│       ├── uc.png
│       ├── vp.png
│       └── wallet.png
├── scripts/
│   ├── backup-db.mts
│   ├── catalog-full.mts
│   ├── catalog.json
│   ├── check-env.mts
│   ├── db-url.mjs
│   ├── deploy-migrate.mts
│   ├── fix-hero-badge.mts
│   ├── fx-refresh.mts
│   ├── migrate.mts
│   ├── reseed-catalog.mts
│   ├── restore-db.mts
│   ├── seed-cms.mts
│   ├── seed-delivery-times.mts
│   ├── seed-gateways.mts
│   ├── seed-nav.mts
│   ├── seed-options.mts
│   ├── seed-sellflow.mts
│   └── seed.mts
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── register/
│   │   │   │   └── page.tsx
│   │   │   ├── verify-email/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   ├── (site)/
│   │   │   ├── c/
│   │   │   │   └── [category]/
│   │   │   ├── cart/
│   │   │   │   ├── loading.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── checkout/
│   │   │   │   ├── loading.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── dashboard/
│   │   │   │   ├── become-seller/
│   │   │   │   ├── disputes/
│   │   │   │   ├── messages/
│   │   │   │   ├── notifications/
│   │   │   │   ├── orders/
│   │   │   │   ├── products/
│   │   │   │   ├── profile/
│   │   │   │   ├── reviews/
│   │   │   │   ├── security/
│   │   │   │   ├── transactions/
│   │   │   │   ├── verification/
│   │   │   │   ├── wallet/
│   │   │   │   ├── wishlist/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── loading.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── g/
│   │   │   │   └── [game]/
│   │   │   ├── p/
│   │   │   │   └── [slug]/
│   │   │   ├── seller/
│   │   │   │   ├── disputes/
│   │   │   │   ├── finance/
│   │   │   │   ├── listings/
│   │   │   │   ├── offers/
│   │   │   │   ├── orders/
│   │   │   │   ├── reviews/
│   │   │   │   ├── sell/
│   │   │   │   ├── store/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── loading.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── support/
│   │   │   │   ├── loading.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── layout.tsx
│   │   │   ├── loading.tsx
│   │   │   └── page.tsx
│   │   ├── admin/
│   │   │   ├── activity/
│   │   │   │   └── page.tsx
│   │   │   ├── announcements/
│   │   │   │   └── page.tsx
│   │   │   ├── banners/
│   │   │   │   └── page.tsx
│   │   │   ├── bulk/
│   │   │   │   └── page.tsx
│   │   │   ├── buyer-kyc/
│   │   │   │   └── page.tsx
│   │   │   ├── categories/
│   │   │   │   └── page.tsx
│   │   │   ├── cms/
│   │   │   │   └── page.tsx
│   │   │   ├── commission/
│   │   │   │   └── page.tsx
│   │   │   ├── delivery-logs/
│   │   │   │   └── page.tsx
│   │   │   ├── disputes/
│   │   │   │   └── page.tsx
│   │   │   ├── games/
│   │   │   │   └── page.tsx
│   │   │   ├── gateways/
│   │   │   │   └── page.tsx
│   │   │   ├── import/
│   │   │   │   └── page.tsx
│   │   │   ├── levels/
│   │   │   │   └── page.tsx
│   │   │   ├── media/
│   │   │   │   └── page.tsx
│   │   │   ├── messages/
│   │   │   │   └── page.tsx
│   │   │   ├── navigation/
│   │   │   │   └── page.tsx
│   │   │   ├── offers/
│   │   │   │   └── page.tsx
│   │   │   ├── options/
│   │   │   │   └── page.tsx
│   │   │   ├── order-status/
│   │   │   │   └── page.tsx
│   │   │   ├── orders/
│   │   │   │   └── page.tsx
│   │   │   ├── payments/
│   │   │   │   └── page.tsx
│   │   │   ├── permissions/
│   │   │   │   └── page.tsx
│   │   │   ├── products/
│   │   │   │   └── page.tsx
│   │   │   ├── promotions/
│   │   │   │   └── page.tsx
│   │   │   ├── reports/
│   │   │   │   ├── products/
│   │   │   │   ├── revenue/
│   │   │   │   ├── sales/
│   │   │   │   ├── sellers/
│   │   │   │   └── users/
│   │   │   ├── roles/
│   │   │   │   └── page.tsx
│   │   │   ├── seller-requests/
│   │   │   │   └── page.tsx
│   │   │   ├── sellers/
│   │   │   │   └── page.tsx
│   │   │   ├── settings/
│   │   │   │   └── page.tsx
│   │   │   ├── templates/
│   │   │   │   └── page.tsx
│   │   │   ├── tickets/
│   │   │   │   └── page.tsx
│   │   │   ├── transactions/
│   │   │   │   └── page.tsx
│   │   │   ├── users/
│   │   │   │   └── page.tsx
│   │   │   ├── verifications/
│   │   │   │   └── page.tsx
│   │   │   ├── wallets/
│   │   │   │   └── page.tsx
│   │   │   ├── withdrawals/
│   │   │   │   └── page.tsx
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   └── google/
│   │   │   ├── kyc/
│   │   │   │   └── [...key]/
│   │   │   ├── media/
│   │   │   │   └── [id]/
│   │   │   ├── search/
│   │   │   │   └── route.ts
│   │   │   ├── seller/
│   │   │   │   └── catalog/
│   │   │   └── wishlist/
│   │   │       └── route.ts
│   │   ├── fonts/
│   │   │   ├── GeistMonoVF.woff
│   │   │   └── GeistVF.woff
│   │   ├── apple-icon.png
│   │   ├── favicon.ico
│   │   ├── globals.css
│   │   ├── icon.png
│   │   ├── layout.tsx
│   │   ├── robots.ts
│   │   └── sitemap.ts
│   ├── components/
│   │   ├── admin/
│   │   │   ├── AdminNav.tsx
│   │   │   ├── AnnouncementsManager.tsx
│   │   │   ├── BannersManager.tsx
│   │   │   ├── BulkProducts.tsx
│   │   │   ├── BuyerKycReview.tsx
│   │   │   ├── CategoriesManager.tsx
│   │   │   ├── ChatMonitor.tsx
│   │   │   ├── CmsManager.tsx
│   │   │   ├── ContentReset.tsx
│   │   │   ├── CouponsManager.tsx
│   │   │   ├── DisputesManager.tsx
│   │   │   ├── GamesManager.tsx
│   │   │   ├── GatewaysManager.tsx
│   │   │   ├── ImagePicker.tsx
│   │   │   ├── ImportExport.tsx
│   │   │   ├── MediaLibrary.tsx
│   │   │   ├── NavManager.tsx
│   │   │   ├── OffersModeration.tsx
│   │   │   ├── OptionsManager.tsx
│   │   │   ├── OrdersManager.tsx
│   │   │   ├── ProductsManager.tsx
│   │   │   ├── RolesManager.tsx
│   │   │   ├── SellerLevels.tsx
│   │   │   ├── SellersManager.tsx
│   │   │   ├── SettingsForm.tsx
│   │   │   ├── TemplatesManager.tsx
│   │   │   ├── TicketsManager.tsx
│   │   │   ├── ui.tsx
│   │   │   ├── UsersManager.tsx
│   │   │   ├── VerificationReview.tsx
│   │   │   └── WithdrawalsManager.tsx
│   │   ├── auth/
│   │   │   ├── AuthForm.tsx
│   │   │   └── VerifyEmail.tsx
│   │   ├── browse/
│   │   │   ├── GameIndex.tsx
│   │   │   ├── GameRail.tsx
│   │   │   ├── ListingDetail.tsx
│   │   │   ├── ListingGrid.tsx
│   │   │   ├── ProductCard.tsx
│   │   │   ├── ProductView.tsx
│   │   │   └── WishlistSync.tsx
│   │   ├── dash/
│   │   │   ├── BecomeSeller.tsx
│   │   │   ├── BuyerKyc.tsx
│   │   │   ├── Credentials.tsx
│   │   │   ├── DashboardNav.tsx
│   │   │   ├── DisputesView.tsx
│   │   │   ├── MarkRead.tsx
│   │   │   ├── MessagesView.tsx
│   │   │   ├── OrderDetail.tsx
│   │   │   ├── OrderReview.tsx
│   │   │   ├── PanelShell.tsx
│   │   │   ├── ProfileForm.tsx
│   │   │   ├── ReviewsView.tsx
│   │   │   ├── SecurityView.tsx
│   │   │   ├── UsernameCard.tsx
│   │   │   ├── WalletView.tsx
│   │   │   └── WishlistView.tsx
│   │   ├── seller/
│   │   │   ├── FinanceView.tsx
│   │   │   ├── ListingsView.tsx
│   │   │   ├── OfferForm.tsx
│   │   │   ├── OffersView.tsx
│   │   │   ├── SalesChart.tsx
│   │   │   ├── SellerDisputes.tsx
│   │   │   ├── SellerNav.tsx
│   │   │   ├── SellerOrders.tsx
│   │   │   ├── SellerReviews.tsx
│   │   │   ├── SellWizard.tsx
│   │   │   └── StoreSettings.tsx
│   │   ├── shop/
│   │   │   ├── CartView.tsx
│   │   │   └── CheckoutView.tsx
│   │   ├── support/
│   │   │   └── SupportView.tsx
│   │   ├── BannerSlider.tsx
│   │   ├── BrandIcon.tsx
│   │   ├── Categories.tsx
│   │   ├── CategoryIcon.tsx
│   │   ├── Footer.tsx
│   │   ├── Header.tsx
│   │   ├── Hero.tsx
│   │   ├── LiveSupport.tsx
│   │   ├── LocaleProvider.tsx
│   │   ├── LocaleSwitcher.tsx
│   │   ├── LocalTime.tsx
│   │   ├── Logo.tsx
│   │   ├── MonitorNotice.tsx
│   │   ├── NavMenu.tsx
│   │   ├── PanelBadge.tsx
│   │   ├── Services.tsx
│   │   ├── SiteShell.tsx
│   │   ├── Skeleton.tsx
│   │   ├── Stats.tsx
│   │   ├── Testimonials.tsx
│   │   ├── TimeAgo.tsx
│   │   └── ui.tsx
│   ├── lib/
│   │   ├── actions/
│   │   │   ├── admin.ts
│   │   │   ├── auth.ts
│   │   │   ├── buyer-kyc.ts
│   │   │   ├── kyc.ts
│   │   │   ├── seller.ts
│   │   │   └── shop.ts
│   │   ├── admin.ts
│   │   ├── after.ts
│   │   ├── buyer-kyc.ts
│   │   ├── cache.ts
│   │   ├── catalog.ts
│   │   ├── creds.ts
│   │   ├── data.ts
│   │   ├── db.ts
│   │   ├── ensure-schema.ts
│   │   ├── escrow.ts
│   │   ├── fmt.ts
│   │   ├── fx.ts
│   │   ├── gameart.ts
│   │   ├── gateway-fees.ts
│   │   ├── gateways.ts
│   │   ├── handle.ts
│   │   ├── homepage.ts
│   │   ├── i18n.ts
│   │   ├── img.ts
│   │   ├── kyc.ts
│   │   ├── locale.ts
│   │   ├── mail.ts
│   │   ├── media.ts
│   │   ├── migrations.sql
│   │   ├── moderation.ts
│   │   ├── otp.ts
│   │   ├── queries-admin.ts
│   │   ├── queries.ts
│   │   ├── ratelimit.ts
│   │   ├── retention.ts
│   │   ├── schema-patches.mjs
│   │   ├── schema.sql
│   │   ├── session.ts
│   │   ├── storage.ts
│   │   ├── subscription.ts
│   │   ├── username.ts
│   │   └── wallet.ts
│   └── middleware.ts
├── .env.example
├── .env.local
├── .eslintrc.json
├── .gitignore
├── c.mts
├── cleanup-stale.ps1
├── DEPLOYMENT.md
├── fix-vps.sh
├── g2x.db
├── g2x.db-shm
├── g2x.db-wal
├── HOTFIX-BUILD-AND-CONSOLE.md
├── HOTFIX-SELL-500.md
├── HOTFIX-WIZARD-PERF.md
├── next-env.d.ts
├── next.config.mjs
├── package-lock.json
├── package.json
├── PERF-AND-FIXES.md
├── PHASE26.md
├── postcss.config.mjs
├── README.md
├── tailwind.config.ts
├── tsconfig.json
├── tsconfig.tsbuildinfo
└── VPS-DATABASE.md
```

