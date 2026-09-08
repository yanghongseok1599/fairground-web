"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { useDataStore } from "@/stores/dataStore";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/hooks/useAuth";
import { PlayerCard, getCardTypeFromRating } from "@/components/player-card";
import { EmptyState } from "@/components/empty-state";
import { ScrollVideoHero, type HeroReveal } from "@/components/scroll-video-hero";
import type { TeamGalleryItem } from "@/components/team-circular-gallery";
import { getClubLogoPreset } from "@/components/club-emblem";
import { createTeamCardCanvas } from "@/lib/team-card-canvas";
import { isFieldChampionTeam, leagueTierCardIndex } from "@/lib/team-home";
import { FICTIONAL_PLAYER_CARD_POSE_SOURCES } from "@/lib/player-card-pose-templates";
import type { Team, Player } from "@/types";
import { ArrowRight, MapPin, Ticket, Trophy, Users } from "lucide-react";
import { TeamMarquee } from "@/components/team-marquee";
import { HomePromotionPopup } from "@/components/home-promotion-popup";
import { MIXED_FUTSAL_COVER_IMAGE_PATH } from "@/lib/mixed-futsal-assets";
import { SPONSOR_PROPOSAL_PATH } from "@/lib/site-config";
// 대회 정보는 전부 이 상수 모듈에서 가져온다. 날짜/장소를 홈에 문자열로
// 하드코딩하면 대회 정보가 바뀔 때 홈만 뒤처져 잘못된 안내가 남는다.
import {
  MIXED_FUTSAL_APPLY_PATH,
  MIXED_FUTSAL_EVENT_DATE_LABEL,
  MIXED_FUTSAL_EVENT_LOCATION_FULL_LABEL,
  MIXED_FUTSAL_EVENT_NAME,
  MIXED_FUTSAL_EVENT_PATH,
  MIXED_FUTSAL_EVENT_TIME_LABEL,
  MIXED_FUTSAL_ENTRY_FEE_LABEL,
  MIXED_FUTSAL_GUARANTEE_LABEL,
  MIXED_FUTSAL_MATCH_FORMAT_LABEL,
  MIXED_FUTSAL_TEAM_COUNT_LABEL,
} from "@/lib/mixed-futsal-event";

// ─── HERO REVEAL SEQUENCE ───────────────────────────────────────────────
// Five fade-in/fade-out overlays that play across the scroll-scrubbed hero.
// Shared styles for the Korean display lines.
const KR_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-body), sans-serif",
  fontWeight: 800,
  color: "var(--color-fg-paper)",
  fontSize: "clamp(64px, 13vw, 180px)",
  lineHeight: 1,
  letterSpacing: "-0.03em",
  textShadow: "0 6px 30px rgba(0,0,0,0.45), 0 0 80px rgba(0,0,0,0.25)",
};

