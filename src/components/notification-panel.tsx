"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useDataStore } from "@/stores/dataStore";
import type { NotificationItem } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onAllRead?: () => void;
}

function targetHref(n: NotificationItem): string {
  // 댓글 알림: 부모 글로 점프 + 댓글 해시
  if (n.postId && n.commentId) return `/board/${n.postId}#cm-${n.commentId}`;
  if (n.postId) return `/board/${n.postId}`;
  if (n.kind === "team_notice" && n.teamId) return `/teams/${n.teamId}/notices`;
  if (n.kind === "tier_promoted") return `/my`;
  if (n.kind === "coach_approved") return `/my`;
  if (n.kind === "player_approved") return n.teamId ? `/teams/${n.teamId}` : `/my`;
  if (n.kind === "team_role_changed") return n.teamId ? `/teams/${n.teamId}` : `/my`;
  if (n.kind === "match_ready" && n.matchId) return `/matches/${n.matchId}`;
  if (n.teamId) return `/teams/${n.teamId}`;
  return "/";
}

function relTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  return `${d}일 전`;
}

export function NotificationPanel({ open, onClose, onAllRead }: Props) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const fetchN = useDataStore((s) => s.fetchNotifications);
  const markRead = useDataStore((s) => s.markNotificationRead);
  const markAll = useDataStore((s) => s.markAllNotificationsRead);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const r = await fetchN({ unreadOnly: true, limit: 20 });
      if (!cancelled) setItems(r);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, fetchN]);

  if (!open) return null;
  return (
    <div
      className="absolute right-0 top-12 z-40 w-[320px] max-w-[92vw] rounded-md border shadow-lg"
      style={{ background: "var(--color-fg-paper)", borderColor: "var(--color-fg-line-soft)" }}
      role="dialog"
      aria-label="알림"
    >
      <div
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: "var(--color-fg-line-soft)" }}
      >
        <span className="fg-display text-sm" style={{ color: "var(--color-fg-ink)" }}>
          알림
        </span>
        <button
          type="button"
          disabled={isMarkingAllRead || items.length === 0}
          onClick={async () => {
            if (isMarkingAllRead || items.length === 0) return;
            setIsMarkingAllRead(true);
            try {
              await markAll();
              setItems([]);
              onAllRead?.();
            } catch (error) {
              console.error("[NotificationPanel] markAll:", error);
            } finally {
              setIsMarkingAllRead(false);
            }
          }}
          className="text-xs disabled:cursor-not-allowed disabled:opacity-40"
          style={{ color: "var(--primary)" }}
        >
          모두 읽음
        </button>
      </div>
      <ul className="max-h-[60vh] overflow-auto py-1">
        {items.length === 0 ? (
          <li
            className="px-4 py-8 text-center text-sm"
            style={{ color: "var(--color-fg-ink-muted)" }}
          >
            아직 알림이 없습니다
          </li>
        ) : (
          items.map((n) => (
            <li key={n.id}>
              <Link
                href={targetHref(n)}
                onClick={async () => {
                  if (!n.readAt) await markRead(n.id);
                  onClose();
                }}
                className="block px-4 py-3 transition-colors hover:bg-[color:var(--color-fg-paper-3,#EEF3FF)]"
                style={{
                  background: n.readAt
                    ? "transparent"
                    : "color-mix(in srgb, var(--primary) 6%, transparent)",
                }}
              >
                <div
                  className="text-sm font-semibold"
                  style={{ color: "var(--color-fg-ink)" }}
                >
                  {n.title}
                </div>
                {n.snippet && (
                  <div
                    className="mt-1 line-clamp-2 text-xs"
                    style={{ color: "var(--color-fg-ink-muted)" }}
                  >
                    {n.snippet}
                  </div>
                )}
                <div
                  className="mt-1 text-[11px]"
                  style={{ color: "var(--color-fg-ink-muted)" }}
                >
                  {relTime(n.createdAt)}
                </div>
              </Link>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
