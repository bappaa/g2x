import Link from "next/link";
import { requireSeller } from "@/lib/session";
import { all } from "@/lib/db";
import { CategoryIcon } from "@/components/CategoryIcon";
import { SellHeader } from "@/components/seller/SellWizard";
import { CATEGORY_ORDER } from "@/lib/homepage";

export const dynamic = "force-dynamic";

/** Step 1 of the sell flow — which kind of thing are you selling? */
export default async function Page() {
  await requireSeller();
  const cats = await all<{ slug: string; name: string; blurb: string; icon: string }>(
    `SELECT slug, name, blurb, icon FROM categories WHERE status='active'`
  );

  const order = (s: string) => {
    const i = (CATEGORY_ORDER as readonly string[]).indexOf(s);
    return i < 0 ? 99 : i;
  };
  cats.sort((a, b) => order(a.slug) - order(b.slug) || a.name.localeCompare(b.name));

  return (
    <div>
      <SellHeader title="What are you selling?" step="Step 1/3" />
      <div className="mx-auto grid max-w-[720px] grid-cols-2 gap-3 sm:grid-cols-3">
        {cats.map((c) => (
          <Link
            key={c.slug}
            href={`/seller/sell/${c.slug}`}
            className="group flex flex-col items-center justify-center rounded-2xl panel px-3 py-6 text-center transition-all hover:-translate-y-1 hover:border-brand-500/60"
          >
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-white/[.04] transition-transform group-hover:scale-110">
              <CategoryIcon name={c.icon} slug={c.slug} size={24} />
            </span>
            <span className="mt-2.5 text-[13px] font-bold">{c.name}</span>
            <span className="mt-0.5 text-[10.5px] muted">{c.blurb}</span>
          </Link>
        ))}
      </div>
      <div className="mt-5 text-center">
        <Link
          href="/seller/offers"
          className="inline-block rounded-xl soft px-5 py-2.5 text-[12.5px] font-semibold transition-colors hover:bg-brand-600/10"
        >
          Back to My Offers
        </Link>
      </div>
    </div>
  );
}
