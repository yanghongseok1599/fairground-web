"use client";

import type { Match, LiveMatch } from "@/types";
import { formatTime } from "@/utils/formatters";

interface MatchCardProps {
  match: Match | LiveMatch;
  showTimer?: boolean;
}

function isLiveMatch(m: Match | LiveMatch): m is LiveMatch {
  return m.status === "live";
}

export function MatchCard({ match, showTimer }: MatchCardProps) {
  const live = isLiveMatch(match);
  const finished = match.status === "finished";

  return (
    <div
      className="relative overflow-hidden rounded-[var(--radius-lg)] transition-all duration-200 hover:-translate-y-0.5 border"
      style={{
        background: "var(--color-fg-paper)",
        borderColor: live ? "var(--destructive)" : "var(--color-fg-line-soft)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {live && (
        <div
          className="absolute top-0 left-0 w-full h-[2px]"
          style={{ background: "var(--destructive)" }}
        />
      )}

      {/* Status row */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{
          borderBottom: "1px solid var(--color-fg-line-soft)",
          background: live
            ? "rgba(255, 59, 48, 0.06)"
            : "var(--color-fg-paper-2)",
        }}
      >
        <div className="flex items-center gap-2">
          {live && (
            <span
              className="h-[6px] w-[6px] rounded-full animate-pulse-dot"
              style={{
                background: "var(--destructive)",
                boxShadow: "0 0 8px var(--destructive)",
              }}
            />
          )}
          <span
            className={`fg-label${live && showTimer ? " fg-mono tabular-nums" : ""}`}
            style={{
              color: live
                ? "var(--destructive)"
                : finished
                  ? "var(--color-fg-ink-muted)"
                  : "var(--primary)",
            }}
            {...(live && showTimer ? { role: "status", "aria-live": "polite" as const } : {})}
          >
            {live ? (showTimer ? formatTime((match as LiveMatch).elapsedSeconds) : "LIVE") : finished ? "FINAL" : "UPCOMING"}
          </span>
        </div>
        <span
          className="fg-label"
          style={{ color: "var(--color-fg-ink-muted)" }}
        >
          R{match.round}
        </span>
      </div>

      {/* Score row */}
      <div className="px-4 py-5">
        <div
          className="flex items-center justify-between gap-3"
          {...(live ? { role: "status", "aria-live": "polite" as const, "aria-atomic": "true" as const } : {})}
        >
          <div className="flex-1 min-w-0">
            <p
              className="fg-display text-[15px] tracking-wider truncate"
              style={{ color: "var(--color-fg-ink)" }}
            >
              {match.homeTeamName.slice(0, 3).toUpperCase()}
            </p>
            <p
              className="text-[11px] mt-1 truncate"
              style={{
                color: "var(--color-fg-ink-muted)",
                fontFamily: "var(--font-body)",
              }}
            >
              {match.homeTeamName}
            </p>
          </div>

          <div
            className="fg-mono flex items-center gap-2 tabular-nums shrink-0"
            style={{
              color: live ? "var(--primary)" : "var(--color-fg-ink)",
              fontWeight: 700,
              fontSize: 30,
              lineHeight: 1,
              letterSpacing: "-0.02em",
            }}
          >
            <span>{match.homeScore}</span>
            <span
              style={{ color: "var(--color-fg-ink-ghost)" }}
              className="text-xl"
              aria-hidden
            >
              —
            </span>
            <span className="sr-only"> 대 </span>
            <span>{match.awayScore}</span>
          </div>

          <div className="flex-1 min-w-0 text-right">
            <p
              className="fg-display text-[15px] tracking-wider truncate"
              style={{ color: "var(--color-fg-ink)" }}
            >
              {match.awayTeamName.slice(0, 3).toUpperCase()}
            </p>
            <p
              className="text-[11px] mt-1 truncate"
              style={{
                color: "var(--color-fg-ink-muted)",
                fontFamily: "var(--font-body)",
              }}
            >
              {match.awayTeamName}
            </p>
          </div>
        </div>

        {live && (
          <div
            className="mt-4 pt-3 flex items-center justify-center gap-2 fg-label"
            style={{
              color: "var(--color-fg-ink-muted)",
              borderTop: "1px solid var(--color-fg-line-soft)",
            }}
          >
            <span>LIVE · 15:00</span>
          </div>
        )}
      </div>
    </div>
  );
}
