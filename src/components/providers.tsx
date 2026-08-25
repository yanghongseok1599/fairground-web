"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { NotificationRealtime } from "@/components/notification-realtime";
import { InAppBanner } from "@/components/in-app-banner";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { PushOptInPrompt } from "@/components/push-opt-in-prompt";

export function Providers({ children }: { children: React.ReactNode }) {
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    const unsubscribe = init();
    return unsubscribe;
  }, [init]);

  return (
    <>
      <InAppBanner />
      <NotificationRealtime />
      <PwaInstallPrompt />
      <PushOptInPrompt />
      {children}
    </>
  );
}
