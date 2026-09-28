"use client";

import { useEffect } from "react";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/hooks/useAuth";
import { NOTIFICATION_INBOX_CHANGED } from "@/lib/notifications/inbox-events";

/** 본인 알림함을 갱신한다. 휴대폰 알림은 Web Push에서 한 번만 표시한다. */
export function NotificationRealtime() {
  const { player } = useAuth();
  useEffect(() => {
    if (!player?.id) return;
    const ch = supabase
      .channel(`notif-${player.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${player.id}`,
        },
        () => {
          window.dispatchEvent(new Event(NOTIFICATION_INBOX_CHANGED));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [player?.id]);
  return null;
}
