"use client";

import { useEffect, useState } from "react";
import { useDataStore } from "@/stores/dataStore";
import { useAuthStore } from "@/stores/authStore";
import { PlayerCard } from "@/components/player-card";
import { ClubEmblem } from "@/components/club-emblem";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import type { Team, Player } from "@/types";
import { X } from "lucide-react";

const TEAM_COLORS = [
  { from: "#00C853", to: "#004D20" },
  { from: "#4FC3F7", to: "#0D47A1" },
  { from: "#FFD700", to: "#7B5800" },
  { from: "#FF6B6B", to: "#7B1A1A" },
  { from: "#CE93D8", to: "#4A148C" },
  { from: "#FFA726", to: "#7B3F00" },
  { from: "#69F0AE", to: "#004D30" },
  { from: "#42A5F5", to: "#0D2A5C" },
];

function TeamGoldCard({
  team,
  index,
  selected,
}: {
  team: Team;
  index: number;
  selected: boolean;
}) {
  const color = TEAM_COLORS[index % TEAM_COLORS.length];
  const stats = [
    ["W", team.seasonStats.wins],
    ["D", team.seasonStats.draws],
    ["L", team.seasonStats.losses],
  ];

  return (
    <div
      className="relative h-[276px] w-[240px] overflow-hidden transition-transform duration-300 group-hover:-translate-y-1"
      style={{
        backgroundImage: "url(/images/gold-card-ducktape.png?v=3)",
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
        boxShadow: selected
          ? `0 0 0 2px ${color.from}, 0 30px 70px rgba(0,71,171,0.36), 0 0 34px ${color.from}45`
          : "0 24px 54px rgba(0,0,0,0.34)",
      }}
    >
      <div
        className="absolute left-1/2 top-[7.5%] h-[45%] w-[56%] -translate-x-1/2"
        style={{
          background:
            "radial-gradient(circle at 50% 34%, rgba(255,255,255,0.86), rgba(255,255,255,0.25) 36%, rgba(255,255,255,0) 66%)",
        }}
      />
      <div
        className="absolute left-1/2 top-[12%] flex h-[38%] w-[48%] -translate-x-1/2 items-center justify-center"
        style={{
          filter: `drop-shadow(0 14px 16px rgba(0,0,0,0.42)) drop-shadow(0 0 15px ${color.from}44)`,
        }}
      >
        <ClubEmblem name={team.name} logoSrc={team.logo} index={index} className="h-full w-full p-2" />
      </div>
      <div
        className="absolute left-1/2 top-[50.5%] flex h-[15%] w-[58%] -translate-x-1/2 items-center justify-center px-4 text-center"
        style={{
          background:
            "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,248,216,0.86) 18%, rgba(255,228,128,0.62) 50%, rgba(255,248,216,0.86) 82%, rgba(255,255,255,0))",
          borderTop: "1px solid rgba(255,255,255,0.56)",
          borderBottom: "1px solid rgba(58,37,4,0.18)",
          boxShadow: "0 10px 24px rgba(90,62,10,0.14)",
        }}
      >
        <h2
          className="truncate text-[20px] font-black leading-none"
          style={{
            color: "#061524",
            fontFamily: "var(--font-outfit)",
            textShadow: "0 1px 0 rgba(255,255,255,0.62)",
          }}
        >
          {team.name}
        </h2>
      </div>
      {!team.isApproved && (
        <span
          className="absolute left-1/2 top-[63.5%] -translate-x-1/2 rounded-full px-2.5 py-0.5 text-[10px] font-black"
          style={{ background: "rgba(6,21,36,0.13)", color: "#061524" }}
        >
          승인 대기
        </span>
      )}
      <div
        className="absolute left-[21%] right-[21%] top-[68%] grid grid-cols-3 text-center"
        style={{
          color: "#050505",
          textShadow: "0 1px 0 rgba(255,255,255,0.35)",
        }}
      >
        {stats.map(([label, value]) => (
          <div key={label}>
            <div className="text-[22px] font-black leading-none">
              {value}
            </div>
            <div className="mt-1 text-[10px] font-black" style={{ color: "rgba(5,5,5,0.74)" }}>
              {label}
            </div>
          </div>
        ))}
      </div>
      <div className="absolute bottom-[9.2%] left-1/2 -translate-x-1/2 text-[13px] font-black" style={{ color: "#050505" }}>
        {team.memberCount}명
      </div>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(112deg, transparent 0%, transparent 36%, rgba(255,255,255,0.28) 42%, transparent 50%), radial-gradient(circle at 50% 12%, rgba(255,255,255,0.22), transparent 28%)",
        }}
      />
    </div>
  );
}

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
      const sorted = [...list].sort(
        (a, b) =>
          Number(b.isApproved) - Number(a.isApproved) ||
          (b.seasonStats?.points || 0) - (a.seasonStats?.points || 0) ||
          b.createdAt - a.createdAt
      );
      setTeams(sorted);
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

      <div className="px-6 md:px-10 pb-10" style={{ background: "var(--foreground)" }}>
        <div className="max-w-6xl mx-auto space-y-8">
          {loading ? (
            <div className="py-16 text-center" style={{ color: "var(--color-fg-ink-dim)" }}>불러오는 중...</div>
          ) : teams.length === 0 ? (
            <div className="py-20 text-center" style={{ color: "var(--color-fg-ink-dim)" }}>아직 등록된 팀이 없습니다</div>
          ) : (
            <>
              <div className="-mx-6 overflow-x-auto px-6 pb-3 md:-mx-10 md:px-10">
                <div className="flex min-w-max items-stretch gap-4">
                  {teams.map((team, index) => {
                    const color = TEAM_COLORS[index % TEAM_COLORS.length];
                    const isSelected = selectedTeam?.id === team.id;

                    return (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() => void handleSelect(team)}
                        className="group shrink-0 rounded-2xl p-2 text-left transition-all"
                        style={{
                          outline: isSelected ? `2px solid ${color.from}` : "2px solid transparent",
                          outlineOffset: 6,
                        }}
                      >
                        <TeamGoldCard team={team} index={index} selected={isSelected} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Player cards panel */}
              <AnimatePresence>
                {selectedTeam && (
                  <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 24 }}
                    transition={{ type: "spring", stiffness: 260, damping: 26 }}
                    className="overflow-hidden rounded-2xl"
                    style={{ background: "var(--foreground)", border: "1px solid rgba(0,71,171,0.2)" }}
                  >
                    <div
                      className="flex items-center justify-between px-6 py-4"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-11 w-11 flex-shrink-0">
                          <ClubEmblem
                            name={selectedTeam.name}
                            logoSrc={selectedTeam.logo}
                            index={Math.max(0, teams.findIndex((team) => team.id === selectedTeam.id))}
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm truncate" style={{ color: "var(--color-fg-paper)" }}>
                            {selectedTeam.name}
                          </p>
                          <p className="text-xs" style={{ color: "var(--color-fg-blue-soft)" }}>선수 카드</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <Link
                          href={`/teams/${selectedTeam.id}`}
                          className="text-xs font-semibold hover:opacity-80 transition-opacity"
                          style={{ color: "var(--color-fg-blue-soft)" }}
                        >
                          팀 페이지 →
                        </Link>
                        <button
                          onClick={() => { setSelectedTeam(null); setTeamPlayers([]); }}
                          aria-label="패널 닫기"
                          className="opacity-60 hover:opacity-100 transition-opacity"
                          style={{ color: "var(--color-fg-paper)" }}
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
                        <div className="py-10 text-center text-sm" style={{ color: "var(--color-fg-ink-dim)" }}>
                          등록된 선수가 없습니다
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-5">
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
