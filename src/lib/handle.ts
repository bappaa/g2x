/**
 * PUBLIC IDENTITY
 * ===============
 * Buyers are identified by their **user ID / handle**, never by their real
 * name. A marketplace shows a buyer's identity to sellers, to admins in chat
 * monitoring and on every order — leaking "Aman Verma" there is a privacy
 * problem and it is not what the client wants displayed.
 *
 * `username` is assigned at signup (`<word>_<3 digits>`) and is guaranteed
 * unique, so it is always safe to show. The fallbacks only ever fire on legacy
 * rows written before usernames existed.
 */

export type HasHandle = {
  username?: string | null;
  name?: string | null;
  id?: string | null;
};

/** `@handle` for display. Never returns a person's real name. */
export function handle(u: HasHandle | null | undefined): string {
  const h = u?.username?.trim();
  if (h) return "@" + h.replace(/^@+/, "");
  // Legacy row with no username: fall back to a stable, non-identifying id.
  const id = u?.id?.trim();
  if (id) return "@user_" + id.slice(-6);
  return "@user";
}

/** Bare handle without the leading @ — for avatars and initials. */
export function handleRaw(u: HasHandle | null | undefined): string {
  return handle(u).slice(1);
}

/** First character for an avatar bubble. */
export function handleInitial(u: HasHandle | null | undefined): string {
  return handleRaw(u).slice(0, 1).toUpperCase();
}
