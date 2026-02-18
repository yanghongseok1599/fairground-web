"use client";

import { useEffect, useState } from "react";
import { useDataStore } from "@/stores/dataStore";
import { useAuthStore } from "@/stores/authStore";
import { PlayerCard } from "@/components/player-card";
import { motion, AnimatePresence } from "framer-motion";
import { TeamCarousel } from "@/components/team-carousel";
import Link from "next/link";
import type { Team, Player } from "@/types";
import { X } from "lucide-react";

const DEMO_TEAMS: Team[] = [
  { id: "d1", name: "FC 서울", logo: "", isApproved: true, memberCount: 11, seasonStats: { points: 28, rank: 1, wins: 9, draws: 1, losses: 2, goalsFor: 34, goalsAgainst: 14, goalDifference: 20, gamesPlayed: 12 }, createdAt: 0 },
  { id: "d2", name: "부산 아이파크", logo: "", isApproved: true, memberCount: 10, seasonStats: { points: 22, rank: 2, wins: 7, draws: 1, losses: 4, goalsFor: 27, goalsAgainst: 18, goalDifference: 9, gamesPlayed: 12 }, createdAt: 0 },
  { id: "d3", name: "인천 유나이티드", logo: "", isApproved: true, memberCount: 12, seasonStats: { points: 20, rank: 3, wins: 6, draws: 2, losses: 4, goalsFor: 22, goalsAgainst: 19, goalDifference: 3, gamesPlayed: 12 }, createdAt: 0 },
  { id: "d4", name: "전북 현대", logo: "", isApproved: true, memberCount: 11, seasonStats: { points: 19, rank: 4, wins: 6, draws: 1, losses: 5, goalsFor: 25, goalsAgainst: 22, goalDifference: 3, gamesPlayed: 12 }, createdAt: 0 },
  { id: "d5", name: "울산 HD", logo: "", isApproved: true, memberCount: 10, seasonStats: { points: 17, rank: 5, wins: 5, draws: 2, losses: 5, goalsFor: 20, goalsAgainst: 21, goalDifference: -1, gamesPlayed: 12 }, createdAt: 0 },
  { id: "d6", name: "수원 삼성", logo: "", isApproved: true, memberCount: 11, seasonStats: { points: 15, rank: 6, wins: 4, draws: 3, losses: 5, goalsFor: 18, goalsAgainst: 23, goalDifference: -5, gamesPlayed: 12 }, createdAt: 0 },
  { id: "d7", name: "성남 FC", logo: "", isApproved: true, memberCount: 9, seasonStats: { points: 13, rank: 7, wins: 4, draws: 1, losses: 7, goalsFor: 16, goalsAgainst: 26, goalDifference: -10, gamesPlayed: 12 }, createdAt: 0 },
  { id: "d8", name: "대구 FC", logo: "", isApproved: true, memberCount: 10, seasonStats: { points: 11, rank: 8, wins: 3, draws: 2, losses: 7, goalsFor: 14, goalsAgainst: 28, goalDifference: -14, gamesPlayed: 12 }, createdAt: 0 },
];

const DEMO_PLAYERS: Player[] = [
  { id: "dp0", uid: "dp0", name: "이감독", number: 0, position: "FIXO", teamId: "d1", nationality: "KOR", photoUrl: "https://randomuser.me/api/portraits/men/3.jpg", cardType: "gold", cardRating: 92, stats: { goals: 0, assists: 0, games: 18, mom: 0 }, badges: [], penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 0 }, isApproved: true, role: "admin", createdAt: 0 },
  { id: "dp1", uid: "dp1", name: "김민준", number: 10, position: "PIVO", teamId: "d1", nationality: "KOR", photoUrl: "https://randomuser.me/api/portraits/men/32.jpg", cardType: "gold", cardRating: 88, stats: { goals: 12, assists: 7, games: 18, mom: 4 }, badges: [], penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 1 }, isApproved: true, role: "captain", createdAt: 0 },
  { id: "dp2", uid: "dp2", name: "이재원", number: 7, position: "ALA", teamId: "d1", nationality: "KOR", photoUrl: "https://randomuser.me/api/portraits/men/45.jpg", cardType: "gold", cardRating: 84, stats: { goals: 8, assists: 11, games: 17, mom: 3 }, badges: [], penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 0 }, isApproved: true, role: "player", createdAt: 0 },
  { id: "dp3", uid: "dp3", name: "박성호", number: 1, position: "GK", teamId: "d1", nationality: "KOR", photoUrl: "https://randomuser.me/api/portraits/men/12.jpg", cardType: "gold", cardRating: 82, stats: { goals: 0, assists: 1, games: 16, mom: 5 }, badges: [], penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 0 }, isApproved: true, role: "player", createdAt: 0 },
  { id: "dp4", uid: "dp4", name: "최현우", number: 5, position: "FIXO", teamId: "d1", nationality: "KOR", photoUrl: "https://randomuser.me/api/portraits/men/67.jpg", cardType: "premium", cardRating: 79, stats: { goals: 3, assists: 5, games: 15, mom: 1 }, badges: [], penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 2 }, isApproved: true, role: "player", createdAt: 0 },
];

