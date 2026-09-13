import WishlistProvider from "@/components/browse/WishlistSync";
import Header, { HeaderNotif } from "./Header";
import Footer from "./Footer";
import LiveSupport from "./LiveSupport";
import { getSessionUser } from "@/lib/session";
import { all, one } from "@/lib/db";
import { footerNav, homeCategories, getBlocks, navMenu } from "@/lib/homepage";
import { getLocale, getRates } from "@/lib/locale";
import { dictFor } from "@/lib/i18n";
import LocaleProvider from "./LocaleProvider";

export default async function SiteShell({ children }: { children: React.ReactNode }) {
  /**
   * PERFORMANCE: one waterfall, not five.
   *
   * Every one of these reads is independent of the others, but they used to run
   * in four sequential stages (session -> footer/menu -> counters -> search ->
   * rates). Locally that is invisible; against Turso each stage is a network
   * round-trip, so the shell alone cost ~5 RTTs *before* the page itself began.
   *
   * The site-wide, user-independent reads are all cached (`unstable_cache`,
   * tag "catalog"), so on a warm cache they cost nothing at all. Starting them
   * together with the session lookup means the uncached path is a single hop.
   */
  const shellData = Promise.all([
    footerNav(),
    homeCategories(),
    getBlocks(),
    one<{ value: string }>(`SELECT value FROM settings WHERE key='site_name'`),
    navMenu(),
    getRates(),
  ]);

  const [u, [footerCols, footerCats, blocks, siteRow, menu, rates]] =
    await Promise.all([getSessionUser(), shellData]);
  const footerServices = footerCats.slice(0, 4).map((c) => ({
    slug: c.slug,
    name: c.name,
    blurb: c.blurb ?? "",
    icon: c.icon ?? c.slug,
  }));
  const footerBlurb = blocks.hero?.body ?? "";

  // Marquee copy comes from the `announcement_bar` CMS block. Each list row
  // contributes one message; the title is used when no rows are set.
  const ann = blocks.announcement_bar;
  const marquee = (
    ann?.active !== false
      ? [
          ...(ann?.items ?? [])
            .map((i) => String(i.text ?? i.label ?? i.t ?? ""))
            .filter(Boolean),
          ...(ann?.title ? [ann.title] : []),
        ]
      : []
  ).slice(0, 8);
  const siteName = siteRow?.value?.trim() || "G2X.GG";

  let cartCount = 0;
  let notifications: HeaderNotif[] = [];
  let unread = 0;

  if (u) {
    const [c, n, ur] = await Promise.all([
      one<{ n: number }>(`SELECT COALESCE(SUM(qty),0) AS n FROM cart_items WHERE user_id=?`, [u.id]),
      all<{ id: string; title: string; body: string | null; href: string | null; created_at: string; read_flag: number }>(
        `SELECT id,title,body,href,created_at,read_flag FROM notifications
          WHERE user_id=? ORDER BY created_at DESC LIMIT 8`,
        [u.id]
      ),
      one<{ n: number }>(
        `SELECT COUNT(*) AS n FROM notifications WHERE user_id=? AND read_flag=0`,
        [u.id]
      ),
    ]);
    cartCount = Number(c?.n ?? 0);
    unread = Number(ur?.n ?? 0);
    notifications = n.map((x) => ({
      id: x.id,
      title: x.title,
      body: x.body,
      href: x.href,
      at: x.created_at,
      read: x.read_flag === 1,
    }));
  }

  const { lang, currency } = getLocale();

  return (
    <LocaleProvider lang={lang} currency={currency} dict={dictFor(lang)} rates={rates}>
    <div className="min-h-screen">
      <Header
        user={
          u
            ? {
                id: u.id,
                name: u.name,
                username: u.username,
                email: u.email,
                avatar: u.avatar,
                isSeller: u.isSeller,
                sellerStatus: u.sellerStatus ?? null,
                balance: u.balance,
              }
            : null
        }
        cartCount={cartCount}
        notifications={notifications}
        unread={unread}
        marquee={marquee}
        navMenu={menu}
      />
      <WishlistProvider>{children}</WishlistProvider>
      <Footer
        cols={footerCols}
        services={footerServices}
        blurb={footerBlurb}
        siteName={siteName}
      />
      <LiveSupport />
    </div>
    </LocaleProvider>
  );
}
