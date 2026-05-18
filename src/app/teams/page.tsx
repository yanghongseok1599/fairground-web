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
      setTeams(approved);
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

    setPlayersLoading(true);
    const players = await store.fetchTeamPlayers(team.id);
    setTeamPlayers(players);
    setPlayersLoading(false);
  };

  return (
    <div className="pt-[60px] min-h-screen" style={{ background: "var(--foreground)" }}>
      {/* Header */}
      <div className="pt-6 pb-8 px-6 md:px-10" style={{ background: "var(--foreground)" }}>
        <div className="max-w-6xl mx-auto">
          <p className="text-[11px] uppercase tracking-[3px] mb-4" style={{ fontFamily: "var(--font-space-mono)", color: "var(--primary)" }}>Teams</p>
          <h1 className="font-black leading-none mb-2" style={{ fontFamily: "var(--font-outfit)", fontSize: "clamp(36px, 6vw, 64px)", letterSpacing: "-2px", color: "var(--background)" }}>
            참가 팀
          </h1>
          <p className="text-sm" style={{ color: "var(--color-fg-ink-dim)" }}>팀을 클릭하면 선수 카드를 확인할 수 있습니다</p>
        </div>
      </div>

      {/* Team Carousel — full width, no padding */}
      {!loading && teams.length > 0 && (
        <TeamCarousel
          teams={teams}
          selectedId={selectedTeam?.id}
          onSelect={handleSelect}
        />
      )}

      <div className="px-6 md:px-10 pb-10" style={{ background: "var(--foreground)" }}>
        <div className="max-w-6xl mx-auto">
          {loading ? (
            <div className="py-16 text-center" style={{ color: "var(--color-fg-ink-dim)" }}>불러오는 중...</div>
          ) : teams.length === 0 ? (
            <div className="py-20 text-center" style={{ color: "var(--color-fg-ink-dim)" }}>아직 등록된 팀이 없습니다</div>
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
                    style={{ background: "var(--foreground)", border: "1px solid rgba(27,94,255,0.2)" }}
                  >
                    {/* Panel header */}
                    <div
                      className="flex items-center justify-between px-6 py-4"
                      style={{ borderBottom: "1px solid rgba(27,94,255,0.15)" }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black"
                          style={{ background: "rgba(27,94,255,0.2)", color: "var(--primary)" }}
                        >
                          {selectedTeam.name.slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-bold text-sm" style={{ color: "var(--background)" }}>{selectedTeam.name}</p>
                          <p className="text-xs" style={{ color: "var(--color-fg-ink-dim)" }}>선수 카드</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Link href={`/teams/${selectedTeam.id}`} className="text-xs font-medium" style={{ color: "var(--primary)" }}>
                          팀 페이지 →
                        </Link>
                        <button
                          onClick={() => { setSelectedTeam(null); setTeamPlayers([]); }}
                          className="opacity-40 hover:opacity-100 transition-opacity"
                          style={{ color: "var(--color-fg-ink-ghost)" }}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Player cards grid */}
                    <div className="px-6 py-5">
                      {playersLoading ? (
                        <div className="flex items-center justify-center py-10">
                          <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} />
                        </div>
                      ) : teamPlayers.length === 0 ? (
                        <div className="py-10 text-center text-sm" style={{ color: "var(--color-fg-ink-dim)" }}>등록된 선수가 없습니다</div>
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