const HERO_REVEALS: HeroReveal[] = [
  { range: [0.0, 0.2], fadeIn: 0, content: <div style={KR_STYLE}>모두가</div> },
  { range: [0.2, 0.4], content: <div style={KR_STYLE}>승리하는</div> },
  {
    range: [0.4, 0.6],
    content: <div style={{ ...KR_STYLE, color: "var(--primary)" }}>그라운드</div>,
  },
  {
    range: [0.6, 0.8],
    content: (
      <div
        className="text-center"
        style={{
          fontFamily: "var(--font-body), sans-serif",
          fontWeight: 800,
          color: "var(--color-fg-paper)",
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
    range: [0.8, 1.0],
    fadeOut: 0, // logo holds at full opacity through the end of the hero
    content: (
      <div
        role="img"
        aria-label="FairGround"
        style={{
          width: "clamp(260px, 46vw, 620px)",
          aspectRatio: "3603 / 767",
          background: "var(--color-fg-paper)",
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

const HERO_STATIC_FALLBACK = (
  <div className="text-center">
    <div
      className="fg-display"
      style={{
        color: "var(--primary)",
        fontSize: "clamp(36px, 10vw, 92px)",
        lineHeight: 0.9,
        textShadow: "0 4px 18px rgba(255,255,255,0.78), 0 10px 30px rgba(0,0,0,0.28)",
      }}
    >
      FAIRGROUND
    </div>
    <p
      className="mt-3 text-[15px] font-black tracking-[0.18em] md:text-[18px]"
      style={{
        color: "var(--color-fg-paper)",
        fontFamily: "var(--font-body)",
        textShadow: "0 4px 14px rgba(0,0,0,0.58)",
      }}
    >
      모두가 승리하는 그라운드
    </p>
  </div>
);

// 홈페이지 샘플은 특정 실존 인물을 참조하지 않은 한국인 남자 가상 선수만 사용한다.
const SHOWCASE_SAMPLE_PLAYERS: Player[] = [
  {
    id: "showcase-bronze-1",
    uid: "showcase-bronze-1",
    name: "박민수",
    number: 4,
    position: "FIXO",
    teamId: "showcase",
    nationality: "KOR",
    photoUrl: FICTIONAL_PLAYER_CARD_POSE_SOURCES.male01,
    gender: "male",
    cardType: "bronze",
    cardRating: 72,
    stats: { goals: 2, assists: 3, games: 8, mom: 0 },
    badges: ["fair_play"],
    penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 0 },
    isApproved: true,
    role: "player",
    createdAt: 0,
  },
  {
    id: "showcase-silver-1",
    uid: "showcase-silver-1",
    name: "이서준",
    number: 7,
    position: "ALA",
    teamId: "showcase",
    nationality: "KOR",
    photoUrl: FICTIONAL_PLAYER_CARD_POSE_SOURCES.male02,
    gender: "male",
    cardType: "silver",
    cardRating: 84,
    stats: { goals: 6, assists: 5, games: 12, mom: 1 },
    badges: ["playmaker", "iron_man"],
    penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 0 },
    isApproved: true,
    role: "player",
    createdAt: 0,
  },
  {
    id: "showcase-gold-1",
    uid: "showcase-gold-1",
    name: "김재민",
    number: 9,
    position: "PIVO",
    teamId: "showcase",
    nationality: "KOR",
    photoUrl: FICTIONAL_PLAYER_CARD_POSE_SOURCES.male03,
    gender: "male",
    cardType: "gold",
    cardRating: 90,
    stats: { goals: 9, assists: 6, games: 14, mom: 2 },
    badges: ["first_goal", "match_winner"],
    penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 0 },
    isApproved: true,
    role: "player",
    createdAt: 0,
  },
  {
    id: "showcase-premier-1",
    uid: "showcase-premier-1",
    name: "김도현",
    number: 10,
    position: "PIVO",
    teamId: "showcase",
    nationality: "KOR",
    photoUrl: FICTIONAL_PLAYER_CARD_POSE_SOURCES.male04,
    gender: "male",
    cardType: "premium",
    cardRating: 104,
    stats: { goals: 14, assists: 7, games: 14, mom: 5 },
    badges: ["champion", "golden_boot", "mvp"],
    penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 0 },
    isApproved: true,
    role: "player",
    createdAt: 0,
  },
];

const SHOWCASE_TEAM_LOGOS = [
  "/images/team-logos/ref-bulls.webp",
  "/images/team-logos/ref-blue7.webp",
  "/images/team-logos/ref-volt.webp",
  "/images/team-logos/ref-orion.webp",
];

const TEAM_CARD_VARIANTS = [
  "/images/team-cards/team-card-bronze.webp?v=26",
  "/images/team-cards/team-card-silver.webp?v=26",
  "/images/team-cards/team-card-gold.webp?v=26",
  "/images/team-cards/team-card-emerald.webp?v=26",
];

const CARD_TIER_BADGE = {
  bronze: {
    label: "브론즈",
    color: "#ffd9c8",
    background: "rgba(184, 91, 56, 0.2)",
    border: "1px solid rgba(255, 180, 142, 0.42)",
  },
  silver: {
    label: "실버",
    color: "#edf6ff",
    background: "rgba(186, 205, 224, 0.18)",
    border: "1px solid rgba(232, 244, 255, 0.4)",
  },
  gold: {
    label: "골드",
    color: "var(--color-fg-blue-soft)",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.18)",
  },
  premium: {
    label: "플래티넘",
    color: "var(--color-fg-paper)",
    background: "var(--color-fg-blue-deep)",
    border: "1px solid var(--primary)",
  },
};

const HOME_OPERATION_POINTS = [
  {
    label: "LIVE CHECK",
    title: "득점자·어시스트 체크",
    body: "심판과 부심이 경기 중 득점자와 어시스트 선수를 바로 확인합니다.",
  },
  {
    label: "ADMIN REVIEW",
    title: "놓친 기록 즉시 보강",
    body: "어시스트를 놓치면 관리자 화면의 누락 체크보드에서 바로 보강합니다.",
  },
  {
    label: "CARD SYNC",
    title: "리그·카드 동시 반영",
    body: "골·어시스트·MOM 기록은 경기 종료 후 선수카드와 리그 데이터에 반영됩니다.",
  },
] as const;

// 대회 섹션 팩트 행 — 날짜/시간은 아래에서 헤드라인으로 크게 따로 세운다.
const TOURNAMENT_FACTS = [
  {
    icon: MapPin,
    label: "VENUE",
    value: MIXED_FUTSAL_EVENT_LOCATION_FULL_LABEL,
  },
  {
    icon: Users,
    label: "FORMAT",
    value: `${MIXED_FUTSAL_TEAM_COUNT_LABEL} · ${MIXED_FUTSAL_MATCH_FORMAT_LABEL}`,
  },
  {
    icon: Trophy,
    label: "GUARANTEE",
    value: MIXED_FUTSAL_GUARANTEE_LABEL,
  },
  {
    icon: Ticket,
    label: "ENTRY FEE",
    value: MIXED_FUTSAL_ENTRY_FEE_LABEL,
  },
] as const;

export default function HomePage() {
  const store = useDataStore();
  const { user } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsLoaded, setTeamsLoaded] = useState(false);
  const showcasePlayers = SHOWCASE_SAMPLE_PLAYERS;
  // 갤러리에서 탭한 팀 — 즉시 이동하지 않고 CTA 버튼을 띄워 그 버튼으로만 이동.
  const [selectedTeam, setSelectedTeam] = useState<{ id: string; name: string } | null>(null);
  const teamGalleryItems = useMemo<TeamGalleryItem[]>(
    () =>
      teams.map((team, index) => {
        // 카드 등급은 팀의 리그 등급(leagueTier)으로 결정 — 목록/상세 페이지와
        // 동일한 leagueTierCardIndex 를 써서 모든 화면에서 등급이 일치하도록 통일.
        // (기존: 배열 위치(index)로 배정해 페이지마다 등급이 달랐음)
        const cardIndex = leagueTierCardIndex(team.leagueTier);
        return {
          id: team.id,
          name: team.name,
          logo: team.logo || getClubLogoPreset(team.name, index).asset,
          frame: TEAM_CARD_VARIANTS[cardIndex],
          colorIndex: cardIndex,
          isFieldChampion: isFieldChampionTeam(team),
        };
      }),
    [teams],
  );
  const mobileShowcase = useMemo(() => {
    return showcasePlayers;
  }, [showcasePlayers]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const teamsData = await store.fetchTeams();
      if (cancelled) return;
      // 승인된 공식 팀만 노출. 승인 대기 팀이 '참가 팀 소개'에 섞이면 새로
      // 신청하는 팀이 이미 확정된 참가팀으로 오해한다. 대기 팀은 관리자
      // 팀 관리와 본인의 /my/team 에서만 보인다.
      setTeams(
        teamsData.filter((team) => team.isApproved).sort(
          (a, b) =>
            (a.seasonStats.rank || 99) - (b.seasonStats.rank || 99) ||
            b.seasonStats.points - a.seasonStats.points
        )
      );
      setTeamsLoaded(true);
    };

    void load();

    // 팀 승급/강등 등 teams 테이블 변경 시 즉시 재조회 → leagueTier 가 바뀌면
    // teamGalleryItems 의 cardIndex/frame 이 갱신되고, 카드 캐시 키(frame·colorIndex)
    // 도 달라져 새 티어 테두리로 실시간 재합성된다(redeploy/새로고침 불필요).
    const channel = supabase
      .channel("web-home-teams")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams" },
        () => void load()
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <HomePromotionPopup />

      {/* ============================================================
          HERO — Scroll-Scrubbed Stadium Entrance (video + reveals)
          ============================================================ */}
      <section
        className="relative"
        style={{ background: "var(--color-fg-paper)" }}
        aria-label="FairGround — 모두가 승리하는 그라운드"
      >
        {/* Brand copy in real DOM exactly once: the scroll reveals are
            aria-hidden canvas overlays, so this sr-only H1 restores the
            page heading for screen readers and search crawlers (A1, Q4). */}
        <h1 className="sr-only">
          FairGround — 모두가 승리하는 그라운드. EVERYONE WINS ON THIS GROUND.
        </h1>
        <ScrollVideoHero
          scrollLength={1.6}
          fit="cover"
          background="#ffffff"
          stickyTop={60}
          reveals={HERO_REVEALS}
          mobileVideoSrc="/videos/hero1-mobile-muted.mp4"
          staticFallback={HERO_STATIC_FALLBACK}
          showMobileStaticFallback={false}
        />
      </section>

      {/* ============================================================
          UPCOMING TOURNAMENT — 홈에서 대회로 가는 유일한 상시 경로.
          히어로(흰 배경 풀뷰포트 영상) 바로 다음이라 딥블루 바탕으로 끊어
          "여기부터 다른 이야기" 라는 신호를 준다. 날짜·장소·포맷은 모두
          mixed-futsal-event 상수에서 온다.
          ============================================================ */}
      <section
        className="relative overflow-hidden px-5 py-14 sm:px-8 md:px-10 md:py-20"
        style={{ background: "var(--color-fg-blue-deep)" }}
        aria-labelledby="home-tournament-heading"
      >
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            background:
              "radial-gradient(120% 90% at 10% 0%, rgba(0,71,171,0.55), transparent 62%), radial-gradient(90% 70% at 100% 100%, rgba(13,27,42,0.5), transparent 62%)",
          }}
        />
        <div className="relative mx-auto grid max-w-[1320px] gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(300px,420px)] lg:items-center lg:gap-14">
          <div className="flex items-start gap-4 md:gap-6">
            <span
              className="fg-mono mt-2 shrink-0 text-[11px]"
              style={{ color: "var(--color-fg-blue-soft)" }}
            >
              01
            </span>
            <div className="min-w-0 flex-1">
              <div className="mb-3 flex items-center gap-2">
                <span
                  className="inline-block h-2 w-2"
                  style={{ background: "var(--color-fg-blue-soft)" }}
                />
                <span className="fg-label" style={{ color: "var(--color-fg-blue-soft)" }}>
                  UPCOMING TOURNAMENT
                </span>
              </div>
              <h2
                id="home-tournament-heading"
                className="fg-display"
                style={{
                  fontSize: "clamp(26px, 5.2vw, 56px)",
                  letterSpacing: "-0.01em",
                  color: "var(--color-fg-paper)",
                }}
              >
                {MIXED_FUTSAL_EVENT_NAME}
              </h2>

              <div className="mt-6 max-w-3xl md:mt-8 lg:mt-9">
                {/* 날짜 → 조건 → CTA 순서로 대회 참여 흐름을 안내한다. */}
                <div>
                  <p className="fg-label" style={{ color: "var(--color-fg-blue-soft)" }}>
                    DATE
                  </p>
                  <p
                    className="fg-display mt-2"
                    style={{
                      fontSize: "clamp(30px, 6.4vw, 48px)",
                      color: "var(--color-fg-paper)",
                    }}
                  >
                    {MIXED_FUTSAL_EVENT_DATE_LABEL}
                  </p>
                  <p
                    className="fg-mono mt-2 text-[13px]"
                    style={{ color: "var(--color-fg-blue-soft)" }}
                  >
                    {MIXED_FUTSAL_EVENT_TIME_LABEL}
                  </p>

                  <ul
                    className="mt-5 space-y-3 border-t pt-5 lg:mt-6 lg:pt-6"
                    style={{ borderColor: "rgba(255,255,255,0.18)" }}
                  >
                    {TOURNAMENT_FACTS.map((fact) => {
                      const Icon = fact.icon;
                      return (
                        <li key={fact.label} className="flex items-start gap-3">
                          <Icon
                            className="mt-[2px] h-4 w-4 shrink-0"
                            style={{ color: "var(--color-fg-blue-soft)" }}
                            aria-hidden
                          />
                          <div className="min-w-0">
                            <p
                              className="fg-label text-[9px]"
                              style={{ color: "var(--color-fg-blue-soft)" }}
                            >
                              {fact.label}
                            </p>
                            <p
                              className="mt-1 text-[14px] font-bold leading-snug"
                              style={{
                                color: "var(--color-fg-paper)",
                                fontFamily: "var(--font-body)",
                              }}
                            >
                              {fact.value}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Link
                      href={MIXED_FUTSAL_APPLY_PATH}
                      className="group inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[var(--radius-md)] px-7 fg-display text-[15px] tracking-[0.06em] transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                      style={{
                        background: "var(--color-fg-paper)",
                        color: "var(--color-fg-blue-deep)",
                        boxShadow: "0 14px 30px rgba(13,27,42,0.3)",
                        outlineColor: "var(--color-fg-paper)",
                      }}
                    >
                      참가 신청하기
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                    <Link
                      href={MIXED_FUTSAL_EVENT_PATH}
                      className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[var(--radius-md)] border px-7 fg-display text-[15px] tracking-[0.06em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                      style={{
                        borderColor: "rgba(255,255,255,0.45)",
                        color: "var(--color-fg-paper)",
                        outlineColor: "var(--color-fg-paper)",
                      }}
                    >
                      대회 안내
                    </Link>
                    <Link
                      href={SPONSOR_PROPOSAL_PATH}
                      className="group inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[var(--radius-md)] border px-7 fg-display text-[15px] tracking-[0.06em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                      style={{
                        borderColor: "rgba(255,255,255,0.45)",
                        color: "var(--color-fg-paper)",
                        outlineColor: "var(--color-fg-paper)",
                      }}
                      aria-label="협찬 제안서 보기"
                    >
                      협찬 제안서
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </div>
                </div>

              </div>
            </div>
          </div>

          <Link
            href={MIXED_FUTSAL_EVENT_PATH}
            className="group mx-auto block w-full max-w-[420px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            aria-label={`${MIXED_FUTSAL_EVENT_NAME} 대회 안내 보기`}
          >
            <div className="relative aspect-[4/5] overflow-hidden bg-[#06152B] shadow-[0_28px_70px_rgba(0,0,0,0.34)]">
              <Image
                src={MIXED_FUTSAL_COVER_IMAGE_PATH}
                alt={`${MIXED_FUTSAL_EVENT_NAME} 공식 포스터`}
                fill
                sizes="(max-width: 1023px) min(90vw, 420px), 420px"
                className="object-contain transition-transform duration-300 group-hover:scale-[1.012] motion-reduce:transition-none"
              />
            </div>
            <span className="mt-3 flex items-center justify-between text-[12px] font-bold text-white/68">
              공식 대회 포스터
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" aria-hidden />
            </span>
          </Link>
        </div>
      </section>

      {/* ============================================================
          PARTICIPATING TEAMS — live Supabase roster
          ============================================================ */}
      <section
        className="relative px-5 pb-20 pt-8 sm:px-8 md:px-10 md:py-28 overflow-hidden"
        style={{
          background: "var(--color-fg-paper)",
          borderTop: "1px solid var(--color-fg-line-soft)",
        }}
      >
        <div className="absolute inset-0 fg-grid opacity-40 pointer-events-none" />
        <div className="relative mx-auto max-w-[1320px]">
          <div className="flex items-start gap-4 md:gap-6 mb-12 md:mb-16">
            <span
              className="fg-mono text-[11px] mt-2 shrink-0"
              style={{ color: "var(--primary)" }}
            >
              02
            </span>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="inline-block w-2 h-2"
                  style={{ background: "var(--primary)" }}
                />
                <span className="fg-label" style={{ color: "var(--primary)" }}>
                  PARTICIPATING TEAMS
                </span>
              </div>
              <div className="flex flex-wrap items-end justify-between gap-3 sm:gap-4">
                <h2
                  className="fg-display"
                  style={{
                    fontSize: "clamp(26px, 6vw, 72px)",
                    letterSpacing: "-0.01em",
                    color: "var(--color-fg-ink)",
                  }}
                >
                  참가 팀 소개
                </h2>
                <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 mb-2">
                  <Link
                    href="/my/team"
                    className="inline-flex items-center gap-2 whitespace-nowrap px-4 py-2 fg-label border transition-colors"
                    style={{
                      color: "var(--primary)",
                      borderColor: "rgba(0,71,171,0.2)",
                      background: "var(--color-fg-paper)",
                    }}
                  >
                    우리팀 등록하기
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  {teams.length > 0 && (
                    <Link
                      href="/teams"
                      className="group inline-flex items-center gap-3 fg-label transition-colors shrink-0"
                      style={{ color: "var(--color-fg-ink-muted)" }}
                    >
                      <span
                        className="inline-block w-6 h-[2px] group-hover:w-10 transition-all"
                        style={{ background: "var(--primary)" }}
                      />
                      ALL TEAMS
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              </div>
              <p
                className="mt-4 text-[15px] leading-relaxed max-w-2xl"
                style={{
                  color: "var(--color-fg-ink-muted)",
                  fontFamily: "var(--font-body)",
                }}
              >
                이번 시즌 그라운드에 선 팀들. 전적과 명단은 실시간으로 갱신되고,
                필드 우승팀은 팀카드 테두리에 특수효과가 적용됩니다.
              </p>
            </div>
          </div>

          {!teamsLoaded ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-44 border animate-pulse rounded-[var(--radius-lg)]"
                  style={{
                    background: "var(--color-fg-paper-2)",
                    borderColor: "var(--color-fg-line-soft)",
                  }}
                />
              ))}
            </div>
          ) : teams.length === 0 ? (
            <EmptyState
              eyebrow="NO TEAMS YET"
              title="아직 등록된 팀이 없습니다"
              description="첫 번째 팀이 되어 이번 시즌 그라운드를 열어보세요."
              actions={[
                { label: "우리팀 등록하기", href: "/my/team" },
                { label: "팀 전체 보기", href: "/teams" },
              ]}
            />
          ) : (
            <>
              {/* WebGL 의존 없는 자동 회전 카드 슬라이더(TeamMarquee). 호버/포커스/
                  드래그/카드 선택 시 일시정지. 카드 탭은 선택만 하고 아래 CTA로 이동. */}
              <TeamMarquee
                items={teamGalleryItems}
                paused={!!selectedTeam}
                reducedMotion={!!prefersReducedMotion}
                edgeClassName="-mx-5 px-5 sm:-mx-8 sm:px-8 md:mx-0 md:px-0"
                ariaLabel="참가 팀 카드 슬라이더"
                renderItem={(item, key) => (
                  <HomeTeamCard
                    key={key}
                    item={item}
                    active={selectedTeam?.id === item.id}
                    onSelect={() => {
                      const t = teams.find((x) => x.id === item.id);
                      if (t) setSelectedTeam({ id: t.id, name: t.name });
                    }}
                  />
                )}
              />
              {/* 선택된 팀이 있을 때만 이동 CTA 노출 (스크롤 중 오클릭으로 인한
                  페이지 자동 이동 방지). Link 라 SPA 이동 → 뒤로가기 정상. */}
              <div className="mt-4 flex min-h-[52px] items-center justify-center">
                {selectedTeam ? (
                  <Link
                    href={`/teams/${selectedTeam.id}`}
                    className="inline-flex min-h-[48px] items-center gap-2 px-6 fg-display text-[14px] tracking-[0.02em] transition-transform hover:-translate-y-0.5"
                    style={{
                      background: "var(--primary)",
                      color: "var(--primary-foreground)",
                      boxShadow: "0 12px 26px rgba(0,71,171,0.28)",
                    }}
                  >
                    {selectedTeam.name} 팀 페이지로 이동
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <span
                    className="text-[13px]"
                    style={{ color: "var(--color-fg-ink-muted)" }}
                  >
                    팀 카드를 탭하면 해당 팀 페이지로 이동할 수 있어요
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ============================================================
          MAKE YOUR PLAYER CARD — showcase
          ============================================================ */}
      <section
        className="relative py-20 md:py-28 px-5 sm:px-8 md:px-10 overflow-hidden"
        style={{ background: "var(--color-fg-ink)" }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden
          style={{
            background:
              "radial-gradient(110% 80% at 50% 0%, rgba(0,71,171,0.35), transparent 65%)",
          }}
        />
        <div className="relative mx-auto max-w-[1320px]">
          <div className="flex items-start gap-4 md:gap-6 mb-12 md:mb-16">
            <span
              className="fg-mono text-[11px] mt-2 shrink-0"
              style={{ color: "var(--color-fg-blue-soft)" }}
            >
              03
            </span>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="inline-block w-2 h-2"
                  style={{ background: "var(--color-fg-blue-soft)" }}
                />
                <span
                  className="fg-label"
                  style={{ color: "var(--color-fg-blue-soft)" }}
                >
                  YOUR PLAYER CARD
                </span>
              </div>
              <h2
                className="fg-display"
                style={{
                  fontSize: "clamp(36px, 6vw, 72px)",
                  letterSpacing: "-0.01em",
                  color: "var(--color-fg-paper)",
                }}
              >
                선수 카드 만들기
              </h2>
              <p
                className="mt-4 text-[15px] leading-relaxed max-w-2xl"
                style={{
                  color: "rgba(255,255,255,0.7)",
                  fontFamily: "var(--font-body)",
                }}
              >
                심판·부심·관리자가 경기 중 득점자와 어시스트를 체크합니다.
                골·어시스트·MOM이 카드에 새겨지고, 시즌이 쌓일수록 카드는
                골드에서 플래티넘으로 성장합니다.
              </p>
            </div>
          </div>

          <div className="mb-12 grid grid-cols-1 gap-3 md:grid-cols-3">
            {HOME_OPERATION_POINTS.map((point) => (
              <div
                key={point.label}
                className="border px-5 py-4"
                style={{
                  borderColor: "rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.06)",
                }}
              >
                <p
                  className="fg-label text-[9px]"
                  style={{ color: "var(--color-fg-blue-soft)" }}
                >
                  {point.label}
                </p>
                <h3
                  className="mt-2 text-[15px] font-black"
                  style={{ color: "var(--color-fg-paper)" }}
                >
                  {point.title}
                </h3>
                <p
                  className="mt-2 text-[12px] leading-relaxed"
                  style={{ color: "rgba(255,255,255,0.62)" }}
                >
                  {point.body}
                </p>
              </div>
            ))}
          </div>

              <div className="md:hidden grid grid-cols-2 gap-x-4 gap-y-10 px-2">
                {mobileShowcase.map((player, i) => {
                  const tier = getCardTypeFromRating(player.cardRating);
                  const badge = CARD_TIER_BADGE[tier];

                  return (
                    <motion.div
                      key={`m-${player.id}`}
                      className="flex flex-col items-center gap-3"
                      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 32 }}
                      whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-60px" }}
                      transition={prefersReducedMotion ? { duration: 0.2 } : { delay: i * 0.08, type: "spring", stiffness: 200, damping: 20 }}
                    >
                      <span
                        className="px-3 py-1 text-[11px] font-black tracking-normal rounded-[var(--radius-pill)]"
                        style={{
                          color: badge.color,
                          background: badge.background,
                          border: badge.border,
                          fontFamily: "var(--font-body)",
                        }}
                      >
                        {badge.label}
                      </span>
                      <Link
                        href="/players"
                        className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
                        style={{ outlineColor: "var(--color-ring)" }}
                      >
                        <div className="origin-top scale-[0.9]">
                          <PlayerCard
                            player={player}
                            size="md"
                            teamLogo={SHOWCASE_TEAM_LOGOS[i % SHOWCASE_TEAM_LOGOS.length]}
                          />
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
              <div className="hidden md:block -mx-5 overflow-x-auto px-5 pb-4 md:mx-0 md:px-0">
                <div className="mx-auto flex w-max items-end justify-center gap-5 md:gap-8 lg:gap-10">
                  {showcasePlayers.map((player, i) => {
                    const tier = getCardTypeFromRating(player.cardRating);
                    const badge = CARD_TIER_BADGE[tier];

                    return (
                      <motion.div
                        key={player.id}
                        className="flex flex-col items-center gap-3"
                        initial={
                          prefersReducedMotion
                            ? { opacity: 0 }
                            : { opacity: 0, y: 40, rotate: i % 2 ? 3 : -3 }
                        }
                        whileInView={
                          prefersReducedMotion
                            ? { opacity: 1 }
                            : { opacity: 1, y: 0, rotate: 0 }
                        }
                        viewport={{ once: true, margin: "-80px" }}
                        transition={
                          prefersReducedMotion
                            ? { duration: 0.2 }
                            : {
                                delay: i * 0.08,
                                type: "spring",
                                stiffness: 200,
                                damping: 20,
                              }
                        }
                      >
                        <span
                          className="px-3 py-1 text-[11px] font-black tracking-normal rounded-[var(--radius-pill)]"
                          style={{
                            color: badge.color,
                            background: badge.background,
                            border: badge.border,
                            fontFamily: "var(--font-body)",
                          }}
                        >
                          {badge.label}
                        </span>
                        <Link
                          href="/players"
                          className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
                          style={{ outlineColor: "var(--color-ring)" }}
                        >
                          <PlayerCard
                            player={player}
                            size="lg"
                            teamLogo={SHOWCASE_TEAM_LOGOS[i % SHOWCASE_TEAM_LOGOS.length]}
                          />
                        </Link>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

          <div className="mt-14 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={user ? "/my/player-setup" : "/login?returnTo=/my/player-setup"}
              className="group inline-flex items-center gap-3 px-7 py-4 fg-display tracking-[0.06em] text-[15px] rounded-[var(--radius-md)] transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{
                background: "var(--primary)",
                color: "var(--primary-foreground)",
                boxShadow: "var(--shadow-sm)",
                outlineColor: "var(--color-ring)",
              }}
            >
              내 카드 만들기
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/players"
              className="inline-flex items-center gap-3 px-7 py-4 fg-display tracking-[0.06em] text-[15px] border rounded-[var(--radius-md)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{
                borderColor: "rgba(255,255,255,0.25)",
                color: "var(--color-fg-paper)",
                outlineColor: "var(--color-ring)",
              }}
            >
              카드 전체 보기
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

// 참가 팀 카드 — createTeamCardCanvas 로 그린 <canvas> 를 DOM 에 직접 붙인다.
// 핵심: toDataURL("image/*") 인코딩을 쓰지 않는다. 1080×1240 캔버스를 카드마다
// 인코딩하면 카드당 ~340ms 의 동기 메인스레드 블로킹이 발생해(마퀴 reps 로 카드가
// 20개 이상이면 합계 수 초) 카드가 한참 뒤에야 한꺼번에 뜬다. 인코딩 없이 캔버스를
// 그대로 표시하면 카드당 비용이 수ms 로 떨어진다. 표시 폭(200px)에 맞춰 540px 로
// 렌더해 합성 비용·메모리도 함께 줄인다. WebGL(OGL) 의존이 없어 전 기기 안정적.
const HOME_CARD_RENDER_WIDTH = 540;

function HomeTeamCard({
  item,
  active,
  onSelect,
}: {
  item: TeamGalleryItem;
  active: boolean;
  onSelect: () => void;
}) {
  const cacheKey = `${item.frame}|${item.logo ?? ""}|${item.name}|${item.colorIndex}|${item.isFieldChampion ? "champion" : "standard"}`;
  const holderRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void createTeamCardCanvas(
      {
        name: item.name,
        logo: item.logo,
        frame: item.frame,
        colorIndex: item.colorIndex,
        isFieldChampion: item.isFieldChampion,
      },
      { width: HOME_CARD_RENDER_WIDTH },
    )
      .then((canvas) => {
        const holder = holderRef.current;
        if (cancelled || !holder) return;
        canvas.setAttribute("role", "img");
        canvas.setAttribute("aria-label", item.name);
        canvas.style.display = "block";
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.style.borderRadius = "14px";
        holder.replaceChildren(canvas);
        setReady(true);
      })
      .catch((err) => console.error("[HomeTeamCard] canvas failed:", err));
    return () => {
      cancelled = true;
    };
    // cacheKey 는 item 의 (frame·logo·name·colorIndex) 파생값이라 승급 등으로
    // 티어가 바뀌면 변경되어 카드가 새 테두리로 재생성된다.
  }, [item, cacheKey]);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`${item.name} 선택`}
      className="shrink-0 snap-center transition-transform active:scale-95"
      style={{
        width: 200,
        borderRadius: 14,
        outline: active ? "2px solid var(--primary)" : "none",
        outlineOffset: 3,
      }}
    >
      <div className="relative w-full" style={{ aspectRatio: "1080 / 1240" }}>
        <div
          ref={holderRef}
          className="absolute inset-0"
          style={{ opacity: ready ? 1 : 0, transition: "opacity 160ms ease" }}
        />
        {!ready && (
          <div
            className="absolute inset-0 animate-pulse"
            style={{ background: "var(--color-fg-paper-2)", borderRadius: 14 }}
          />
        )}
      </div>
    </button>
  );
}
