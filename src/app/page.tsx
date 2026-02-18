"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useDataStore } from "@/stores/dataStore";
import { MatchCard } from "@/components/match-card";
import { StandingsTable } from "@/components/standings-table";
import { CircularGallery, type GalleryItem } from "@/components/circular-gallery";
import { PlayerCard } from "@/components/player-card";
import { Section } from "@/components/section";
import type { Match, Team, Player } from "@/types";
import { ArrowRight, X } from "lucide-react";

const ROLE_ORDER: Record<string, number> = { admin: 0, captain: 1, referee: 2, player: 3 };
const ROLE_LABELS: Record<string, string> = { admin: "감독", captain: "주장", referee: "심판", player: "선수" };

const DEMO_PLAYERS: Player[] = [
  {
    id: "dp0", uid: "dp0", name: "이감독", number: 0, position: "FIXO", teamId: "demo",
    nationality: "KOR", photoUrl: "https://randomuser.me/api/portraits/men/3.jpg",
    cardType: "gold", cardRating: 92,
    stats: { goals: 0, assists: 0, games: 18, mom: 0 },
    badges: [], penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 0 },
    isApproved: true, role: "admin", createdAt: 0,
  },
  {
    id: "dp1", uid: "dp1", name: "김민준", number: 10, position: "PIVO", teamId: "demo",
    nationality: "KOR", photoUrl: "https://randomuser.me/api/portraits/men/32.jpg",
    cardType: "gold", cardRating: 88,
    stats: { goals: 12, assists: 7, games: 18, mom: 4 },
    badges: [], penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 1 },
    isApproved: true, role: "captain", createdAt: 0,
  },
  {
    id: "dp2", uid: "dp2", name: "이재원", number: 7, position: "ALA", teamId: "demo",
    nationality: "KOR", photoUrl: "https://randomuser.me/api/portraits/men/45.jpg",
    cardType: "gold", cardRating: 84,
    stats: { goals: 8, assists: 11, games: 17, mom: 3 },
    badges: [], penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 0 },
    isApproved: true, role: "player", createdAt: 0,
  },
  {
    id: "dp3", uid: "dp3", name: "박성호", number: 1, position: "GK", teamId: "demo",
    nationality: "KOR", photoUrl: "https://randomuser.me/api/portraits/men/12.jpg",
    cardType: "gold", cardRating: 82,
    stats: { goals: 0, assists: 1, games: 16, mom: 5 },
    badges: [], penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 0 },
    isApproved: true, role: "player", createdAt: 0,
  },
  {
    id: "dp4", uid: "dp4", name: "최현우", number: 5, position: "FIXO", teamId: "demo",
    nationality: "KOR", photoUrl: "https://randomuser.me/api/portraits/men/67.jpg",
    cardType: "premium", cardRating: 79,
    stats: { goals: 3, assists: 5, games: 15, mom: 1 },
    badges: [], penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 2 },
    isApproved: true, role: "player", createdAt: 0,
  },
  {
    id: "dp5", uid: "dp5", name: "정태양", number: 9, position: "PIVO", teamId: "demo",
    nationality: "KOR", photoUrl: "https://randomuser.me/api/portraits/men/22.jpg",
    cardType: "premium", cardRating: 76,
    stats: { goals: 6, assists: 2, games: 14, mom: 2 },
    badges: [], penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 1 },
    isApproved: true, role: "player", createdAt: 0,
  },
  {
    id: "dp6", uid: "dp6", name: "윤준서", number: 11, position: "ALA", teamId: "demo",
    nationality: "BRA", photoUrl: "https://randomuser.me/api/portraits/men/78.jpg",
    cardType: "gold", cardRating: 86,
    stats: { goals: 10, assists: 9, games: 18, mom: 3 },
    badges: [], penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 0 },
    isApproved: true, role: "player", createdAt: 0,
  },
  {
    id: "dp7", uid: "dp7", name: "강도윤", number: 4, position: "FIXO", teamId: "demo",
    nationality: "KOR", photoUrl: "https://randomuser.me/api/portraits/men/55.jpg",
    cardType: "premium", cardRating: 77,
    stats: { goals: 2, assists: 6, games: 16, mom: 0 },
    badges: [], penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 3 },
    isApproved: true, role: "player", createdAt: 0,
  },
  {
    id: "dp8", uid: "dp8", name: "손영준", number: 8, position: "ALA", teamId: "demo",
    nationality: "JPN", photoUrl: "https://randomuser.me/api/portraits/men/91.jpg",
    cardType: "gold", cardRating: 83,
    stats: { goals: 7, assists: 8, games: 17, mom: 2 },
    badges: [], penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 1 },
    isApproved: true, role: "player", createdAt: 0,
  },
];

