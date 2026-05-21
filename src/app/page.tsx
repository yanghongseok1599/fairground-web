"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useDataStore } from "@/stores/dataStore";
import { PlayerCard } from "@/components/player-card";
import { EmptyState } from "@/components/empty-state";
import { ScrollVideoHero, type HeroReveal } from "@/components/scroll-video-hero";
import { CircularGallery, type GalleryItem } from "@/components/circular-gallery";
import type { Team, Player } from "@/types";
import { ArrowRight } from "lucide-react";

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
    id: "showcase-premium-1",
    uid: "showcase-premium-1",
    name: "김도현",
    number: 10,
    position: "PIVO",
    teamId: "showcase",
    nationality: "KOR",
    photoUrl: "/images/players/showcase-player-1.png",
    cardType: "premium",
    cardRating: 92,
    stats: { goals: 14, assists: 7, games: 14, mom: 5 },
    badges: ["champion", "golden_boot", "mvp"],
    penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 0 },
    isApproved: true,
    role: "player",
    createdAt: 0,
  },
  {
    id: "showcase-premium-2",
    uid: "showcase-premium-2",
    name: "박지후",
    number: 7,
    position: "ALA",
    teamId: "showcase",
    nationality: "KOR",
    photoUrl: "/images/players/showcase-player-2.png",
    cardType: "premium",
    cardRating: 90,
    stats: { goals: 12, assists: 5, games: 14, mom: 4 },
    badges: ["champion", "playmaker", "assist_king"],
    penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 0 },
    isApproved: true,
    role: "player",
    createdAt: 0,
  },
  {
    id: "showcase-gold-1",
    uid: "showcase-gold-1",
    name: "이서준",
    number: 11,
    position: "ALA",
    teamId: "showcase",
    nationality: "KOR",
    photoUrl: "/images/players/showcase-player-3.png",
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
    id: "showcase-gold-2",
    uid: "showcase-gold-2",
    name: "정우진",
    number: 8,
    position: "FIXO",
    teamId: "showcase",
    nationality: "KOR",
    photoUrl: "/images/players/showcase-player-4.png",
    cardType: "gold",
    cardRating: 90,
    stats: { goals: 6, assists: 8, games: 14, mom: 1 },
    badges: ["fair_play", "iron_man"],
    penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 0 },
    isApproved: true,
    role: "player",
    createdAt: 0,
  },
];

