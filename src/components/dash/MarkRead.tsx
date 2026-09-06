"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { markNotificationsReadAction } from "@/lib/actions/shop";

export default function MarkRead() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() =>
        start(async () => {
          await markNotificationsReadAction();
          router.refresh();
        })
      }
      className="flex items-center gap-1.5 rounded-lg soft px-3 py-1.5 text-[11.5px] muted transition-colors hover:text-brand-400"
    >
      <CheckCheck size={13} /> Mark all as read
    </button>
  );
}
