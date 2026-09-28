"use client";

import type { MatchEvent, MatchEventType } from "@/types";
import { Button } from "@/components/ui/button";
import { MATCH_DURATION_LABEL } from "@/lib/match-config";

interface EventTimelineProps {
  events: MatchEvent[];
  onCancel: (eventId: string) => void;
  onAddAssist: (goal: MatchEvent) => void;
  canEdit?: boolean;
  uncheckedGoalIds?: Set<string>;
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
  canEdit = true,
  uncheckedGoalIds,
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
        const periodLabel = MATCH_DURATION_LABEL;
        const cancelled = event.isCancelled === true;
        const assistUnchecked =
          event.type === "goal" && !cancelled && uncheckedGoalIds?.has(event.id);

        return (
          <li
            key={event.id}
            className={`grid min-h-[56px] grid-cols-[42px_minmax(0,1fr)] gap-2 px-2 py-2 sm:flex sm:items-center sm:gap-3 ${
              cancelled ? "opacity-50" : ""
            }`}
          >
            {/* Minute badge */}
            <span className="pt-1 text-center text-sm font-semibold tabular-nums text-muted-foreground sm:w-10 sm:shrink-0 sm:pt-0">
              {event.minute}&apos;
            </span>

            <div className="min-w-0 sm:flex sm:flex-1 sm:items-center sm:gap-3">
              {/* Event info */}
              <span
                className={`min-w-0 sm:flex-1 ${
                  cancelled ? "line-through text-muted-foreground" : ""
                }`}
              >
                <span className="block truncate text-sm font-medium">
                  {emoji} {label} — {event.playerName}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span>{periodLabel}</span>
                  {assistUnchecked && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-700">
                      어시 미확인
                    </span>
                  )}
                </span>
              </span>

              {/* Action buttons — hidden for cancelled events */}
              {!cancelled && canEdit && (
                <span className="mt-2 flex items-center gap-1.5 sm:mt-0 sm:shrink-0">
                  {event.type === "goal" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-[36px] px-2 text-xs sm:min-h-[44px]"
                      onClick={() => onAddAssist(event)}
                    >
                      <span className="sm:hidden">
                        {assistUnchecked ? "어시 체크" : "어시 추가"}
                      </span>
                      <span className="hidden sm:inline">
                        {assistUnchecked ? "어시스트 체크" : "어시스트 추가"}
                      </span>
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    className="min-h-[36px] px-2 text-xs sm:min-h-[44px]"
                    onClick={() => onCancel(event.id)}
                  >
                    취소
                  </Button>
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
