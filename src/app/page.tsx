"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useDataStore } from "@/stores/dataStore";
import { useAuth } from "@/hooks/useAuth";
import { PlayerCard, getCardTypeFromRating } from "@/components/player-card";
import { EmptyState } from "@/components/empty-state";
import { ScrollVideoHero, type HeroReveal } from "@/components/scroll-video-hero";
import type { TeamGalleryItem } from "@/components/team-circular-gallery";
import { getClubLogoPreset } from "@/components/club-emblem";
import { createTeamCardCanvas } from "@/lib/team-card-canvas";
import { leagueTierCardIndex } from "@/lib/team-home";
import type { Team, Player } from "@/types";
import { ArrowRight } from "lucide-react";
import { TeamMarquee } from "@/components/team-marquee";

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
  { range: [0.0, 0.2], content: <div style={KR_STYLE}>모두가</div> },
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

const SHOWCASE_SAMPLE_PLAYERS: Player[] = [
  {
    id: "showcase-bronze-1",
    uid: "showcase-bronze-1",
    name: "정우진",
    number: 8,
    position: "FIXO",
    teamId: "showcase",
    nationality: "KOR",
    photoUrl: "/images/players/showcase-player-4.png",
    cardType: "bronze",
    cardRating: 74,
    stats: { goals: 3, assists: 4, games: 10, mom: 0 },
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
    number: 11,
    position: "ALA",
    teamId: "showcase",
    nationality: "KOR",
    photoUrl: "/images/players/showcase-player-3.png",
    cardType: "silver",
    cardRating: 85,
    stats: { goals: 6, assists: 8, games: 14, mom: 1 },
    badges: ["playmaker", "iron_man"],
    penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 0 },
    isApproved: true,
    role: "player",
    createdAt: 0,
  },
  {
    id: "showcase-gold-1",
    uid: "showcase-gold-1",
    name: "박지후",
    number: 7,
    position: "ALA",
    teamId: "showcase",
    nationality: "KOR",
    photoUrl: "/images/players/showcase-player-2.png",
    cardType: "gold",
    cardRating: 92,
    stats: { goals: 9, assists: 6, games: 14, mom: 2 },
    badges: ["match_winner", "assist_king"],
    penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 0 },
    isApproved: true,
    role: "player",
    createdAt: 0,
  },
  {
    id: "showcase-premium-1",
    uid: "showcase-premium-1",
    name: "김도현",
    number: 10,
    position: "PIVO",
    teamId: "showcase",
    nationality: "KOR",
    photoUrl: "/images/players/showcase-player-1.png",
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
  "/images/team-logos/ref-bulls.png",
  "/images/team-logos/ref-blue7.png",
  "/images/team-logos/ref-volt.png",
  "/images/team-logos/ref-orion.png",
];

const TEAM_CARD_VARIANTS = [
  "/images/team-cards/team-card-bronze.png?v=17",
  "/images/team-cards/team-card-silver.png?v=17",
  "/images/team-cards/team-card-gold.png?v=18",
  "/images/team-cards/team-card-emerald.png?v=25",
];

const CARD_TIER_BADGE = {
  bronze: {
    label: "BRONZE",
    color: "#ffd9c8",
    background: "rgba(184, 91, 56, 0.2)",
    border: "1px solid rgba(255, 180, 142, 0.42)",
  },
  silver: {
    label: "SILVER",
    color: "#edf6ff",
    background: "rgba(186, 205, 224, 0.18)",
    border: "1px solid rgba(232, 244, 255, 0.4)",
  },
  gold: {
    label: "GOLD",
    color: "var(--color-fg-blue-soft)",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.18)",
  },
  premium: {
    label: "PREMIUM",
    color: "var(--color-fg-paper)",
    background: "var(--color-fg-blue-deep)",
    border: "1px solid var(--primary)",
  },
};

