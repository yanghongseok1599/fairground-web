"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useDataStore } from "@/stores/dataStore";
import { PlayerCard } from "@/components/player-card";
import { BoardPage, type BoardPost } from "@/components/board-page";
import type { Team, Player } from "@/types";
import { ArrowLeft, Users } from "lucide-react";

const DEMO_BOARD_POSTS: BoardPost[] = [
  {
    id: "tb1",
    title: "다음 경기 준비 어떻게 하고 계세요?",
    content: "이번 주 토요일 경기인데 다들 어떻게 준비하고 계신가요?\n\n개인적으로 컨디션 관리에 집중하고 있습니다. 부상 없이 다들 좋은 경기 해봅시다!",
    authorId: "m1",
    authorName: "팀원A",
    createdAt: Date.now() - 1000 * 60 * 60 * 2,
  },
  {
    id: "tb2",
    title: "훈련 일정 공유",
    content: "이번 주 훈련 일정입니다.\n\n▪ 화요일 저녁 7시 — 패스 + 압박 훈련\n▪ 목요일 저녁 8시 — 전술 미팅\n▪ 토요일 오전 10시 — 실전 연습\n\n불참자는 미리 알려주세요!",
    authorId: "m2",
    authorName: "팀원B",
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
  },
  {
    id: "tb3",
    title: "유니폼 추가 주문 받습니다",
    content: "유니폼 추가 제작 희망자 모집합니다.\n\n▸ 가격: 45,000원\n▸ 마감: 이번 주 금요일\n▸ 수령: 2주 후\n\n원하시는 분은 댓글 달아주세요.",
    authorId: "m3",
    authorName: "팀원C",
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
  },
];

const DEMO_TEAMS: Record<string, Team> = {
  d1: { id: "d1", name: "FC 서울", logo: "", isApproved: true, memberCount: 11, seasonStats: { points: 28, rank: 1, wins: 9, draws: 1, losses: 2, goalsFor: 34, goalsAgainst: 14, goalDifference: 20, gamesPlayed: 12 }, createdAt: 0 },
  d2: { id: "d2", name: "부산 아이파크", logo: "", isApproved: true, memberCount: 10, seasonStats: { points: 22, rank: 2, wins: 7, draws: 1, losses: 4, goalsFor: 27, goalsAgainst: 18, goalDifference: 9, gamesPlayed: 12 }, createdAt: 0 },
  d3: { id: "d3", name: "인천 유나이티드", logo: "", isApproved: true, memberCount: 12, seasonStats: { points: 20, rank: 3, wins: 6, draws: 2, losses: 4, goalsFor: 22, goalsAgainst: 19, goalDifference: 3, gamesPlayed: 12 }, createdAt: 0 },
  d4: { id: "d4", name: "전북 현대", logo: "", isApproved: true, memberCount: 11, seasonStats: { points: 19, rank: 4, wins: 6, draws: 1, losses: 5, goalsFor: 25, goalsAgainst: 22, goalDifference: 3, gamesPlayed: 12 }, createdAt: 0 },
  d5: { id: "d5", name: "울산 HD", logo: "", isApproved: true, memberCount: 10, seasonStats: { points: 17, rank: 5, wins: 5, draws: 2, losses: 5, goalsFor: 20, goalsAgainst: 21, goalDifference: -1, gamesPlayed: 12 }, createdAt: 0 },
  d6: { id: "d6", name: "수원 삼성", logo: "", isApproved: true, memberCount: 11, seasonStats: { points: 15, rank: 6, wins: 4, draws: 3, losses: 5, goalsFor: 18, goalsAgainst: 23, goalDifference: -5, gamesPlayed: 12 }, createdAt: 0 },
  d7: { id: "d7", name: "성남 FC", logo: "", isApproved: true, memberCount: 9, seasonStats: { points: 13, rank: 7, wins: 4, draws: 1, losses: 7, goalsFor: 16, goalsAgainst: 26, goalDifference: -10, gamesPlayed: 12 }, createdAt: 0 },
  d8: { id: "d8", name: "대구 FC", logo: "", isApproved: true, memberCount: 10, seasonStats: { points: 11, rank: 8, wins: 3, draws: 2, losses: 7, goalsFor: 14, goalsAgainst: 28, goalDifference: -14, gamesPlayed: 12 }, createdAt: 0 },
};

const DEMO_PLAYERS: Player[] = [
  { id: "dp0", uid: "dp0", name: "이감독", number: 0, position: "FIXO", teamId: "d1", nationality: "KOR", photoUrl: "https://randomuser.me/api/portraits/men/3.jpg", cardType: "gold", cardRating: 92, stats: { goals: 0, assists: 0, games: 18, mom: 0 }, badges: [], penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 0 }, isApproved: true, role: "admin", createdAt: 0 },
  { id: "dp1", uid: "dp1", name: "김민준", number: 10, position: "PIVO", teamId: "d1", nationality: "KOR", photoUrl: "https://randomuser.me/api/portraits/men/32.jpg", cardType: "gold", cardRating: 88, stats: { goals: 12, assists: 7, games: 18, mom: 4 }, badges: [], penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 1 }, isApproved: true, role: "captain", createdAt: 0 },
  { id: "dp2", uid: "dp2", name: "이재원", number: 7, position: "ALA", teamId: "d1", nationality: "KOR", photoUrl: "https://randomuser.me/api/portraits/men/45.jpg", cardType: "gold", cardRating: 84, stats: { goals: 8, assists: 11, games: 17, mom: 3 }, badges: [], penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 0 }, isApproved: true, role: "player", createdAt: 0 },
  { id: "dp3", uid: "dp3", name: "박성호", number: 1, position: "GK", teamId: "d1", nationality: "KOR", photoUrl: "https://randomuser.me/api/portraits/men/12.jpg", cardType: "gold", cardRating: 82, stats: { goals: 0, assists: 1, games: 16, mom: 5 }, badges: [], penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 0 }, isApproved: true, role: "player", createdAt: 0 },
  { id: "dp4", uid: "dp4", name: "최현우", number: 5, position: "FIXO", teamId: "d1", nationality: "KOR", photoUrl: "https://randomuser.me/api/portraits/men/67.jpg", cardType: "premium", cardRating: 79, stats: { goals: 3, assists: 5, games: 15, mom: 1 }, badges: [], penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 2 }, isApproved: true, role: "player", createdAt: 0 },
];

