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

  return (
    <div
      className="rounded-2xl p-5 border transition-all"
      style={{
        background: live ? "rgba(0,200,83,0.04)" : "#ffffff",
        borderColor: live ? "rgba(0,200,83,0.3)" : "#D9E2EC",
      }}
    >
      {/* Status row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {live && (
            <span className="h-2 w-2 rounded-full bg-fg-coral animate-pulse-dot" />
          )}
          <span
            className="text-[10px] uppercase tracking-[2px] font-semibold"
            style={{
              fontFamily: "var(--font-space-mono)",
              color: live ? "#FF6B6B" : "#627D98",
            }}
          >
            {live ? (showTimer ? formatTime((match as LiveMatch).elapsedSeconds) : "LIVE") : match.status === "finished" ? "종료" : "예정"}
          </span>
        </div>
        <span className="text-xs text-fg-gray-500">R{match.round}</span>
      </div>

      {/* Score row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 text-right">
          <p className="text-sm font-semibold text-fg-navy truncate">{match.homeTeamName}</p>
        </div>
        <div
          className="flex items-center gap-1.5 tabular-nums"
          style={{
            fontFamily: "var(--font-outfit), Outfit, sans-serif",
            fontWeight: 900,
            fontSize: 24,
            letterSpacing: "-1px",
            color: "#0D1B2A",
          }}
        >
          <span>{match.homeScore}</span>
          <span className="text-fg-gray-500 text-lg">:</span>
          <span>{match.awayScore}</span>
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-fg-navy truncate">{match.awayTeamName}</p>
        </div>
      </div>

      {/* Half indicator for live */}
      {live && (
        <div className="mt-2 text-center text-xs" style={{ color: "#627D98" }}>
          {(match as LiveMatch).currentHalf === 1 ? "전반전" : "후반전"}
        </div>
      )}
    </div>
  );
}