export default function HomePage() {
  const store = useDataStore();
  const prefersReducedMotion = useReducedMotion();
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsLoaded, setTeamsLoaded] = useState(false);
  const [showcasePlayers, setShowcasePlayers] = useState<Player[]>([]);
  const mobileShowcase = useMemo(() => {
    const firstPremium = showcasePlayers.find((p) => p.cardType === "premium");
    const firstGold = showcasePlayers.find((p) => p.cardType === "gold");
    return [firstPremium, firstGold].filter((x): x is Player => Boolean(x));
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
          reveals={HERO_REVEALS}
          staticFallback={
            <>
              <video
                src="/FairGroundAd.mp4"
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
                aria-hidden
                className="absolute inset-0 h-full w-full object-cover"
              />
              {/* 영상 가독성 위한 약한 어둠 오버레이 */}
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(13,27,42,0.18) 0%, rgba(13,27,42,0.05) 35%, rgba(13,27,42,0.45) 100%)",
                }}
              />
              <div className="relative text-center px-6" aria-hidden>
                <div
                  style={{
                    fontFamily: "var(--font-body), sans-serif",
                    fontWeight: 800,
                    color: "var(--color-fg-paper)",
                    fontSize: "clamp(40px, 9vw, 110px)",
                    lineHeight: 1,
                    letterSpacing: "-0.03em",
                    textShadow:
                      "0 6px 28px rgba(0,0,0,0.55), 0 0 60px rgba(0,0,0,0.30)",
                  }}
                >
                  모두가 <span style={{ color: "#9DB8FF" }}>승리하는</span>
                  <br />
                  그라운드
                </div>
                <div
                  className="mt-4 tracking-[0.12em]"
                  style={{
                    color: "rgba(255,255,255,0.85)",
                    fontFamily: "var(--font-body)",
                    fontWeight: 700,
                    fontSize: "clamp(13px, 2.5vw, 20px)",
                    textShadow: "0 4px 20px rgba(0,0,0,0.5)",
                  }}
                >
                  EVERYONE WINS ON THIS GROUND
                </div>
              </div>
            </>
          }
        />
      </section>

      {/* ============================================================
          PARTICIPATING TEAMS — live Supabase roster
          ============================================================ */}
      <section
        className="relative py-20 md:py-28 px-5 md:px-10 overflow-hidden"
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
              <div className="flex flex-wrap items-end justify-between gap-4">
                <h2
                  className="fg-display"
                  style={{
                    fontSize: "clamp(36px, 6vw, 72px)",
                    letterSpacing: "-0.01em",
                    color: "var(--color-fg-ink)",
                  }}
                >
                  참가 팀 소개
                </h2>
                <div className="flex flex-wrap items-center justify-end gap-3 mb-2">
                  <Link
                    href="/my/team"
                    className="inline-flex items-center gap-2 px-4 py-2 fg-label border transition-colors"
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
            <div className="relative w-full h-[440px] md:h-[460px]">
              <div className="absolute inset-0 origin-top scale-[0.7] translate-y-16 md:scale-100 md:translate-y-0">
                <CircularGallery
                  items={teams.map((team, i): GalleryItem => ({
                    id: team.id,
                    common: team.name,
                    binomial: `${team.seasonStats.wins}W ${team.seasonStats.draws}D ${team.seasonStats.losses}L`,
                    photo: { url: team.logo ?? "", text: team.name, by: `${team.memberCount}명` },
                    colorIndex: i,
                  }))}
                  radius={520}
                  autoRotateSpeed={prefersReducedMotion ? 0 : 0.25}
                  onItemClick={(item) => {
                    const t = teams.find((x) => x.id === item.id);
                    if (t) window.location.href = `/teams/${t.id}`;
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ============================================================
          MAKE YOUR PLAYER CARD — showcase
          ============================================================ */}
      <section
        className="relative py-20 md:py-28 px-5 md:px-10 overflow-hidden"
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
              {/* Mobile: 1 premium + 1 gold, vertical stack */}
              <div className="md:hidden flex flex-col items-center gap-10 px-5">
                {mobileShowcase.map((player, i) => (
                  <motion.div
                    key={`m-${player.id}`}
                    className="flex flex-col items-center gap-3"
                    initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 32 }}
                    whileInView={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={prefersReducedMotion ? { duration: 0.2 } : { delay: i * 0.1, type: "spring", stiffness: 200, damping: 20 }}
                  >
                    <span
                      className="fg-label text-[10px] px-2.5 py-1 rounded-[var(--radius-pill)]"
                      style={{
                        color: player.cardType === "premium" ? "var(--color-fg-paper)" : "var(--color-fg-blue-soft)",
                        background: player.cardType === "premium" ? "var(--color-fg-blue-deep)" : "rgba(255,255,255,0.08)",
                        border: player.cardType === "premium" ? "1px solid var(--primary)" : "1px solid rgba(255,255,255,0.18)",
                      }}
                    >
                      {player.cardType === "premium" ? "PREMIUM" : "GOLD"}
                    </span>
                    <Link
                      href={player.id.startsWith("showcase-") ? "/players" : `/players/${player.id}`}
                      className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
                      style={{ outlineColor: "var(--color-ring)" }}
                    >
                      <PlayerCard player={player} size="lg" />
                    </Link>
                  </motion.div>
                ))}
              </div>
              {/* Desktop: 4 cards horizontal scroll */}
              <div className="hidden md:block -mx-5 overflow-x-auto px-5 pb-4 md:mx-0 md:px-0">
              <div className="mx-auto flex w-max items-end justify-center gap-5 md:gap-8 lg:gap-10">
                {showcasePlayers.map((player, i) => (
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
                        color:
                          player.cardType === "premium"
                            ? "var(--color-fg-paper)"
                            : "var(--color-fg-blue-soft)",
                        background:
                          player.cardType === "premium"
                            ? "var(--color-fg-blue-deep)"
                            : "rgba(255,255,255,0.08)",
                        border:
                          player.cardType === "premium"
                            ? "1px solid var(--primary)"
                            : "1px solid rgba(255,255,255,0.18)",
                      }}
                    >
                      {player.cardType === "premium" ? "PREMIUM" : "GOLD"}
                    </span>
                    <Link
                      href={player.id.startsWith("showcase-") ? "/players" : `/players/${player.id}`}
                      className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
                      style={{ outlineColor: "var(--color-ring)" }}
                    >
                      <PlayerCard player={player} size="lg" />
                    </Link>
                  </motion.div>
                ))}
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
              href="/my/player-setup"
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
