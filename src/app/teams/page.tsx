"use client";

import { useEffect, useState } from "react";
import { useDataStore } from "@/stores/dataStore";
import { useAuthStore } from "@/stores/authStore";
import { PlayerCard } from "@/components/player-card";
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

function getInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function ClubEmblem({
  team,
  index,
}: {
  team: Team;
  index: number;
}) {
  const color = TEAM_COLORS[index % TEAM_COLORS.length];
  const initials = getInitials(team.name);

  if (team.logo) {
    return (
      <img
        src={team.logo}
        alt={team.name}
        className="h-full w-full object-contain"
        draggable={false}
      />
    );
  }

  return (
    <svg viewBox="0 0 120 140" className="h-full w-full" aria-label={`${team.name} 엠블럼`} role="img">
      <defs>
        <linearGradient id={`teams-emblem-${team.id}`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor={color.from} />
          <stop offset="100%" stopColor={color.to} />
        </linearGradient>
      </defs>
      <path
        d="M60 7 L104 22 L98 86 C95 111 78 127 60 134 C42 127 25 111 22 86 L16 22 Z"
        fill={`url(#teams-emblem-${team.id})`}
      />
      <path
        d="M60 16 L94 28 L89 82 C86 102 74 116 60 123 C46 116 34 102 31 82 L26 28 Z"
        fill="rgba(13,27,42,0.84)"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth="2"
      />
      <text
        x="60"
        y="74"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="34"
        fontWeight="900"
        fill="#FAFCFF"
        fontFamily="Arial, sans-serif"
      >
        {initials}
      </text>
      <path d="M39 100 H81" stroke={color.from} strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

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

  return (
    <div
      className="relative h-[286px] w-[208px] overflow-hidden transition-transform duration-300 group-hover:-translate-y-1"
      style={{
        clipPath:
          "polygon(50% 0%, 82% 6%, 96% 20%, 96% 84%, 50% 100%, 4% 84%, 4% 20%, 18% 6%)",
        background:
          "linear-gradient(145deg, #fff4ba 0%, #e1bd55 28%, #a77a26 52%, #f7df8d 76%, #7f5a19 100%)",
        boxShadow: selected
          ? "0 0 0 2px rgba(255,215,0,0.8), 0 28px 60px rgba(212,164,45,0.34)"
          : "0 22px 42px rgba(0,0,0,0.32)",
      }}
    >
      <div
        className="absolute inset-[5px]"
        style={{
          clipPath:
            "polygon(50% 0%, 80% 7%, 94% 21%, 94% 82%, 50% 97%, 6% 82%, 6% 21%, 20% 7%)",
          background:
            "radial-gradient(circle at 30% 18%, rgba(255,255,255,0.82) 0%, transparent 28%), linear-gradient(150deg, #f7dda0 0%, #c99a3c 34%, #8c651f 58%, #f2d478 100%)",
        }}
      />
      <div
        className="absolute left-[13%] right-[13%] top-[12%] h-[38%]"
        style={{
          borderRadius: 18,
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.52), rgba(255,255,255,0.08)), radial-gradient(circle at 70% 30%, rgba(255,255,255,0.55), transparent 34%)",
          border: "1px solid rgba(255,255,255,0.42)",
        }}
      />
      <div
        className="absolute left-[14%] right-[14%] top-[48%] h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)" }}
      />
      <div
        className="absolute left-1/2 top-[29%] flex h-[104px] w-[104px] -translate-x-1/2 -translate-y-1/2 items-center justify-center"
        style={{
          filter: `drop-shadow(0 11px 16px rgba(0,0,0,0.32)) drop-shadow(0 0 14px ${color.from}30)`,
        }}
      >
        <ClubEmblem team={team} index={index} />
      </div>
      <div
        className="absolute left-[10%] right-[10%] top-[51%] rounded-xl px-3 py-3 text-center"
        style={{
          background:
            "linear-gradient(145deg, rgba(255,244,186,0.84), rgba(178,126,35,0.54))",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55)",
        }}
      >
        <h2 className="truncate text-lg font-black" style={{ color: "#122033" }}>
          {team.name}
        </h2>
        {!team.isApproved && (
          <span className="mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-black"
            style={{ background: "rgba(18,32,51,0.12)", color: "#122033" }}>
            승인 대기
          </span>
        )}
      </div>
      <div className="absolute bottom-[14%] left-[14%] right-[14%] grid grid-cols-3 gap-2 text-center">
        {[
          ["W", team.seasonStats.wins],
          ["D", team.seasonStats.draws],
          ["L", team.seasonStats.losses],
        ].map(([label, value]) => (
          <div key={label}>
            <div className="text-lg font-black leading-none" style={{ color: "#071522" }}>
              {value}
            </div>
            <div className="mt-1 text-[10px] font-black" style={{ color: "rgba(7,21,34,0.72)" }}>
              {label}
            </div>
          </div>
        ))}
      </div>
      <div className="absolute bottom-[6%] left-1/2 -translate-x-1/2 text-xs font-black" style={{ color: "#071522" }}>
        {team.memberCount}명
      </div>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.2) 38%, transparent 44%), radial-gradient(circle at 50% 100%, rgba(255,255,255,0.22), transparent 28%)",
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
                    {/* Panel header
                     *   - 좌측: team.logo 실제 로고(흰 패드 배경) → 없으면 이니셜 fallback
                     *   - 팀명(흰글씨) / 서브타이틀(블루-소프트)
                     *   - "팀 페이지 →" 가독성 위해 --color-fg-blue-soft */}
                    <div
                      className="flex items-center justify-between px-6 py-4"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {selectedTeam.logo ? (
                          <div
                            className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg flex items-center justify-center"
                            style={{ background: "var(--color-fg-paper)", padding: 4 }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={selectedTeam.logo}
                              alt={`${selectedTeam.name} 로고`}
                              className="h-full w-full object-contain"
                              draggable={false}
                            />
                          </div>
                        ) : (
                          <div
                            className="h-11 w-11 flex-shrink-0 rounded-lg flex items-center justify-center text-sm font-black"
                            style={{
                              background: "rgba(255,255,255,0.10)",
                              color: "var(--color-fg-paper)",
                              border: "1px solid rgba(255,255,255,0.18)",
                            }}
                            aria-hidden
                          >
                            {selectedTeam.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
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
