import { requireUser } from "@/lib/session";
import { getThreads, getMessages } from "@/lib/queries";
import MessagesView from "@/components/dash/MessagesView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Messages — G2X.GG" };

export default async function Page({ searchParams }: { searchParams: { t?: string } }) {
  const u = await requireUser();
  const threads = (await getThreads(u.id)) as { id: string; buyer_id: string }[];
  /**
   * Only open a thread when one is explicitly requested. Auto-selecting the
   * first thread would land mobile users straight in a conversation with no
   * way back to the list, since on small screens the two panes are separate
   * screens rather than a sidebar.
   */
  const active = searchParams.t && threads.some((t) => t.id === searchParams.t)
    ? searchParams.t
    : undefined;
  const messages = active ? await getMessages(active) : [];

  /**
   * A thread has one buyer and one seller. Whoever is NOT the buyer is the
   * seller here, and only the buyer may open or close a dispute — letting a
   * seller close a dispute filed against them would defeat the purpose.
   */
  const activeThread = active ? threads.find((t) => t.id === active) : undefined;
  const isSeller = !!activeThread && activeThread.buyer_id !== u.id;
  return (
    <MessagesView
      me={u.id}
      threads={threads as never}
      activeId={active ?? null}
      messages={messages as never}
      isSeller={isSeller}
    />
  );
}