export default function HomePage() {
  const store = useDataStore();
  const { user } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsLoaded, setTeamsLoaded] = useState(false);
  const [showcasePlayers, setShowcasePlayers] = useState<Player[]>([]);
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
        };
      }),
    [teams],
  );
  const mobileShowcase = useMemo(() => {
    return showcasePlayers;
  }, [showcasePlayers]);

  useEffect(() => {
    const load = async () => {
      const teamsData = await store.fetchTeams();

      setTeams(
        [...teamsData].sort(
          (a, b) =>
            (a.seasonStats.rank || 99) - (b.seasonStats.rank || 99) ||
            b.seasonStats.points - a.seasonStats.points
        )
      );
      setTeamsLoaded(true);
      setShowcasePlayers(SHOWCASE_SAMPLE_PLAYERS);
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
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
          scrollLength={2.6}
          fit="cover"
          aspect={1920 / 940}
          background="#ffffff"
          stickyTop={60}
          mobileVideoSrc="/videos/hero1-mobile-muted.mp4"
          reveals={HERO_REVEALS}
          staticFallback={null}
        />
      </section>

      {/* ============================================================
          PARTICIPATING TEAMS — live Supabase roster
          ============================================================ */}
      <section
        className="relative py-20 md:py-28 px-5 sm:px-8 md:px-10 overflow-hidden"
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
              01
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
                이번 시즌 그라운드에 선 팀들. 전적과 명단은 실시간으로 갱신됩니다.
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
              02
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
                골·어시스트·MOM이 카드에 새겨집니다. 시즌이 쌓일수록 카드도
                자란다 — 골드에서 프리미엄으로.
              </p>
            </div>
          </div>

          {showcasePlayers.length > 0 ? (
            <>
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
                        className="fg-label text-[10px] px-2.5 py-1 rounded-[var(--radius-pill)]"
                        style={{
                          color: badge.color,
                          background: badge.background,
                          border: badge.border,
                        }}
                      >
                        {badge.label}
                      </span>
                      <Link
                        href={player.id.startsWith("showcase-") ? "/players" : `/players/${player.id}`}
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
                          className="fg-label text-[10px] px-2.5 py-1 rounded-[var(--radius-pill)]"
                          style={{
                            color: badge.color,
                            background: badge.background,
                            border: badge.border,
                          }}
                        >
                          {badge.label}
                        </span>
                        <Link
                          href={player.id.startsWith("showcase-") ? "/players" : `/players/${player.id}`}
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
            </>
          ) : (
            <div
              className="border px-6 py-16 text-center max-w-xl mx-auto rounded-[var(--radius-lg)]"
              style={{
                borderColor: "rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.04)",
              }}
            >
              <p
                className="fg-display text-[22px]"
                style={{ color: "var(--color-fg-paper)" }}
              >
                첫 번째 카드의 주인공이 되어보세요
              </p>
              <p
                className="mt-3 text-[14px]"
                style={{
                  color: "rgba(255,255,255,0.6)",
                  fontFamily: "var(--font-body)",
                }}
              >
                리그에 참가하면 나만의 선수 카드가 생성됩니다.
              </p>
            </div>
          )}

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

// 참가 팀 카드 — createTeamCardCanvas 로 2D 캔버스 카드를 그려 <img> 로 표시.
// WebGL(OGL) 의존이 없어 모든 기기에서 안정적으로 렌더된다. (TeamCircularGallery 대체)
function HomeTeamCard({
  item,
  active,
  onSelect,
}: {
  item: TeamGalleryItem;
  active: boolean;
  onSelect: () => void;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void createTeamCardCanvas({
      name: item.name,
      logo: item.logo,
      frame: item.frame,
      colorIndex: item.colorIndex,
    })
      .then((canvas) => {
        if (!cancelled) setSrc(canvas.toDataURL("image/png"));
      })
      .catch((err) => console.error("[HomeTeamCard] canvas failed:", err));
    return () => {
      cancelled = true;
    };
  }, [item]);

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
      {src ? (
        <img src={src} alt={item.name} className="w-full" draggable={false} />
      ) : (
        <div
          className="w-full animate-pulse"
          style={{ aspectRatio: "1080 / 1240", background: "var(--color-fg-paper-2)", borderRadius: 14 }}
        />
      )}
    </button>
  );
}
