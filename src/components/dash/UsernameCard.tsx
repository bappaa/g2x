"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AtSign, Loader2, Check, Info } from "lucide-react";
import { Btn, inputCls } from "@/components/ui";
import { changeUsernameAction } from "@/lib/actions/auth";
import { useMoney } from "@/components/LocaleProvider";

/**
 * Public username editor.
 *
 * Every account is given a random handle at sign-up (e.g. `unicorn_256`) and
 * can rename it here. The first two changes are free; after that the admin's
 * `username_change_fee` is charged to the wallet.
 *
 * The rules are validated live so the user learns why a handle is rejected
 * while typing, instead of after a round-trip. The server re-validates
 * everything — this is purely for feedback.
 */
export default function UsernameCard({
  username,
  changesUsed,
  freeChanges,
  fee,
  balance,
}: {
  username: string;
  changesUsed: number;
  freeChanges: number;
  fee: number;
  balance: number;
}) {
  const money = useMoney();
  const router = useRouter();
  const [value, setValue] = useState(username);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  const remaining = Math.max(0, freeChanges - changesUsed);
  const willCharge = remaining === 0 && fee > 0;
  const changed = value.trim().toLowerCase() !== username.toLowerCase();

  /** Mirrors the server rules in src/lib/username.ts. */
  const localError = (() => {
    const v = value.trim();
    if (!v) return "Choose a username.";
    if (/\s/.test(v)) return "Usernames cannot contain spaces.";
    if (v.length < 5) return "Must be at least 5 characters.";
    if (v.length > 15) return "Must be 15 characters or fewer.";
    if (!/^[A-Za-z0-9_]+$/.test(v)) return "Letters, numbers and underscores only.";
    return "";
  })();

  const submit = () => {
    setMsg("");
    setErr("");
    if (localError) return setErr(localError);
    if (willCharge && balance < fee)
      return setErr(
        `This change costs ${money(fee)} but your wallet has ${money(balance)}. Top up first.`
      );

    start(async () => {
      const r = await changeUsernameAction(value.trim());
      if (!r.ok) return setErr(r.error || "Could not change your username.");
      setMsg(
        willCharge
          ? `Username updated. ${money(fee)} was deducted from your wallet.`
          : "Username updated."
      );
      router.refresh();
    });
  };

  return (
    <div className="rounded-2xl panel p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <AtSign size={15} className="text-brand-400" />
        <h3 className="text-[14px] font-bold">Username</h3>
      </div>
      <p className="mt-1 text-[11.5px] muted">
        This is how other members see you. It must be unique across G2X.
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] muted">
            @
          </span>
          <input
            className={`${inputCls} pl-7`}
            value={value}
            spellCheck={false}
            autoCapitalize="none"
            maxLength={15}
            onChange={(e) => setValue(e.target.value.replace(/\s/g, ""))}
            placeholder="unicorn_256"
          />
        </div>
        <Btn
          className="flex items-center justify-center gap-2 sm:w-auto sm:px-5"
          disabled={pending || !changed}
          onClick={submit}
        >
          {pending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          Save
        </Btn>
      </div>

      {changed && localError && (
        <div className="mt-2 text-[11px] text-amber-400">{localError}</div>
      )}

      <div className="mt-3 flex items-start gap-2 rounded-lg soft px-3 py-2 text-[11px]">
        <Info size={12} className="mt-px shrink-0 text-brand-400" />
        <span className="muted">
          {remaining > 0 ? (
            <>
              You have <b>{remaining}</b> free username change{remaining === 1 ? "" : "s"} left.
              {fee > 0 && <> After that each change costs ${fee.toFixed(2)}.</>}
            </>
          ) : fee > 0 ? (
            <>
              You have used your {freeChanges} free changes. Each further change costs{" "}
              <b>${fee.toFixed(2)}</b>, taken from your wallet (balance ${balance.toFixed(2)}).
            </>
          ) : (
            <>You have used your {freeChanges} free changes, but renames are currently free.</>
          )}
        </span>
      </div>

      {msg && (
        <div className="mt-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-[11.5px] text-emerald-400">
          {msg}
        </div>
      )}
      {err && (
        <div className="mt-2 rounded-lg bg-rose-500/10 px-3 py-2 text-[11.5px] text-rose-400">
          {err}
        </div>
      )}
    </div>
  );
}
