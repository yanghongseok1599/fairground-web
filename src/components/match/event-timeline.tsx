"use client";

import type { MatchEvent, MatchEventType } from "@/types";
import { Button } from "@/components/ui/button";

interface EventTimelineProps {
  events: MatchEvent[];
  onCancel: (eventId: string) => void;
  onAddAssist: (goal: MatchEvent) => void;
}

const EVENT_LABEL: Record<MatchEventType, { emoji: string; label: string }> = {
  goal: { emoji: "⚽", label: "골" },
  assist: { emoji: "🅰️", label: "어시스트" },
  foul: { emoji: "🚫", label: "반칙" },
  yellow_card: { emoji: "🟨", label: "경고" },
  red_card: { emoji: "🟥", label: "퇴장" },
  substitution: { emoji: "🔄", label: "교체" },
  mom: { emoji: "⭐", label: "MOM" },
};

export function EventTimeline({
  events,
  onCancel,
  onAddAssist,
}: EventTimelineProps) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        기록된 이벤트가 없습니다
      </p>
    );
  }

  const sorted = [...events].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <ul className="divide-y divide-border">
      {sorted.map((event) => {
        const { emoji, label } = EVENT_LABEL[event.type];
        const halfLabel = event.half === 1 ? "전반" : "후반";
        const cancelled = event.isCancelled === true;

        return (
          <li
            key={event.id}
            className={`flex items-center gap-3 px-2 py-2 min-h-[52px] ${
              cancelled ? "opacity-50" : ""
            }`}
          >
            {/* Minute badge */}
            <span className="w-10 shrink-0 text-center text-sm font-semibold tabular-nums text-muted-foreground">
              {event.minute}&apos;
            </span>

            {/* Event info */}
            <span
              className={`flex-1 flex flex-col gap-0.5 ${
                cancelled ? "line-through text-muted-foreground" : ""
              }`}
            >
              <span className="text-sm font-medium">
                {emoji} {label} — {event.playerName}
              </span>
              <span className="text-xs text-muted-foreground">{halfLabel}</span>
            </span>

            {/* Action buttons — hidden for cancelled events */}
            {!cancelled && (
              <span className="flex items-center gap-1.5 shrink-0">
                {event.type === "goal" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-[44px] text-xs px-2"
                    onClick={() => onAddAssist(event)}
                  >
                    어시스트 추가
                  </Button>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  className="min-h-[44px] text-xs px-2"
                  onClick={() => onCancel(event.id)}
                >
                  취소
                </Button>
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
