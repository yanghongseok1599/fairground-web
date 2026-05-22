"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { NotificationRealtime } from "@/components/notification-realtime";

export function Providers({ children }: { children: React.ReactNode }) {
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    const unsubscribe = init();
    return unsubscribe;
  }, [init]);

  return (
    <>
      <NotificationRealtime />
      {children}
    </>
  );
}
