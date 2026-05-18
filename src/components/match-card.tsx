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
      className="relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5 border"
      style={{
        background: "#ffffff",
        borderColor: live ? "#FF3B30" : "#E5E8EE",
      }}
    >
      {live && (
        <div className="absolute top-0 left-0 w-full h-[2px]" style={{ background: "#FF3B30" }} />
      )}

      {/* Status row */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: "1px solid #EAEEF5", background: live ? "rgba(255,59,48,0.06)" : "#F4F6FA" }}
      >
        <div className="flex items-center gap-2">
          {live && (
            <span
              className="h-[6px] w-[6px] rounded-full animate-pulse-dot"
              style={{ background: "#FF3B30", boxShadow: "0 0 8px #FF3B30" }}
            />
          )}
          <span
            className="fg-label"
            style={{ color: live ? "#FF3B30" : finished ? "#7A8496" : "#1B5EFF" }}
          >
            {live ? (showTimer ? formatTime((match as LiveMatch).elapsedSeconds) : "LIVE") : finished ? "FINAL" : "UPCOMING"}
          </span>
        </div>
        <span className="fg-label" style={{ color: "#7A8496" }}>R{match.round}</span>
      </div>

      {/* Score row */}
      <div className="px-4 py-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p
              className="fg-display text-[15px] tracking-wider truncate"
              style={{ color: "#0A1220" }}
            >
              {match.homeTeamName.slice(0, 3).toUpperCase()}
            </p>
            <p
              className="text-[11px] mt-1 truncate"
              style={{ color: "#7A8496", fontFamily: "var(--font-pretendard)" }}
            >
              {match.homeTeamName}
            </p>
          </div>

          <div
            className="fg-mono flex items-center gap-2 tabular-nums shrink-0"
            style={{
              color: live ? "#1B5EFF" : "#0A1220",
              fontWeight: 700,
              fontSize: 30,
              lineHeight: 1,
              letterSpacing: "-0.02em",
            }}
          >
            <span>{match.homeScore}</span>
            <span style={{ color: "#B1B8C4" }} className="text-xl">—</span>
            <span>{match.awayScore}</span>
          </div>

          <div className="flex-1 min-w-0 text-right">
            <p
              className="fg-display text-[15px] tracking-wider truncate"
              style={{ color: "#0A1220" }}
            >
              {match.awayTeamName.slice(0, 3).toUpperCase()}
            </p>
            <p
              className="text-[11px] mt-1 truncate"
              style={{ color: "#7A8496", fontFamily: "var(--font-pretendard)" }}
            >
              {match.awayTeamName}
            </p>
          </div>
        </div>

        {live && (
          <div
            className="mt-4 pt-3 flex items-center justify-center gap-2 fg-label"
            style={{ color: "#7A8496", borderTop: "1px solid #EAEEF5" }}
          >
            <span>{(match as LiveMatch).currentHalf === 1 ? "FIRST HALF" : "SECOND HALF"}</span>
          </div>
        )}
      </div>
    </div>
  );
}
