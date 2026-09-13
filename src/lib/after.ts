import "server-only";

/**
 * BACKGROUND WORK IN A SERVERLESS FUNCTION
 * ========================================
 * Escrow sweeps, media purging and FX refreshes are deliberately fire-and-
 * forget: a page render must not wait on housekeeping.
 *
 * The catch is that a serverless container is frozen (or destroyed) the moment
 * the response finishes. Any query still in flight is cut off mid-socket, which
 * is what surfaced in production as:
 *
 *     Error: Connection closed.
 *         at t (2117-….js)
 *
 * The work itself was harmless — the *error* was noise from a task that never
 * got to finish, and it aborted the RSC stream the client was still reading.
 *
 * `runAfter` keeps the fire-and-forget ergonomics but makes the failure mode
 * safe:
 *   - `waitUntil` is used when the platform provides it (Netlify and Vercel
 *     both do), which keeps the container alive until the task settles;
 *   - otherwise the task is bounded by a timeout and every error is swallowed,
 *     so a frozen container can never surface an unhandled rejection;
 *   - a task is never started during prerender/build, where there is no request
 *     to attach to.
 */

type WaitUntil = (p: Promise<unknown>) => void;

/** Netlify/Vercel expose waitUntil on a request-scoped global. */
function platformWaitUntil(): WaitUntil | null {
  const g = globalThis as unknown as {
    waitUntil?: WaitUntil;
    [k: symbol]: unknown;
  };
  if (typeof g.waitUntil === "function") return g.waitUntil.bind(g);

  // Next stores the request context under a well-known symbol.
  try {
    const sym = Symbol.for("@next/request-context");
    const ctx = (globalThis as unknown as Record<symbol, unknown>)[sym] as
      | { get?: () => { waitUntil?: WaitUntil } | undefined }
      | undefined;
    const w = ctx?.get?.()?.waitUntil;
    if (typeof w === "function") return w;
  } catch {
    /* not available — fall through */
  }
  return null;
}

/**
 * Run a background task without blocking the response.
 * Never throws, never rejects, and never leaves an unhandled promise.
 */
export function runAfter(task: () => Promise<unknown>, timeoutMs = 8000): void {
  // No background work while building/prerendering.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const guarded = (async () => {
    try {
      await Promise.race([
        task(),
        new Promise((resolve) => setTimeout(resolve, timeoutMs)),
      ]);
    } catch {
      /* housekeeping must never surface to the request */
    }
  })();

  const waitUntil = platformWaitUntil();
  if (waitUntil) {
    waitUntil(guarded);
    return;
  }
  // No platform hook (local `next start`): just make sure it cannot reject.
  void guarded.catch(() => null);
}
