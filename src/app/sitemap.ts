import type { MetadataRoute } from "next";
import { all } from "@/lib/db";

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://g2x.gg").replace(/\/+$/, "");

/**
 * Sitemap built from the live catalog: categories, games and CMS pages.
 * Wrapped in catch() so a database hiccup degrades to the static routes
 * instead of failing the build.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const [cats, games] = await Promise.all([
    all<{ slug: string }>(`SELECT slug FROM categories WHERE status='active'`).catch(() => []),
    all<{ slug: string }>(`SELECT slug FROM games WHERE status='active'`).catch(() => []),
  ]);

  // Static content pages live in `src/app/(site)/p/[slug]/page.tsx`.
  const pages = [
    "about-us", "how-it-works", "buyer-protection", "terms", "privacy",
    "refund-policy", "dispute-policy", "cookie-policy", "dmca",
    "seller-rules", "fees", "contact",
  ].map((slug) => ({ slug }));

  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    ...cats.map((c) => ({
      url: `${SITE_URL}/c/${c.slug}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.9,
    })),
    ...games.map((g) => ({
      url: `${SITE_URL}/g/${g.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...pages.map((p) => ({
      url: `${SITE_URL}/p/${p.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.4,
    })),
  ];
}
