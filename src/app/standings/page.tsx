"use client";

import { useEffect, useState } from "react";
import { useDataStore } from "@/stores/dataStore";
import { StandingsTable } from "@/components/standings-table";
import type { TeamStanding } from "@/types";
import { Trophy } from "lucide-react";

const DEMO_STANDINGS: TeamStanding[] = [
  { teamId: "d1", teamName: "FC 서울",        teamLogo: "", rank: 1, gamesPlayed: 12, wins: 9, draws: 1, losses: 2, goalsFor: 34, goalsAgainst: 14, goalDifference: 20,  points: 28 },
  { teamId: "d2", teamName: "부산 아이파크",   teamLogo: "", rank: 2, gamesPlayed: 12, wins: 7, draws: 1, losses: 4, goalsFor: 27, goalsAgainst: 18, goalDifference: 9,   points: 22 },
  { teamId: "d3", teamName: "인천 유나이티드",  teamLogo: "", rank: 3, gamesPlayed: 12, wins: 6, draws: 2, losses: 4, goalsFor: 22, goalsAgainst: 19, goalDifference: 3,   points: 20 },
  { teamId: "d4", teamName: "전북 현대",       teamLogo: "", rank: 4, gamesPlayed: 12, wins: 6, draws: 1, losses: 5, goalsFor: 25, goalsAgainst: 22, goalDifference: 3,   points: 19 },
  { teamId: "d5", teamName: "울산 HD",         teamLogo: "", rank: 5, gamesPlayed: 12, wins: 5, draws: 2, losses: 5, goalsFor: 20, goalsAgainst: 21, goalDifference: -1,  points: 17 },
  { teamId: "d6", teamName: "수원 삼성",       teamLogo: "", rank: 6, gamesPlayed: 12, wins: 4, draws: 3, losses: 5, goalsFor: 18, goalsAgainst: 23, goalDifference: -5,  points: 15 },
  { teamId: "d7", teamName: "성남 FC",         teamLogo: "", rank: 7, gamesPlayed: 12, wins: 4, draws: 1, losses: 7, goalsFor: 16, goalsAgainst: 26, goalDifference: -10, points: 13 },
  { teamId: "d8", teamName: "대구 FC",         teamLogo: "", rank: 8, gamesPlayed: 12, wins: 3, draws: 2, losses: 7, goalsFor: 14, goalsAgainst: 28, goalDifference: -14, points: 11 },
];

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
      setDisplayStandings(store.standings.length > 0 ? store.standings : DEMO_STANDINGS);
    }
  }, [loaded, store.standings]);

  return (
    <div className="pt-[60px]">
      {/* Header */}
      <div className="py-16 px-6 md:px-10" style={{ background: "#0D1B2A" }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <Trophy className="h-5 w-5" style={{ color: "#FFD700" }} />
            <span
              className="text-[11px] uppercase tracking-[3px]"
              style={{ fontFamily: "var(--font-space-mono)", color: "#FFD700" }}
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
              color: "#FAFCFF",
            }}
          >
            리그 순위
          </h1>
          {store.currentSeason && (
            <p className="text-sm" style={{ color: "#627D98" }}>
              {store.currentSeason.name} · {store.currentSeason.startDate} ~ {store.currentSeason.endDate}
            </p>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="px-6 md:px-10 py-10">
        <div className="max-w-6xl mx-auto">
          {!loaded ? (
            <div className="py-16 text-center text-fg-gray-500">불러오는 중...</div>
          ) : (
            <StandingsTable standings={displayStandings} />
          )}

          {/* Legend */}
          <div className="mt-6 flex flex-wrap gap-4 text-xs" style={{ color: "#627D98" }}>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-fg-green" />
              상위 3팀 (승격권)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
