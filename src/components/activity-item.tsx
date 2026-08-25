"use client";

import Link from "next/link";
import {
  Award,
  Calendar,
  Image as ImageIcon,
  MessageCircle,
  MessageSquare,
  Trophy,
  TrendingUp,
  UserPlus,
  Activity as ActivityIcon,
  type LucideIcon,
} from "lucide-react";
import type { ActivityEvent, ActivityKind } from "@/types";

interface Props {
  event: ActivityEvent;
}

// kind → 아이콘 매핑. lucide-react 의 Image 컴포넌트는 next/image 와 충돌하므로 alias.
const ICON_BY_KIND: Partial<Record<ActivityKind, LucideIcon>> = {
  post_created: MessageSquare,
  comment_created: MessageCircle,
  match_finished: Trophy,
  photo_uploaded: ImageIcon,
  badge_earned: Award,
  player_joined: UserPlus,
  tournament_created: Calendar,
  tier_promoted: TrendingUp,
};

// 활동 이벤트 → 가장 의미있는 상세 페이지로 라우팅.
// /matches 라우트는 없으므로 /live 로 fallback.
// /tournaments/[id] 는 존재하므로 우선 사용, 없을 때만 목록.
function targetHref(e: ActivityEvent): string {
  if (e.postId && e.commentId) return `/board/${e.postId}#cm-${e.commentId}`;
  if (e.postId) return `/board/${e.postId}`;
  if (e.matchId) return `/live`; // /matches/[id] 라우트 부재 → 라이브 페이지로 안내
  if (e.photoId && e.teamId) return `/teams/${e.teamId}/gallery`;
  if (e.badgeId && e.playerId) return `/players/${e.playerId}`;
  if (e.kind === "player_joined" && e.playerId) return `/players/${e.playerId}`;
  if (e.kind === "tier_promoted" && e.playerId) return `/players/${e.playerId}`;
  if (e.tournamentId) return `/tournaments/${e.tournamentId}`;
  if (e.teamId) return `/teams/${e.teamId}`;
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

export function ActivityItem({ event }: Props) {
  const Icon = ICON_BY_KIND[event.kind] ?? ActivityIcon;
  const href = targetHref(event);

  return (
    <li>
      <Link
        href={href}
        className="flex gap-3 px-4 py-3 rounded-lg border transition-colors hover:bg-[color:var(--color-fg-paper-3,#EEF3FF)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{
          background: "var(--color-fg-paper)",
          borderColor: "var(--color-fg-line-soft)",
          outlineColor: "var(--color-ring)",
        }}
      >
        <div
          className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full"
          style={{
            background: "color-mix(in srgb, var(--primary) 10%, transparent)",
            color: "var(--primary)",
          }}
          aria-hidden="true"
        >
          <Icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="text-sm font-semibold"
            style={{ color: "var(--color-fg-ink)" }}
          >
            {event.title}
          </div>
          {event.snippet && (
            <div
              className="mt-0.5 line-clamp-2 text-xs"
              style={{ color: "var(--color-fg-ink-muted)" }}
            >
              {event.snippet}
            </div>
          )}
          <div
            className="mt-1 text-[11px]"
            style={{ color: "var(--color-fg-ink-ghost)" }}
          >
            {event.actorName ? `${event.actorName} · ` : ""}
            {relTime(event.createdAt)}
          </div>
        </div>
      </Link>
    </li>
  );
}
