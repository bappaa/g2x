import type { Metadata } from "next";
import { all } from "@/lib/db";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

/** Canonical origin. Must be the exact production URL, no trailing slash. */
const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://g2x.gg").replace(/\/+$/, "");

/**
 * SEO title/description are admin-managed via System Settings
 * (`seo_title`, `seo_description`, falling back to `site_name`).
 *
 * The defaults below matter: an unseeded database used to yield the bare title
 * "G2X.GG" with a generic description, which is what Google was indexing.
 */
export async function generateMetadata(): Promise<Metadata> {
  const rows = await all<{ key: string; value: string }>(
    `SELECT key, value FROM settings WHERE key IN ('site_name','seo_title','seo_description')`
  ).catch(() => []);
  const get = (k: string) => rows.find((r) => r.key === k)?.value?.trim() || "";

  const name = get("site_name") || "G2X.GG";
  const title = get("seo_title") || `${name} — Buy & Sell Game Accounts, Coins, Top-Ups & Items`;
  const description =
    get("seo_description") ||
    "G2X.GG is a trusted gaming marketplace to buy and sell game accounts, currency, " +
      "in-game items, top-ups, subscriptions and boosting services. Instant delivery, " +
      "escrow-protected payments and 24/7 support.";

  return {
    metadataBase: new URL(SITE_URL),
    // "%s | G2X.GG" keeps the brand in every tab and every search result.
    title: { default: title, template: `%s | ${name}` },
    description,
    applicationName: name,
    keywords: [
      "gaming marketplace", "buy game accounts", "sell game accounts",
      "game top up", "in-game currency", "game items", "game boosting",
      "cheap game credits", name,
    ],
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      url: SITE_URL,
      siteName: name,
      title,
      description,
      locale: "en_US",
    },
    twitter: { card: "summary_large_image", title, description },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large" },
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const rows = await all<{ key: string; value: string }>(
    `SELECT key, value FROM settings WHERE key IN ('site_name','seo_description')`
  ).catch(() => []);
  const get = (k: string) => rows.find((r) => r.key === k)?.value?.trim() || "";
  const name = get("site_name") || "G2X.GG";
  const description =
    get("seo_description") ||
    "Buy and sell game accounts, currency, items, top-ups, subscriptions and boosting on a trusted, escrow-protected marketplace.";

  /**
   * Structured data. `WebSite.name` + `alternateName` is what Google uses to
   * pick the bold site name above a result, and `SearchAction` enables the
   * sitelinks search box. Organization carries the brand for the knowledge
   * panel. Injected as JSON-LD because Next metadata has no field for it.
   */
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name,
      alternateName: ["G2X", "G2X GG", "g2x.gg"],
      description,
      publisher: { "@id": `${SITE_URL}/#organization` },
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/search?q={search_term_string}` },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name,
      alternateName: "G2X",
      url: `${SITE_URL}/`,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/art/placeholder.png` },
      description,
    },
  ];

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        {/*
          Apply the saved theme before first paint.
          The server always renders `class="dark"`, and the Header only reads
          localStorage after hydration — so a light-theme visitor saw a dark
          flash on every navigation. This runs synchronously in <head>, before
          the browser paints anything, so the correct theme (and the matching
          `color-scheme` for native dropdowns) is right from frame one.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("g2x.theme");if(t==="light"){document.documentElement.classList.remove("dark")}}catch(e){}})();`,
          }}
        />
      </head>
      <body className={inter.className}>
        <script
          type="application/ld+json"
          // Static, server-built object — no user input is interpolated.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
