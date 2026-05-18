"use client";

import { useEffect, useState } from "react";
import { useDataStore } from "@/stores/dataStore";
import { StandingsTable } from "@/components/standings-table";
import type { TeamStanding } from "@/types";
import { Trophy } from "lucide-react";

export default function StandingsPage() {
  const store = useDataStore();
  const [displayStandings, setDisplayStandings] = useState<TeamStanding[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    store.fetchStandings().then(() => {
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loaded) {
      setDisplayStandings(store.standings);
    }
  }, [loaded, store.standings]);

  return (
    <div className="pt-[60px]">
      {/* Header */}
      <div className="py-16 px-6 md:px-10" style={{ background: "var(--foreground)" }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <Trophy className="h-5 w-5" style={{ color: "var(--accent-gold)" }} />
            <span
              className="text-[11px] uppercase tracking-[3px]"
              style={{ fontFamily: "var(--font-space-mono)", color: "var(--accent-gold)" }}
            >
              League Table
            </span>
          </div>
          <h1
            className="font-black leading-none mb-2"
            style={{
              fontFamily: "var(--font-outfit)",
              fontSize: "clamp(36px, 6vw, 64px)",
              letterSpacing: "-2px",
              color: "var(--background)",
            }}
          >
            리그 순위
          </h1>
          {store.currentSeason && (
            <p className="text-sm" style={{ color: "var(--color-fg-ink-dim)" }}>
              {store.currentSeason.name} · {store.currentSeason.startDate} ~ {store.currentSeason.endDate}
            </p>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="px-6 md:px-10 py-10">
        <div className="max-w-6xl mx-auto">
          {!loaded ? (
            <div className="py-16 text-center" style={{ color: "var(--color-fg-ink-dim)" }}>불러오는 중...</div>
          ) : displayStandings.length === 0 ? (
            <div className="py-16 text-center" style={{ color: "var(--color-fg-ink-dim)" }}>
              아직 집계된 순위가 없습니다
            </div>
          ) : (
            <StandingsTable standings={displayStandings} />
          )}

          {/* Legend */}
          {loaded && displayStandings.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-4 text-xs" style={{ color: "var(--color-fg-ink-dim)" }}>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: "var(--primary)" }} />
                상위 3팀 (승격권)
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
