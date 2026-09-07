import Link from "next/link";
import Image from "next/image";
import { requireUser } from "@/lib/session";
import { getPurchased } from "@/lib/queries";
import { Empty, Btn, Tag } from "@/components/ui";
import { statusTone, label } from "@/lib/fmt";
import Credentials from "@/components/dash/Credentials";

export const dynamic = "force-dynamic";
export const metadata = { title: "Purchased Products — G2X.GG" };

type P = {
  id: string; code: string; title: string; subtitle: string; image: string; href: string;
  store_name: string; line_total: number; qty: number; status: string; created_at: string;
  credentials: string | null;
};

import { serverLocale } from "@/lib/locale";
import LocalTime from "@/components/LocalTime";
import { img } from "@/lib/img";

export default async function Page() {
  const { money } = await serverLocale();
  const u = await requireUser();
  const items = (await getPurchased(u.id)) as P[];

  return (
    <div className="space-y-4">
      <h1 className="text-[18px] font-black sm:text-[22px] tracking-tight">Purchased Products</h1>
      {items.length === 0 ? (
        <Empty
          title="Nothing delivered yet"
          sub="Delivered keys, accounts and top-ups appear here with their details."
          action={<Link href="/"><Btn>Browse marketplace</Btn></Link>}
        />
      ) : (
        <div className="space-y-3">
          {items.map((it) => (
            <div key={it.id} className="rounded-2xl panel p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg soft">
                  <Image src={img(it.image)} alt="" fill sizes="48px" className="object-cover" />
                </div>
                <div className="min-w-[160px] flex-1">
                  <Link href={it.href || "#"} className="line-clamp-1 text-[13px] font-bold hover:text-brand-500">
                    {it.title}
                  </Link>
                  <div className="text-[11px] muted">
                    {it.subtitle} · {it.store_name} · ×{it.qty}
                  </div>
                  <Link href={`/dashboard/orders/${it.code}`} className="text-[10.5px] text-brand-400 hover:underline">
                    {it.code} · <LocalTime at={it.created_at} />
                  </Link>
                </div>
                <Tag tone={statusTone(it.status)}>{label(it.status)}</Tag>
                <div className="text-[14px] font-black text-brand-500">{money(it.line_total)}</div>
              </div>
              {it.credentials && <Credentials id={it.id} json={it.credentials} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
