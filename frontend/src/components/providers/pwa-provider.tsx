"use client";

import { useEffect } from "react";

/** Registers the service worker (offline shell + push + background sync). */
export function PwaProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    // Register after load so it doesn't compete with first paint.
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* SW registration is best-effort */
      });
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return <>{children}</>;
}
