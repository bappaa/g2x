import { requireUser } from "@/lib/session";
import { getThreads, getMessages } from "@/lib/queries";
import MessagesView from "@/components/dash/MessagesView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Seller Messages — G2X.GG" };

export default async function Page({ searchParams }: { searchParams: { t?: string } }) {
  const u = await requireUser();
  const threads = (await getThreads(u.id)) as { id: string; buyer_id: string }[];
  const active = searchParams.t && threads.some((t) => t.id === searchParams.t)
    ? searchParams.t
    : undefined;
  const messages = active ? await getMessages(active) : [];
  const activeThread = active ? threads.find((t) => t.id === active) : undefined;
  const isSeller = !!activeThread && activeThread.buyer_id !== u.id;

  return (
    <div className="space-y-4">
      <h1 className="text-[18px] font-black tracking-tight sm:text-[22px]">Messages</h1>
      <p className="text-[12px] muted">Chat with buyers about manual delivery, disputes, and order details.</p>
      <MessagesView
        me={u.id}
        threads={threads as never}
        activeId={active ?? null}
        messages={messages as never}
        isSeller={isSeller}
      />
    </div>
  );
}
