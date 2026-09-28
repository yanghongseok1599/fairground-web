"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { canRefreshApp, hasOpenEditor } from "@/features/app-updates/safe-refresh";

/** Refresh stale read-only app shells, while protecting active match entry/forms. */
export function SwRegister() {
  const pathname = usePathname();
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let disposed = false;
    let reloaded = false;
    let registration: ServiceWorkerRegistration | undefined;
    let lastCheck = 0;
    const hadController = !!navigator.serviceWorker.controller;
    const safe = () => canRefreshApp(window.location.pathname) && !hasOpenEditor(document);
    const reload = () => {
      if (!reloaded && safe()) { reloaded = true; window.location.reload(); }
    };
    const activate = () => {
      if (!disposed && safe()) registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
    };
    const update = () => {
      if (disposed || document.visibilityState === "hidden") return;
      activate();
      if (!registration || Date.now() - lastCheck < 60_000) return;
      lastCheck = Date.now();
      void registration.update().then(activate).catch(() => { /* Offline: retain current page. */ });
    };
    const onShow = (event: PageTransitionEvent) => { if (event.persisted) reload(); update(); };
    const onControllerChange = () => { if (hadController) reload(); };
    const onStateChange = () => activate();
    const installing = new Set<ServiceWorker>();
    const onUpdateFound = () => {
      const worker = registration?.installing;
      if (worker) { installing.add(worker); worker.addEventListener("statechange", onStateChange); }
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    window.addEventListener("pageshow", onShow);
    window.addEventListener("online", update);
    document.addEventListener("visibilitychange", update);
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then(reg => {
        if (disposed) return;
        registration = reg;
        reg.addEventListener("updatefound", onUpdateFound);
        onUpdateFound(); update();
      }).catch(err => console.warn("[sw] registration failed", err));
    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      window.removeEventListener("pageshow", onShow);
      window.removeEventListener("online", update);
      document.removeEventListener("visibilitychange", update);
      registration?.removeEventListener("updatefound", onUpdateFound);
      for (const worker of installing) worker.removeEventListener("statechange", onStateChange);
    };
  }, [pathname]);
  return null;
}
