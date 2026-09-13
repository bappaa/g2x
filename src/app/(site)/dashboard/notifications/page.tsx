import TimeAgo from "@/components/TimeAgo";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getNotifications } from "@/lib/queries";
import { Empty } from "@/components/ui";

import { Bell, Package, Wallet, Gavel, Info } from "lucide-react";
import MarkRead from "@/components/dash/MarkRead";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notifications — G2X.GG" };

type N = { id: string; title: string; body: string; href: string; kind: string; read_flag: number; created_at: string };
const ICONS: Record<string, typeof Bell> = { order: Package, wallet: Wallet, dispute: Gavel, system: Info };

export default async function Page() {
  const u = await requireUser();
  const list = (await getNotifications(u.id)) as N[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[18px] font-black sm:text-[22px] tracking-tight">Notifications</h1>
        <MarkRead />
      </div>
      {list.length === 0 ? (
        <Empty title="No notifications" sub="Order updates and wallet activity will show up here." />
      ) : (
        <div className="space-y-2">
          {list.map((n) => {
            const Icon = ICONS[n.kind] ?? Bell;
            return (
              <Link
                key={n.id}
                href={n.href || "/dashboard"}
                className={`flex gap-3 rounded-2xl panel p-4 transition-all hover:-translate-y-0.5 ${
                  n.read_flag ? "" : "border-brand-500/40"
                }`}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-600/15 text-brand-400">
                  <Icon size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-bold">{n.title}</div>
                  <div className="text-[11.5px] muted">{n.body}</div>
                  <div className="mt-1 text-[10.5px] muted"><TimeAgo at={n.created_at} /></div>
                </div>
                {!n.read_flag && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
