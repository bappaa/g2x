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
import { unstable_cache } from "next/cache";

const getAnnouncementsCached = unstable_cache(
  async () => {
    try {
      return await all<{ title: string; body: string | null }>(`SELECT title, body FROM announcements WHERE active=1 ORDER BY created_at DESC LIMIT 5`);
    } catch {
      return [] as { title: string; body: string | null }[];
    }
  },
  ["announcements-active"],
  { tags: ["catalog", "announcements"], revalidate: 120 }
);

export default async function SiteShell({ children }: { children: React.ReactNode }) {
  const shellData = Promise.all([
    footerNav(),
    homeCategories(),
    getBlocks(),
    one<{ value: string }>(`SELECT value FROM settings WHERE key='site_name'`),
    navMenu(),
    getRates(),
    getAnnouncementsCached(),
  ]);

  const [u, [footerCols, footerCats, blocks, siteRow, menu, rates, promoAnns]] =
    await Promise.all([getSessionUser(), shellData]);
  const footerServices = footerCats.slice(0, 4).map((c) => ({
    slug: c.slug,
    name: c.name,
    blurb: c.blurb ?? "",
    icon: c.icon ?? c.slug,
  }));
  const footerBlurb = blocks.hero?.body ?? "";

  const ann = blocks.announcement_bar;
  const cmsMarquee = (
    ann?.active !== false
      ? [
          ...(ann?.items ?? [])
            .map((i) => String(i.text ?? i.label ?? i.t ?? ""))
            .filter(Boolean),
          ...(ann?.title ? [ann.title] : []),
        ]
      : []
  );
  const promoMarquee = (promoAnns as { title: string; body: string | null }[]).map((a) => a.title || a.body || "").filter(Boolean);
  const marquee = [...cmsMarquee, ...promoMarquee].slice(0, 8);
  const siteName = siteRow?.value?.trim() || "G2X.GG";

  let cartCount = 0;
  let notifications: HeaderNotif[] = [];
  let unread = 0;
  let msgUnread = 0;

  if (u) {
    const [c, n, ur, mr] = await Promise.all([
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
      one<{ n: number }>(
        `SELECT COUNT(*) AS n FROM messages m JOIN threads t ON t.id=m.thread_id WHERE (t.buyer_id=? OR t.seller_id=?) AND m.sender_id<>? AND m.read_flag=0`,
        [u.id, u.id, u.id]
      ),
    ]);
    cartCount = Number(c?.n ?? 0);
    unread = Number(ur?.n ?? 0);
    msgUnread = Number(mr?.n ?? 0);
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
        msgUnread={msgUnread}
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
