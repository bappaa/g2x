"use client";
import { createContext, useContext, useEffect, useState } from "react";

/**
 * Loads the current user's wishlist once per page and shares it with every
 * ProductCard. Keeping this out of the server render is what allows catalog
 * pages to be statically cached and navigate instantly.
 */
const Ctx = createContext<{ ids: Set<string>; ready: boolean; signedIn: boolean }>({
  ids: new Set(),
  ready: false,
  signedIn: false,
});

export const useWishlist = () => useContext(Ctx);

let cache: Set<string> | null = null;
let authCache = false;

export default function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [ids, setIds] = useState<Set<string>>(cache ?? new Set());
  const [ready, setReady] = useState(cache !== null);
  const [signedIn, setSignedIn] = useState(authCache);

  useEffect(() => {
    if (cache) return;
    let alive = true;
    fetch("/api/wishlist")
      .then((r) => (r.ok ? r.json() : { ids: [], signedIn: false }))
      .then((d: { ids: string[]; signedIn?: boolean }) => {
        if (!alive) return;
        cache = new Set(d.ids);
        authCache = !!d.signedIn;
        setIds(cache);
        setSignedIn(authCache);
        setReady(true);
      })
      .catch(() => setReady(true));
    return () => {
      alive = false;
    };
  }, []);

  return <Ctx.Provider value={{ ids, ready, signedIn }}>{children}</Ctx.Provider>;
}