export default function TeamsPage() {
  const store = useDataStore();
  const { player: currentPlayer } = useAuthStore();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamPlayers, setTeamPlayers] = useState<Player[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);

  useEffect(() => {
    store.fetchTeams().then((list) => {
      const approved = list.filter((t) => t.isApproved).sort((a, b) => (b.seasonStats?.points || 0) - (a.seasonStats?.points || 0));
      setTeams(approved.length > 0 ? approved : DEMO_TEAMS);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = async (team: Team) => {
    if (selectedTeam?.id === team.id) {
      setSelectedTeam(null);
      setTeamPlayers([]);
      return;
    }
    setSelectedTeam(team);
    setTeamPlayers([]);

    if (DEMO_TEAMS.some((t) => t.id === team.id)) {
      setTeamPlayers(DEMO_PLAYERS);
      return;
    }

    setPlayersLoading(true);
    const players = await store.fetchTeamPlayers(team.id);
    setTeamPlayers(players.length > 0 ? players : DEMO_PLAYERS);
    setPlayersLoading(false);
  };

  return (
    <div className="pt-[60px] min-h-screen" style={{ background: "#0D1B2A" }}>
      {/* Header */}
      <div className="pt-6 pb-8 px-6 md:px-10" style={{ background: "#0D1B2A" }}>
        <div className="max-w-6xl mx-auto">
          <p className="text-[11px] uppercase tracking-[3px] mb-4" style={{ fontFamily: "var(--font-space-mono)", color: "#00C853" }}>Teams</p>
          <h1 className="font-black leading-none mb-2" style={{ fontFamily: "var(--font-outfit)", fontSize: "clamp(36px, 6vw, 64px)", letterSpacing: "-2px", color: "#FAFCFF" }}>
            참가 팀
          </h1>
          <p className="text-sm" style={{ color: "#627D98" }}>팀을 클릭하면 선수 카드를 확인할 수 있습니다</p>
        </div>
      </div>

      {/* Team Carousel — full width, no padding */}
      {!loading && (
        <TeamCarousel
          teams={teams}
          selectedId={selectedTeam?.id}
          onSelect={handleSelect}
        />
      )}

      <div className="px-6 md:px-10 pb-10" style={{ background: "#0D1B2A" }}>
        <div className="max-w-6xl mx-auto">
          {loading ? (
            <div className="py-16 text-center" style={{ color: "#627D98" }}>불러오는 중...</div>
          ) : (
            <>
              {/* Player cards panel */}
              <AnimatePresence>
                {selectedTeam && (
                  <motion.div
                    initial={{ opacity: 0, x: 60 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 60 }}
                    transition={{ type: "spring", stiffness: 260, damping: 26 }}
                    className="rounded-2xl overflow-hidden"
                    style={{ background: "#0D1B2A", border: "1px solid rgba(0,200,83,0.2)" }}
                  >
                    {/* Panel header */}
                    <div
                      className="flex items-center justify-between px-6 py-4"
                      style={{ borderBottom: "1px solid rgba(0,200,83,0.15)" }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black"
                          style={{ background: "rgba(0,200,83,0.2)", color: "#00C853" }}
                        >
                          {selectedTeam.name.slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-bold text-sm" style={{ color: "#FAFCFF" }}>{selectedTeam.name}</p>
                          <p className="text-xs" style={{ color: "#627D98" }}>선수 카드</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Link href={`/teams/${selectedTeam.id}`} className="text-xs font-medium" style={{ color: "#00C853" }}>
                          팀 페이지 →
                        </Link>
                        <button
                          onClick={() => { setSelectedTeam(null); setTeamPlayers([]); }}
                          className="opacity-40 hover:opacity-100 transition-opacity"
                          style={{ color: "#D9E2EC" }}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Player cards grid */}
                    <div className="px-6 py-5">
                      {playersLoading ? (
                        <div className="flex items-center justify-center py-10">
                          <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: "#00C853", borderTopColor: "transparent" }} />
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-4">
                          {[...teamPlayers].sort((a, b) => {
                            const rank = (p: Player) => {
                              if (p.role === "admin") return 0;
                              if (p.role === "captain") return 1;
                              if (p.uid === currentPlayer?.uid) return 2;
                              return 3;
                            };
                            return rank(a) - rank(b);
                          }).map((player, i) => (
                            <motion.div
                              key={player.id}
                              initial={{ opacity: 0, y: 20, scale: 0.92 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              transition={{ delay: i * 0.05, type: "spring", stiffness: 240, damping: 22 }}
                            >
                              <Link href={`/players/${player.id}`}>
                                <PlayerCard player={player} size="md" />
                              </Link>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
