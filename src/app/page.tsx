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
import { ScrollVideoHero, type HeroReveal } from "@/components/scroll-video-hero";
import type { Match, Team, Player } from "@/types";
import { ArrowRight, X } from "lucide-react";

const ROLE_ORDER: Record<string, number> = { admin: 0, captain: 1, referee: 2, player: 3 };
const ROLE_LABELS: Record<string, string> = { admin: "감독", captain: "주장", referee: "심판", player: "선수" };

// ─── HERO REVEAL SEQUENCE ───────────────────────────────────────────────
// Five fade-in/fade-out overlays that play across the scroll-scrubbed hero.
// Shared styles for the Korean display lines.
const KR_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-pretendard), sans-serif",
  fontWeight: 900,
  color: "#ffffff",
  fontSize: "clamp(64px, 13vw, 180px)",
  lineHeight: 1,
  letterSpacing: "-0.03em",
  textShadow: "0 6px 30px rgba(0,0,0,0.45), 0 0 80px rgba(0,0,0,0.25)",
};

const HERO_REVEALS: HeroReveal[] = [
  { range: [0.00, 0.20], content: <div style={KR_STYLE}>모두가</div> },
  { range: [0.20, 0.40], content: <div style={KR_STYLE}>승리하는</div> },
  {
    range: [0.40, 0.60],
    content: (
      <div style={{ ...KR_STYLE, color: "#1B5EFF" }}>그라운드</div>
    ),
  },
  {
    range: [0.60, 0.80],
    content: (
      <div
        className="text-center"
        style={{
          fontFamily: "var(--font-pretendard), sans-serif",
          fontWeight: 900,
          color: "#ffffff",
          fontSize: "clamp(28px, 5.5vw, 86px)",
          lineHeight: 1.05,
          letterSpacing: "-0.01em",
          textShadow: "0 6px 30px rgba(0,0,0,0.45), 0 0 80px rgba(0,0,0,0.25)",
        }}
      >
        EVERYONE WINS
        <br />
        ON THIS GROUND
      </div>
    ),
  },
  {
    range: [0.80, 1.00],
    fadeOut: 0, // logo holds at full opacity through the end of the hero
    content: (
      <div
        role="img"
        aria-label="FairGround"
        style={{
          width: "clamp(260px, 46vw, 620px)",
          aspectRatio: "3603 / 767",
          background: "#ffffff",
          WebkitMaskImage: "url(/images/logo-horizontal.png)",
          WebkitMaskRepeat: "no-repeat",
          WebkitMaskSize: "contain",
          WebkitMaskPosition: "center",
          maskImage: "url(/images/logo-horizontal.png)",
          maskRepeat: "no-repeat",
          maskSize: "contain",
          maskPosition: "center",
          filter: "drop-shadow(0 10px 30px rgba(0,0,0,0.35))",
        }}
      />
    ),
  },
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

      setTeams(teamsData);
      setTeamsLoaded(true);

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

    setPlayersLoading(true);
    const players = await store.fetchTeamPlayers(team.id);
    setTeamPlayers(players);
    setPlayersLoading(false);
  };

  const totalPlayers = teams.reduce((s, t) => s + (t.memberCount || 0), 0);
  const totalTeams = teams.length;
  const totalMatches = Math.floor(store.standings.reduce((s, t) => s + (t.gamesPlayed || 0), 0) / 2);
  const totalGoals = store.standings.reduce((s, t) => s + (t.goalsFor || 0), 0);
  const seasonName = store.currentSeason?.name ?? null;

  return (
    <div>
      {/* ============================================================
          HERO — Scroll-Scrubbed Stadium Entrance (video + reveals)
          ============================================================ */}
      <section className="relative" style={{ background: "#ffffff" }}>
        <ScrollVideoHero
          scrollLength={2.6}
          fit="cover"
          aspect={1920 / 940}
          background="#ffffff"
          stickyTop={60}
          reveals={HERO_REVEALS}
        />
      </section>

      {/* ============================================================
          HERO COPY — below the video
          ============================================================ */}
      <section className="relative" style={{ background: "#ffffff" }}>
        <div className="absolute inset-x-0 bottom-0 h-[55%] fg-stadium-lines pointer-events-none" />
        <div className="absolute inset-0 fg-grid opacity-40 pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-5 md:px-10 pt-14 md:pt-20 pb-16 md:pb-20">
          {/* top meta strip — 실데이터만 표시(가짜 시즌/주차/시간/날씨 제거) */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-6 border-b" style={{ borderColor: "#EAEEF5" }}>
            <div className="flex items-center gap-5 fg-label" style={{ color: "#4E5A6B" }}>
              {seasonName ? (
                <span>{seasonName}</span>
              ) : (
                <span>FAIRGROUND LEAGUE</span>
              )}
            </div>
            <div className="flex items-center gap-5 fg-label" style={{ color: "#4E5A6B" }}>
              <span>SEOUL</span>
            </div>
          </div>

          <div className="pt-10 md:pt-14 animate-fade-up">
            {/* live pill */}
            <div
              className="inline-flex items-center gap-2 px-2.5 py-1 mb-8 border"
              style={{ borderColor: "#FF3B30", background: "rgba(255,59,48,0.08)" }}
            >
              <span
                className="h-[6px] w-[6px] rounded-full animate-pulse-dot"
                style={{ background: "#FF3B30", boxShadow: "0 0 8px #FF3B30" }}
              />
              <span className="fg-label" style={{ color: "#FF3B30" }}>LIVE</span>
            </div>

            <h1 className="fg-display text-[#0A1220]">
              <span className="block" style={{ fontSize: "clamp(56px, 10vw, 140px)", lineHeight: 0.9 }}>
                WHERE
              </span>
              <span className="block" style={{ fontSize: "clamp(56px, 10vw, 140px)", lineHeight: 0.9, color: "#1B5EFF" }}>
                AMATEURS
              </span>
              <span className="block" style={{ fontSize: "clamp(56px, 10vw, 140px)", lineHeight: 0.9 }}>
                PLAY PRO.
              </span>
            </h1>

            <p
              className="mt-8 max-w-xl text-[15px] leading-relaxed"
              style={{ color: "#4E5A6B", fontFamily: "var(--font-pretendard)" }}
            >
              서울 유일의 아마추어 풋살 리그. 실시간 스코어, 개인 스탯,
              <br className="hidden md:block" />
              FIFA 스타일 선수 카드까지 — 경기장 밖에서도 프로처럼.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link
                href="/live"
                className="group inline-flex items-center gap-3 px-6 py-3.5 fg-display tracking-[0.08em] text-[15px] transition-transform hover:-translate-y-0.5"
                style={{ background: "#1B5EFF", color: "#ffffff" }}
              >
                라이브 보기
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-3 px-6 py-3.5 fg-display tracking-[0.08em] text-[15px] border transition-colors hover:bg-[#F4F6FA]"
                style={{ borderColor: "#E5E8EE", color: "#0A1220" }}
              >
                리그 참가
              </Link>
            </div>
          </div>

          {/* STAT BAND */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px mt-16 border" style={{ borderColor: "#EAEEF5", background: "#EAEEF5" }}>
            {[
              { label: "ACTIVE PLAYERS", value: totalPlayers },
              { label: "TEAMS",           value: totalTeams   },
              { label: "MATCHES PLAYED",  value: totalMatches },
              { label: "GOALS",           value: totalGoals   },
            ].map((s) => (
              <div key={s.label} className="px-5 py-7" style={{ background: "#ffffff" }}>
                <div className="fg-label mb-3" style={{ color: "#7A8496" }}>{s.label}</div>
                <div className="fg-display fg-mono tabular-nums text-[#0A1220]" style={{ fontSize: "clamp(32px, 4vw, 52px)", lineHeight: 1 }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          LIVE MATCHES STRIP (only when real live games exist)
          ============================================================ */}
      {store.liveMatches.length > 0 && (
        <section className="py-14 px-5 md:px-10" style={{ background: "#ffffff", borderTop: "1px solid #EAEEF5" }}>
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between gap-4 mb-8">
              <div className="flex items-center gap-3">
                <span
                  className="h-2.5 w-2.5 rounded-full animate-pulse-dot"
                  style={{ background: "#FF3B30", boxShadow: "0 0 12px #FF3B30" }}
                />
                <span className="fg-label" style={{ color: "#FF3B30" }}>라이브 경기 · LIVE NOW</span>
              </div>
              <Link href="/live" className="fg-label hover:text-[#1B5EFF]" style={{ color: "#4E5A6B" }}>
                ALL →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {store.liveMatches.map((m) => (
                <MatchCard key={m.id} match={m} showTimer />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============================================================
          WHY FAIRGROUND
          ============================================================ */}
      <Section chapter="01" label="WHY FAIRGROUND" title="현 풋살대회의 문제점">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {([
            {
              num: "01",
              title: "경쟁만 강요하는 구조",
              problems: [
                "한 번 지면 끝, 30분 뛰고 집에 간다",
                "실력 무시한 대진 — 초보팀이 10-0으로 무너진다",
                "우승팀만 보상, 나머지는 기억에도 없다",
                "진 팀은 조용히 짐 싸고 나가는 분위기",
              ],
            },
            {
              num: "02",
              title: "돈 내고 시간 버리는 경험",
              problems: [
                "2시간 기다려 15분 뛰는 일이 흔하다",
                "팀당 참가비 내고 돌아오는 게 없다",
                "골·어시스트 기록이 전혀 남지 않는다",
                "이전 대회 성과가 다음으로 이어지지 않는다",
              ],
            },
            {
              num: "03",
              title: "처음부터 막혀있는 문",
              problems: [
                "팀 없으면 참가 불가 — 개인은 방법이 없다",
                "분위기 자체가 '잘하는 남성'을 전제로 한다",
                "정보가 카페·밴드에 흩어져 찾기 어렵다",
                "거친 플레이 방치, 심판 오심 난무",
              ],
            },
          ] as const).map((card) => (
            <div
              key={card.num}
              className="group relative p-7 transition-all hover:-translate-y-1 border"
              style={{ background: "#F4F6FA", borderColor: "#E5E8EE" }}
            >
              <div
                className="absolute top-0 left-0 h-[2px] w-full"
                style={{ background: "#FF3B30" }}
              />
              <div className="flex items-start justify-between mb-6">
                <span className="fg-mono text-[11px]" style={{ color: "#FF3B30" }}>
                  PROB · {card.num}
                </span>
                <span
                  className="fg-display"
                  style={{ fontSize: 44, color: "#EAEEF5", lineHeight: 1 }}
                >
                  {card.num}
                </span>
              </div>
              <h3
                className="fg-display text-[#0A1220] mb-6"
                style={{ fontSize: 26, lineHeight: 1.05 }}
              >
                {card.title}
              </h3>
              <ul className="space-y-3">
                {card.problems.map((p, i) => (
                  <li
                    key={i}
                    className="flex gap-3 text-[13px] leading-relaxed"
                    style={{ color: "#4E5A6B", fontFamily: "var(--font-pretendard)" }}
                  >
                    <span
                      className="shrink-0 mt-[6px] w-2 h-[2px]"
                      style={{ background: "#FF3B30" }}
                    />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* ============================================================
          HOW WE FIX IT
          ============================================================ */}
      <Section chapter="02" label="HOW WE FIX IT" title="FAIRGROUND의 해결책">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {([
            {
              num: "01",
              title: "시즌 내내 화합하고 즐기는 축제",
              solutions: [
                "탈락 없이 시즌 전체를 뛴다",
                "시즌 후 상·하위 리그 분할 — 수준에 맞는 매칭",
                "참가팀 전원 시상",
                "꾸준히 나올수록 승점이 쌓인다",
              ],
            },
            {
              num: "02",
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
              className="group relative p-7 transition-all hover:-translate-y-1 border"
              style={{ background: "#F4F6FA", borderColor: "#E5E8EE" }}
            >
              <div
                className="absolute top-0 left-0 h-[2px] w-full"
                style={{ background: "#1B5EFF" }}
              />
              <div className="flex items-start justify-between mb-6">
                <span className="fg-mono text-[11px]" style={{ color: "#1B5EFF" }}>
                  SOLV · {card.num}
                </span>
                <span
                  className="fg-display"
                  style={{ fontSize: 44, color: "#EAEEF5", lineHeight: 1 }}
                >
                  {card.num}
                </span>
              </div>
              <h3
                className="fg-display text-[#0A1220] mb-6"
                style={{ fontSize: 26, lineHeight: 1.05 }}
              >
                {card.title}
              </h3>
              <ul className="space-y-3">
                {card.solutions.map((s, i) => (
                  <li
                    key={i}
                    className="flex gap-3 text-[13px] leading-relaxed"
                    style={{ color: "#4E5A6B", fontFamily: "var(--font-pretendard)" }}
                  >
                    <span
                      className="shrink-0 mt-[6px] w-2 h-[2px]"
                      style={{ background: "#1B5EFF" }}
                    />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* ============================================================
          LIME TICKER RIBBON
          ============================================================ */}
      <div
        className="py-3 overflow-hidden border-y"
        style={{ background: "#1B5EFF", borderColor: "#1B5EFF" }}
      >
        <div className="flex whitespace-nowrap animate-ticker fg-display tracking-[0.12em] text-[14px]" style={{ color: "#ffffff" }}>
          {Array.from({ length: 2 }).map((_, i) => (
            <span key={i} className="flex items-center gap-6 px-6">
              {[
                "EVERY GOAL COUNTS",
                "LIVE SCORES · REAL STATS",
                "FIFA STYLE PLAYER CARDS",
                "PLAY YOUR GROWTH",
                "EVERYONE WINS ON THIS GROUND",
              ].map((t, j) => (
                <span key={`${i}-${j}`} className="flex items-center gap-6">
                  <span>{t}</span>
                  <span className="inline-block w-2 h-2 rotate-45" style={{ background: "#ffffff" }} />
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* ============================================================
          RECENT RESULTS
          ============================================================ */}
      {recentMatches.length > 0 && (
        <Section chapter="03" label="RECENT RESULTS" title="최근 경기 결과" dark>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {recentMatches.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
          <div className="mt-10">
            <Link
              href="/tournaments"
              className="group inline-flex items-center gap-3 fg-label hover:text-[#1B5EFF] transition-colors"
              style={{ color: "#4E5A6B" }}
            >
              <span className="inline-block w-6 h-[2px] group-hover:w-10 transition-all" style={{ background: "#1B5EFF" }} />
              전체 경기 보기
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Section>
      )}

      {/* ============================================================
          STANDINGS PREVIEW
          ============================================================ */}
      {store.standings.length > 0 && (
        <Section chapter="04" label="LEAGUE TABLE" title="리그 순위">
          <StandingsTable standings={store.standings} limit={5} />
          <div className="mt-8">
            <Link
              href="/standings"
              className="group inline-flex items-center gap-3 fg-label hover:text-[#1B5EFF] transition-colors"
              style={{ color: "#4E5A6B" }}
            >
              <span className="inline-block w-6 h-[2px] group-hover:w-10 transition-all" style={{ background: "#1B5EFF" }} />
              전체 순위 보기
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Section>
      )}

      {/* ============================================================
          TEAMS SHOWCASE
          ============================================================ */}
      {teamsLoaded && (
        <section className="relative py-24 overflow-hidden" style={{ background: "#F4F6FA", borderTop: "1px solid #EAEEF5" }}>
          <div className="absolute inset-0 fg-grid opacity-40 pointer-events-none" />
          <div className="relative max-w-6xl mx-auto px-5 md:px-10 mb-8">
            <div className="flex items-start gap-6 mb-10">
              <span className="fg-mono text-[11px] mt-2" style={{ color: "#1B5EFF" }}>05</span>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-block w-2 h-2" style={{ background: "#1B5EFF" }} />
                  <span className="fg-label" style={{ color: "#1B5EFF" }}>PARTICIPATING TEAMS</span>
                </div>
                <div className="flex items-end justify-between gap-4">
                  <h2 className="fg-display text-[#0A1220]" style={{ fontSize: "clamp(36px, 6vw, 72px)" }}>
                    참가 팀 소개
                  </h2>
                  <Link
                    href="/teams"
                    className="group inline-flex items-center gap-3 fg-label hover:text-[#1B5EFF] transition-colors shrink-0 mb-3"
                    style={{ color: "#4E5A6B" }}
                  >
                    <span className="inline-block w-6 h-[2px] group-hover:w-10 transition-all" style={{ background: "#1B5EFF" }} />
                    ALL TEAMS
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="relative w-full h-[420px]">
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

          {selectedTeam && (
            <div className="relative max-w-6xl mx-auto px-5 md:px-10 mt-10">
              <div
                className="overflow-hidden border"
                style={{ borderColor: "#1B5EFF", background: "rgba(27,94,255,0.04)" }}
              >
                <div
                  className="flex items-center justify-between px-5 py-4"
                  style={{ borderBottom: "1px solid rgba(27,94,255,0.25)" }}
                >
                  <div className="flex items-center gap-3">
                    {selectedTeam.logo ? (
                      <img src={selectedTeam.logo} alt={selectedTeam.name} className="w-9 h-9 object-contain" />
                    ) : (
                      <div
                        className="w-9 h-9 grid place-items-center fg-display text-[13px]"
                        style={{ background: "#1B5EFF", color: "#ffffff" }}
                      >
                        {selectedTeam.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="fg-display text-[18px] tracking-wider" style={{ color: "#0A1220" }}>
                        {selectedTeam.name}
                      </p>
                      <p className="fg-label" style={{ color: "#7A8496" }}>ROSTER · PLAYER CARDS</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Link
                      href={`/teams/${selectedTeam.id}`}
                      className="fg-label hover:text-[#1B5EFF] transition-colors"
                      style={{ color: "#1B5EFF" }}
                    >
                      팀 페이지 →
                    </Link>
                    <button
                      onClick={() => { setSelectedTeam(null); setTeamPlayers([]); }}
                      className="opacity-60 hover:opacity-100 transition-opacity"
                      style={{ color: "#4E5A6B" }}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="px-5 pb-6 pt-4">
                  {playersLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div
                        className="w-6 h-6 rounded-full border-2 animate-spin"
                        style={{ borderColor: "#1B5EFF", borderTopColor: "transparent" }}
                      />
                    </div>
                  ) : teamPlayers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-2">
                      <p className="text-sm" style={{ color: "#7A8496" }}>등록된 선수가 없습니다</p>
                      <Link href={`/teams/${selectedTeam.id}`} className="fg-label" style={{ color: "#1B5EFF" }}>
                        팀 페이지에서 확인하기 →
                      </Link>
                    </div>
                  ) : (() => {
                    const sorted = [...teamPlayers]
                      .sort((a, b) => (ROLE_ORDER[a.role] ?? 3) - (ROLE_ORDER[b.role] ?? 3))
                      .slice(0, 20);
                    const STACK_ROTATIONS = [0, -5, 4, -3, 6, -4, 3, -6, 2, -2, 5, -2, 3, -4, 6, -3, 4, -5, 0, 2];
                    return (
                      <div className="grid grid-cols-5 gap-4">
                        {sorted.map((player, i) => {
                          const roleLabel = ROLE_LABELS[player.role] ?? "선수";
                          const isSpecial = player.role === "admin" || player.role === "captain";
                          const labelColor = player.role === "admin" ? "#1B5EFF" : player.role === "captain" ? "#1B5EFF" : "#7A8496";
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
                              <div
                                className="px-2 py-[3px] fg-label text-[9px]"
                                style={{
                                  background: isSpecial ? "rgba(27,94,255,0.1)" : "rgba(10,18,32,0.04)",
                                  border: `1px solid ${isSpecial ? labelColor : "#E5E8EE"}`,
                                  color: labelColor,
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