const DEMO_TEAMS: Team[] = [
  { id: "d1", name: "FC 서울", logo: "", isApproved: true, memberCount: 11, seasonStats: { points: 0, rank: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, gamesPlayed: 0 }, createdAt: 0 },
  { id: "d2", name: "부산 아이파크", logo: "", isApproved: true, memberCount: 11, seasonStats: { points: 0, rank: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, gamesPlayed: 0 }, createdAt: 0 },
  { id: "d3", name: "인천 유나이티드", logo: "", isApproved: true, memberCount: 11, seasonStats: { points: 0, rank: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, gamesPlayed: 0 }, createdAt: 0 },
  { id: "d4", name: "전북 현대", logo: "", isApproved: true, memberCount: 11, seasonStats: { points: 0, rank: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, gamesPlayed: 0 }, createdAt: 0 },
  { id: "d5", name: "울산 HD", logo: "", isApproved: true, memberCount: 11, seasonStats: { points: 0, rank: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, gamesPlayed: 0 }, createdAt: 0 },
  { id: "d6", name: "수원 삼성", logo: "", isApproved: true, memberCount: 11, seasonStats: { points: 0, rank: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, gamesPlayed: 0 }, createdAt: 0 },
  { id: "d7", name: "성남 FC", logo: "", isApproved: true, memberCount: 11, seasonStats: { points: 0, rank: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, gamesPlayed: 0 }, createdAt: 0 },
  { id: "d8", name: "대구 FC", logo: "", isApproved: true, memberCount: 11, seasonStats: { points: 0, rank: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, gamesPlayed: 0 }, createdAt: 0 },
  { id: "d9", name: "광주 FC", logo: "", isApproved: true, memberCount: 11, seasonStats: { points: 0, rank: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, gamesPlayed: 0 }, createdAt: 0 },
  { id: "d10", name: "제주 유나이티드", logo: "", isApproved: true, memberCount: 11, seasonStats: { points: 0, rank: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, gamesPlayed: 0 }, createdAt: 0 },
];

