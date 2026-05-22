"use client";

import React, { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useDataStore } from "@/stores/dataStore";
import { NotificationPanel } from "@/components/notification-panel";

export function NotificationBell() {
  const { player } = useAuth();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const fetchCount = useDataStore((s) => s.fetchUnreadNotificationCount);

  useEffect(() => {
    if (!player?.id) {
      setUnread(0);
      return;
    }
    let cancelled = false;
    (async () => {
      const c = await fetchCount();
      if (!cancelled) setUnread(c);
    })();
    return () => {
      cancelled = true;
    };
  }, [player?.id, fetchCount, open]);

  if (!player?.id) return null;
  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`알림 ${unread}개`}
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-10 w-10 items-center justify-center rounded-md hover:bg-[color:var(--color-fg-paper-3,#EEF3FF)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ outlineColor: "var(--color-ring)" }}
      >
        <Bell width={20} height={20} style={{ color: "var(--color-fg-ink)" }} />
        {unread > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold"
            style={{
              background: "var(--primary)",
              color: "var(--primary-foreground, #fff)",
            }}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      <NotificationPanel open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