export default function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const store = useDataStore();
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [t, ps] = await Promise.all([
        store.fetchTeam(id),
        store.fetchTeamPlayers(id),
      ]);
      // 데모 팀 폴백
      setTeam(t ?? DEMO_TEAMS[id] ?? null);
      const resolvedPlayers = ps.filter((p) => p.isApproved).sort((a, b) => b.cardRating - a.cardRating);
      setPlayers(resolvedPlayers.length > 0 ? resolvedPlayers : DEMO_PLAYERS);
      setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return (
    <div className="pt-[60px] min-h-screen flex items-center justify-center" style={{ background: "#0D1B2A" }}>
      <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: "#00C853", borderTopColor: "transparent" }} />
    </div>
  );
  if (!team) return (
    <div className="pt-[60px] min-h-screen flex items-center justify-center" style={{ background: "#0D1B2A", color: "#627D98" }}>
      팀을 찾을 수 없습니다
    </div>
  );

  return (
    <div className="pt-[60px] min-h-screen" style={{ background: "#0D1B2A" }}>
      <div className="py-10 px-6 md:px-10" style={{ background: "#0D1B2A" }}>
        <div className="max-w-6xl mx-auto">
          <Link href="/teams" className="inline-flex items-center gap-2 text-sm mb-6 transition-colors" style={{ color: "#627D98" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#00C853"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#627D98"; }}
          >
            <ArrowLeft className="h-4 w-4" /> 팀 목록
          </Link>

          <div className="flex items-start gap-6">
            {team.logo ? (
              <img src={team.logo} alt={team.name} className="w-20 h-20 rounded-2xl object-cover border border-fg-green/20" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-fg-navy-light flex items-center justify-center font-black text-2xl text-fg-green" style={{ fontFamily: "var(--font-outfit)" }}>
                {team.name.slice(0, 2)}
              </div>
            )}
            <div>
              <h1 className="font-black leading-none mb-1" style={{ fontFamily: "var(--font-outfit)", fontSize: "clamp(28px, 5vw, 48px)", letterSpacing: "-2px", color: "#FAFCFF" }}>
                {team.name}
              </h1>
              <div className="flex items-center gap-2 text-sm" style={{ color: "#627D98" }}>
                <Users className="h-4 w-4" />
                <span>{team.memberCount}명</span>
                {team.foundedYear && <><span>·</span><span>{team.foundedYear}년 창단</span></>}
              </div>
            </div>
          </div>

          {/* Season stats */}
          {team.seasonStats && (
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {[
                { label: "승점", value: team.seasonStats.points },
                { label: "경기", value: team.seasonStats.gamesPlayed },
                { label: "승", value: team.seasonStats.wins },
                { label: "무", value: team.seasonStats.draws },
                { label: "패", value: team.seasonStats.losses },
                { label: "득점", value: team.seasonStats.goalsFor },
                { label: "실점", value: team.seasonStats.goalsAgainst },
              ].map((s) => (
                <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: "rgba(0,200,83,0.08)", border: "1px solid rgba(0,200,83,0.15)" }}>
                  <div className="font-black text-xl tabular-nums mb-0.5" style={{ fontFamily: "var(--font-outfit)", color: "#FAFCFF" }}>{s.value}</div>
                  <div className="text-[10px] uppercase" style={{ fontFamily: "var(--font-space-mono)", color: "#627D98" }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Roster */}
      <div className="px-6 md:px-10 py-10" style={{ background: "#0D1B2A" }}>
        <div className="max-w-6xl mx-auto">
          <h2 className="text-xl font-bold mb-6" style={{ fontFamily: "var(--font-outfit)", color: "#FAFCFF", letterSpacing: "-0.5px" }}>
            선수 로스터 ({players.length}명)
          </h2>
          {players.length === 0 ? (
            <div className="py-12 text-center" style={{ color: "#627D98" }}>등록된 선수가 없습니다</div>
          ) : (
            <div className="flex flex-wrap justify-center gap-4">
              {players.map((p) => (
                <Link key={p.id} href={`/players/${p.id}`} className="hover:scale-105 transition-transform">
                  <PlayerCard player={p} size="sm" teamLogo={team.logo} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Team Board */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "#0D1B2A" }}>
        <div className="px-6 md:px-10 pt-8 pb-2 max-w-4xl mx-auto">
          <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-outfit)", color: "#FAFCFF", letterSpacing: "-0.5px" }}>
            팀 게시판
          </h2>
          <p className="text-sm mt-1" style={{ color: "#627D98" }}>팀원만 글을 작성할 수 있습니다</p>
        </div>
        <BoardPage
          pageTitle=""
          pageSubtitle=""
          label=""
          accentColor="#00C853"
          dbPath={`teamBoard/${id}`}
          writeRole="team"
          requiredTeamId={id}
          demoPosts={DEMO_BOARD_POSTS}
          hideHeader
        />
      </div>
    </div>
  );
}