export default function HomePage() {
  const store = useDataStore();
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsLoaded, setTeamsLoaded] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamPlayers, setTeamPlayers] = useState<Player[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);

  useEffect(() => {
    const unsub = store.subscribeLiveMatches();

    const load = async () => {
      const [tournaments, teamsData] = await Promise.all([
        store.fetchTournaments(),
        store.fetchTeams(),
        store.fetchStandings(),
      ]);

      setTeams(teamsData.length > 0 ? teamsData : DEMO_TEAMS);
      setTeamsLoaded(true);

      // Collect recent finished matches across all tournaments
      const allMatches: Match[] = [];
      for (const t of tournaments.slice(0, 3)) {
        const ms = await store.fetchMatches(t.id);
        allMatches.push(...ms.filter((m) => m.status === "finished"));
      }
      allMatches.sort((a, b) => b.scheduledAt - a.scheduledAt);
      setRecentMatches(allMatches.slice(0, 4));
    };

    load();
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTeamSelect = async (team: Team) => {
    if (selectedTeam?.id === team.id) {
      setSelectedTeam(null);
      setTeamPlayers([]);
      return;
    }
    setSelectedTeam(team);
    setTeamPlayers([]);

    // 데모 팀이면 더미 데이터 바로 사용
    if (team.id.startsWith("d") && DEMO_TEAMS.some((t) => t.id === team.id)) {
      setTeamPlayers(DEMO_PLAYERS);
      return;
    }

    setPlayersLoading(true);
    const players = await store.fetchTeamPlayers(team.id);
    setTeamPlayers(players);
    setPlayersLoading(false);
  };

  return (
    <div>
      {/* ===== HERO ===== */}
      <div style={{ background: "#0D1B2A" }}>
        <video
          className="w-full block"
          src="/FairGroundAd.mp4"
          autoPlay
          muted
          loop
          playsInline
        />
      </div>

      {/* ===== LIVE MATCHES ===== */}
      {store.liveMatches.length > 0 && (
        <section className="py-16 px-6 md:px-10" style={{ background: "#0D1B2A" }}>
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <span className="h-2.5 w-2.5 rounded-full bg-fg-coral animate-pulse-dot" />
              <span
                className="text-[11px] uppercase tracking-[3px] font-semibold"
                style={{ fontFamily: "var(--font-space-mono)", color: "#FF6B6B" }}
              >
                라이브 경기
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {store.liveMatches.map((m) => (
                <MatchCard key={m.id} match={m} showTimer />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== WHY FAIRGROUND ===== */}
      <Section label="WHY FAIRGROUND" title="현 풋살대회의 문제점">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {([
            {
              num: "01",
              emoji: "🏆",
              title: "경쟁만 강요하는 구조",
              problems: [
                "한 번 지면 끝, 30분 뛰고 집에 간다",
                "실력 무시한 대진 — 초보팀이 10-0으로 무너진다",
                "우승팀만 보상, 나머지는 기억에도 없다",
                "진 팀은 조용히 짐 싸고 나가는 분위기",
              ],
              accent: "#FFD700",
            },
            {
              num: "02",
              emoji: "⏳",
              title: "돈 내고 시간 버리는 경험",
              problems: [
                "2시간 기다려 15분 뛰는 일이 흔하다",
                "팀당 참가비 내고 돌아오는 게 없다",
                "골·어시스트 기록이 전혀 남지 않는다",
                "이전 대회 성과가 다음으로 이어지지 않는다",
              ],
              accent: "#FF6B6B",
            },
            {
              num: "03",
              emoji: "🚪",
              title: "처음부터 막혀있는 문",
              problems: [
                "팀 없으면 참가 불가 — 개인은 방법이 없다",
                "분위기 자체가 '잘하는 남성'을 전제로 한다",
                "정보가 카페·밴드에 흩어져 찾기 어렵다",
                "거친 플레이 방치, 심판 오심 난무",
              ],
              accent: "#4FC3F7",
            },
          ] as const).map((card) => (
            <div
              key={card.num}
              className="rounded-2xl overflow-hidden flex flex-col transition-all hover:-translate-y-1"
              style={{ background: "#F0F4F8", border: "1px solid #E2EAF0" }}
            >
              {/* Header */}
              <div className="px-7 pt-7 pb-6 flex-1">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <span className="text-3xl mb-2 block">{card.emoji}</span>
                    <h3
                      className="font-bold text-xl leading-snug"
                      style={{ color: "#1A2B3C", letterSpacing: "-0.3px" }}
                    >
                      {card.title}
                    </h3>
                  </div>
                  <span
                    className="font-black text-4xl shrink-0 ml-3"
                    style={{ color: "#E2EAF0", fontFamily: "var(--font-outfit)", lineHeight: 1 }}
                  >
                    {card.num}
                  </span>
                </div>

                {/* Problem list */}
                <ul className="space-y-3">
                  {card.problems.map((p, i) => (
                    <li key={i} className="flex gap-3 text-sm leading-relaxed" style={{ color: "#334E68" }}>
                      <span
                        className="shrink-0 w-1.5 h-1.5 rounded-full"
                        style={{ background: "#FF6B6B", marginTop: "7px" }}
                      />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>

            </div>
          ))}
        </div>
      </Section>

      {/* ===== SOLUTIONS ===== */}
      <Section label="HOW WE FIX IT" title="FairGround의 해결책">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {([
            {
              num: "01",
              emoji: "🔄",
              title: "시즌내내 화합하고 즐기는 축제",
              solutions: [
                "탈락 없이 시즌 전체를 뛴다",
                "시즌 후 상·하위 리그 분할 — 수준에 맞는 매칭",
                "참가팀 전원 시상",
                "꾸준히 나올수록 승점이 쌓인다",
              ],
            },
            {
              num: "02",
              emoji: "📊",
              title: "기록이 남는 경험",
              solutions: [
                "5경기 보장 — 충분한 경기 시간, 대기 최소화",
                "참가비만큼의 경험과 가치를 돌려준다",
                "골·어시스트·출전 기록 자동 저장",
                "시즌 성과가 다음 시즌으로 이어진다",
              ],
            },
            {
              num: "03",
              emoji: "🤝",
              title: "누구나 환영",
              solutions: [
                "개인 참가 가능, 팀 매칭 지원",
                "여성 2인 의무 출전 규정",
                "앱 하나로 모든 정보 한눈에",
                "안전 규정 최우선 + 경기 후 심판 평가로 운영 향상",
              ],
            },
          ] as const).map((card) => (
            <div
              key={card.num}
              className="rounded-2xl overflow-hidden flex flex-col transition-all hover:-translate-y-1"
              style={{ background: "#F0F4F8", border: "1px solid #D6E4EE" }}
            >
              <div className="px-7 pt-7 pb-6 flex-1">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <span className="text-3xl mb-2 block">{card.emoji}</span>
                    <h3
                      className="font-bold text-xl leading-snug"
                      style={{ color: "#1A2B3C", letterSpacing: "-0.3px" }}
                    >
                      {card.title}
                    </h3>
                  </div>
                  <span
                    className="font-black text-4xl shrink-0 ml-3"
                    style={{ color: "#D6E4EE", fontFamily: "var(--font-outfit)", lineHeight: 1 }}
                  >
                    {card.num}
                  </span>
                </div>

                <ul className="space-y-3">
                  {card.solutions.map((s, i) => (
                    <li key={i} className="flex gap-3 text-sm leading-relaxed" style={{ color: "#334E68" }}>
                      <span
                        className="shrink-0 w-1.5 h-1.5 rounded-full"
                        style={{ background: "#00C853", marginTop: "7px" }}
                      />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>

            </div>
          ))}
        </div>
      </Section>

      {/* ===== RECENT RESULTS ===== */}
      {recentMatches.length > 0 && (
        <Section label="RECENT RESULTS" title="최근 경기 결과" dark>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recentMatches.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link
              href="/tournaments"
              className="inline-flex items-center gap-2 text-sm transition-colors"
              style={{ color: "#00C853" }}
            >
              전체 경기 보기
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Section>
      )}

      {/* ===== STANDINGS PREVIEW ===== */}
      {store.standings.length > 0 && (
        <Section label="LEAGUE TABLE" title="리그 순위">
          <StandingsTable standings={store.standings} limit={5} />
          <div className="mt-6 text-center">
            <Link
              href="/standings"
              className="inline-flex items-center gap-2 text-sm font-medium transition-colors"
              style={{ color: "#00C853" }}
            >
              전체 순위 보기
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Section>
      )}

      {/* ===== TEAMS SHOWCASE ===== */}
      {teamsLoaded && (
        <section className="py-20 overflow-hidden" style={{ background: "#0D1B2A" }}>
          <div className="max-w-6xl mx-auto px-6 md:px-10 mb-6">
            <p
              className="text-[11px] uppercase tracking-[3px] mb-3"
              style={{ fontFamily: "var(--font-space-mono)", color: "#00C853" }}
            >
              PARTICIPATING TEAMS
            </p>
            <div className="flex items-end justify-between gap-4">
              <h2
                className="font-extrabold"
                style={{
                  fontFamily: "var(--font-outfit), Outfit, sans-serif",
                  fontSize: "clamp(28px, 4vw, 42px)",
                  letterSpacing: "-1.5px",
                  color: "#FAFCFF",
                }}
              >
                참가 팀 소개
              </h2>
              <Link
                href="/teams"
                className="inline-flex items-center gap-2 text-sm font-medium mb-1 transition-colors shrink-0"
                style={{ color: "#00C853" }}
              >
                전체 팀 보기
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Circular 3D Gallery */}
          <div className="w-full h-[420px]">
            <CircularGallery
              items={teams.map((team, i): GalleryItem => ({
                id: team.id,
                common: team.name,
                binomial: `${team.seasonStats.wins}W ${team.seasonStats.draws}D ${team.seasonStats.losses}L`,
                photo: {
                  url: team.logo ?? "",
                  text: team.name,
                  by: `${team.memberCount}명`,
                },
                colorIndex: i,
              }))}
              radius={520}
              autoRotateSpeed={0.25}
              selectedId={selectedTeam?.id}
              onItemClick={(item) => {
                const team = teams.find((t) => t.id === item.id);
                if (team) handleTeamSelect(team);
              }}
            />
          </div>

          {/* Selected team players */}
          {selectedTeam && (
            <div className="max-w-6xl mx-auto px-6 md:px-10 mt-10">
            <div
              className="rounded-2xl overflow-hidden"
              style={{ border: "1px solid rgba(0,200,83,0.2)", background: "rgba(0,200,83,0.04)" }}
            >
              {/* Panel header */}
              <div
                className="flex items-center justify-between px-6 py-4"
                style={{ borderBottom: "1px solid rgba(0,200,83,0.15)" }}
              >
                <div className="flex items-center gap-3">
                  {selectedTeam.logo ? (
                    <img src={selectedTeam.logo} alt={selectedTeam.name} className="w-8 h-8 object-contain" />
                  ) : (
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black"
                      style={{ background: "rgba(0,200,83,0.2)", color: "#00C853" }}
                    >
                      {selectedTeam.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-sm" style={{ color: "#FAFCFF" }}>{selectedTeam.name}</p>
                    <p className="text-xs" style={{ color: "#627D98" }}>선수 카드</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Link
                    href={`/teams/${selectedTeam.id}`}
                    className="text-xs font-medium transition-colors"
                    style={{ color: "#00C853" }}
                  >
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

              {/* Players — role-sorted spread animation */}
              <div className="px-6 pb-6 pt-4">
                {playersLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div
                      className="w-6 h-6 rounded-full border-2 animate-spin"
                      style={{ borderColor: "#00C853", borderTopColor: "transparent" }}
                    />
                  </div>
                ) : teamPlayers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2">
                    <p className="text-sm" style={{ color: "#627D98" }}>등록된 선수가 없습니다</p>
                    <Link href={`/teams/${selectedTeam.id}`} className="text-xs" style={{ color: "#00C853" }}>
                      팀 페이지에서 확인하기 →
                    </Link>
                  </div>
                ) : (() => {
                  // 역할 순 정렬 (감독→주장→선수), 최대 20명
                  const sorted = [...teamPlayers]
                    .sort((a, b) => (ROLE_ORDER[a.role] ?? 3) - (ROLE_ORDER[b.role] ?? 3))
                    .slice(0, 20);
                  const STACK_ROTATIONS = [0, -5, 4, -3, 6, -4, 3, -6, 2, -2, 5, -2, 3, -4, 6, -3, 4, -5, 0, 2];
                  return (
                    <div className="grid grid-cols-5 gap-4">
                      {sorted.map((player, i) => {
                        const roleLabel = ROLE_LABELS[player.role] ?? "선수";
                        const isSpecial = player.role === "admin" || player.role === "captain";
                        const labelColor = player.role === "admin"
                          ? "#FFD700"
                          : player.role === "captain"
                          ? "#00C853"
                          : "#627D98";
                        return (
                          <motion.div
                            key={`${selectedTeam.id}-${player.id}`}
                            className="flex flex-col items-center gap-1.5 shrink-0"
                            initial={{ x: -80, opacity: 0, rotate: STACK_ROTATIONS[i % STACK_ROTATIONS.length] }}
                            animate={{ x: 0, opacity: 1, rotate: 0 }}
                            transition={{
                              delay: i * 0.055,
                              type: "spring",
                              stiffness: 220,
                              damping: 22,
                            }}
                          >
                            {/* Role badge */}
                            <div
                              className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide"
                              style={{
                                background: isSpecial ? `${labelColor}22` : "rgba(255,255,255,0.05)",
                                border: `1px solid ${isSpecial ? labelColor : "rgba(255,255,255,0.1)"}`,
                                color: labelColor,
                                fontFamily: "var(--font-space-mono)",
                              }}
                            >
                              {roleLabel}
                            </div>
                            <Link href={`/players/${player.id}`}>
                              <PlayerCard player={player} size="lg" />
                            </Link>
                          </motion.div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
