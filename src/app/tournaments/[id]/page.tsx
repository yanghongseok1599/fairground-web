"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useDataStore } from "@/stores/dataStore";
import { MatchCard } from "@/components/match-card";
import { StandingsTable } from "@/components/standings-table";
import type { Tournament, Match, TeamStanding } from "@/types";
import { Calendar, MapPin, Trophy } from "lucide-react";

export default function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const store = useDataStore();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [t, ms] = await Promise.all([
        store.fetchTournament(id),
        store.fetchMatches(id),
      ]);
      setTournament(t);
      setMatches(ms.sort((a, b) => a.round - b.round));
      setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <div className="pt-[60px] py-20 text-center text-fg-gray-500">불러오는 중...</div>;
  if (!tournament) return <div className="pt-[60px] py-20 text-center text-fg-gray-500">대회를 찾을 수 없습니다</div>;

  const liveMatches = matches.filter((m) => m.status === "live");
  const finishedMatches = matches.filter((m) => m.status === "finished");
  const scheduledMatches = matches.filter((m) => m.status === "scheduled");

  // Build standings from groups
  const groupStandings: { name: string; rows: TeamStanding[] }[] = (tournament.groups || []).map((g) => ({
    name: g.name,
    rows: (g.standings || []).map((s) => ({
      teamId: s.teamId,
      teamName: s.teamName,
      teamLogo: "",
      points: s.points,
      rank: 0,
      wins: s.wins,
      draws: s.draws,
      losses: s.losses,
      goalsFor: s.goalsFor,
      goalsAgainst: s.goalsAgainst,
      goalDifference: s.goalDifference,
      gamesPlayed: s.gamesPlayed,
    })).sort((a, b) => b.points - a.points),
  }));

  return (
    <div className="pt-[60px]">
      {/* Header */}
      <div className="py-16 px-6 md:px-10" style={{ background: "#0D1B2A" }}>
        <div className="max-w-6xl mx-auto">
          <p className="text-[11px] uppercase tracking-[3px] mb-4" style={{ fontFamily: "var(--font-space-mono)", color: "#00C853" }}>
            Tournament
          </p>
          <h1 className="font-black leading-none mb-4" style={{ fontFamily: "var(--font-outfit)", fontSize: "clamp(28px, 5vw, 56px)", letterSpacing: "-2px", color: "#FAFCFF" }}>
            {tournament.name}
          </h1>
          <div className="flex flex-wrap gap-4 text-sm" style={{ color: "#627D98" }}>
            <div className="flex items-center gap-1.5"><Calendar className="h-4 w-4" />{tournament.date}</div>
            <div className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{tournament.location}</div>
            {tournament.winningTeamName && (
              <div className="flex items-center gap-1.5"><Trophy className="h-4 w-4 text-fg-gold" /><span className="text-fg-gold font-semibold">{tournament.winningTeamName}</span></div>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 md:px-10 py-10">
        <div className="max-w-6xl mx-auto space-y-12">
          {/* Live */}
          {liveMatches.length > 0 && (
            <div>
              <h2 className="text-lg font-bold mb-4" style={{ fontFamily: "var(--font-outfit)", color: "#0D1B2A" }}>진행 중</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {liveMatches.map((m) => <MatchCard key={m.id} match={m} />)}
              </div>
            </div>
          )}

          {/* Group standings */}
          {groupStandings.length > 0 && (
            <div>
              <h2 className="text-lg font-bold mb-4" style={{ fontFamily: "var(--font-outfit)", color: "#0D1B2A" }}>조별 순위</h2>
              <div className="space-y-6">
                {groupStandings.map((g) => (
                  <div key={g.name}>
                    <p className="text-sm font-semibold mb-2" style={{ color: "#627D98" }}>{g.name}</p>
                    <StandingsTable standings={g.rows} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Finished matches */}
          {finishedMatches.length > 0 && (
            <div>
              <h2 className="text-lg font-bold mb-4" style={{ fontFamily: "var(--font-outfit)", color: "#0D1B2A" }}>경기 결과</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {finishedMatches.map((m) => <MatchCard key={m.id} match={m} />)}
              </div>
            </div>
          )}

          {/* Scheduled */}
          {scheduledMatches.length > 0 && (
            <div>
              <h2 className="text-lg font-bold mb-4" style={{ fontFamily: "var(--font-outfit)", color: "#0D1B2A" }}>예정 경기</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {scheduledMatches.map((m) => <MatchCard key={m.id} match={m} />)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
