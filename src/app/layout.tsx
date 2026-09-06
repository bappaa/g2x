import type { Metadata } from "next";
import { all } from "@/lib/db";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

/**
 * SEO title/description are admin-managed via System Settings
 * (`seo_title`, `seo_description`, falling back to `site_name`).
 */
export async function generateMetadata(): Promise<Metadata> {
  const rows = await all<{ key: string; value: string }>(
    `SELECT key, value FROM settings WHERE key IN ('site_name','seo_title','seo_description')`
  ).catch(() => []);
  const get = (k: string) => rows.find((r) => r.key === k)?.value?.trim() || "";

  const name = get("site_name") || "G2X.GG";
  return {
    title: get("seo_title") || name,
    description: get("seo_description") || `${name} — a trusted gaming marketplace.`,
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
