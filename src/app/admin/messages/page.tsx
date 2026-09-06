import { requireAdmin } from "@/lib/admin";
import { adminThreads, adminThreadMessages, adminFlaggedMessages } from "@/lib/queries-admin";
import { AdminPage } from "@/components/admin/ui";
import ChatMonitor from "@/components/admin/ChatMonitor";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: { thread?: string; view?: string; q?: string };
}) {
  await requireAdmin("messages");
  const view = searchParams.view ?? "flagged";
  const threads = await adminThreads({
    flaggedOnly: view === "flagged",
    q: searchParams.q,
  });
  const activeId = searchParams.thread ?? (threads[0] as { id?: string } | undefined)?.id ?? "";
  const [messages, flagged] = await Promise.all([
    activeId ? adminThreadMessages(activeId) : Promise.resolve([]),
    adminFlaggedMessages(60),
  ]);

  return (
    <AdminPage
      title="Messages"
      sub="Read every buyer↔seller conversation. Contact details and off-platform payment attempts are auto-flagged."
    >
      <ChatMonitor
        threads={threads as never}
        messages={messages as never}
        flagged={flagged as never}
        activeId={activeId}
        view={view}
        q={searchParams.q ?? ""}
      />
    </AdminPage>
  );
}
