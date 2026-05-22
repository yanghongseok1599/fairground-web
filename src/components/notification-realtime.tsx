"use client";

import { useEffect } from "react";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/hooks/useAuth";

/** 본인 알림 채널을 구독하고, 새 알림이 오면 가벼운 토스트로 알린다. */
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
        (payload) => {
          const title = (payload.new as { title?: string }).title ?? "새 알림";
          // 가벼운 native 알림 — 권한 있으면, 아니면 무시.
          if (
            typeof window !== "undefined" &&
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            new Notification(title);
          }
          // 헤더 종 카운트는 다음 open 시 재조회됨.
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [player?.id]);
  return null;
}
