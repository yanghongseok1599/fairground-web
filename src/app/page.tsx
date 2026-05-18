"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { useDataStore } from "@/stores/dataStore";
import { PlayerCard } from "@/components/player-card";
import { EmptyState } from "@/components/empty-state";
import { ScrollVideoHero, type HeroReveal } from "@/components/scroll-video-hero";
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

export default function HomePage() {
  const store = useDataStore();
  const prefersReducedMotion = useReducedMotion();
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsLoaded, setTeamsLoaded] = useState(false);
  const [showcasePlayers, setShowcasePlayers] = useState<Player[]>([]);

  useEffect(() => {
    const load = async () => {
      const [teamsData, playersData] = await Promise.all([
        store.fetchTeams(),
        store.fetchPlayers(),
      ]);

      setTeams(
        [...teamsData].sort(
          (a, b) =>
            (a.seasonStats.rank || 99) - (b.seasonStats.rank || 99) ||
            b.seasonStats.points - a.seasonStats.points
        )
      );
      setTeamsLoaded(true);

      // 쇼케이스: 프리미엄 티어 우선, 그다음 레이팅 높은 순.
      const ranked = [...playersData]
        .filter((p) => p.isApproved !== false)
        .sort((a, b) => {
          const tierA = a.cardType === "premium" ? 0 : 1;
          const tierB = b.cardType === "premium" ? 0 : 1;
          if (tierA !== tierB) return tierA - tierB;
          return (b.cardRating || 0) - (a.cardRating || 0);
        });
      setShowcasePlayers(ranked.slice(0, 4));
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
            <div className="text-center" aria-hidden>
              <div
                style={{
                  fontFamily: "var(--font-body), sans-serif",
                  fontWeight: 800,
                  color: "var(--color-fg-ink)",
                  fontSize: "clamp(40px, 9vw, 110px)",
                  lineHeight: 1,
                  letterSpacing: "-0.03em",
                }}
              >
                모두가 <span style={{ color: "var(--primary)" }}>승리하는</span>
                <br />
                그라운드
              </div>
              <div
                className="mt-4 tracking-[0.12em]"
                style={{
                  color: "var(--color-fg-ink-muted)",
                  fontFamily: "var(--font-body)",
                  fontWeight: 700,
                  fontSize: "clamp(13px, 2.5vw, 20px)",
                }}
              >
                EVERYONE WINS ON THIS GROUND
              </div>
            </div>
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
        <div className="relative max-w-6xl mx-auto">
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
                {teams.length > 0 && (
                  <Link
                    href="/teams"
                    className="group inline-flex items-center gap-3 fg-label transition-colors shrink-0 mb-2"
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
                { label: "리그 참가", href: "/register" },
                { label: "팀 전체 보기", href: "/teams" },
              ]}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {teams.map((team, i) => {
                const s = team.seasonStats;
                return (
                  <motion.div
                    key={team.id}
                    initial={
                      prefersReducedMotion
                        ? { opacity: 0 }
                        : { opacity: 0, y: 24 }
                    }
                    whileInView={
                      prefersReducedMotion
                        ? { opacity: 1 }
                        : { opacity: 1, y: 0 }
                    }
                    viewport={{ once: true, margin: "-60px" }}
                    transition={
                      prefersReducedMotion
                        ? { duration: 0.2 }
                        : {
                            delay: Math.min(i, 7) * 0.05,
                            type: "spring",
                            stiffness: 220,
                            damping: 24,
                          }
                    }
                  >
                    <Link
                      href={`/teams/${team.id}`}
                      className="group relative block h-full p-6 border rounded-[var(--radius-lg)] transition-all duration-200 hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                      style={{
                        background: "var(--color-fg-paper)",
                        borderColor: "var(--color-fg-line-soft)",
                        outlineColor: "var(--color-ring)",
                        boxShadow: "var(--shadow-sm)",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.boxShadow =
                          "var(--shadow-md)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.boxShadow =
                          "var(--shadow-sm)";
                      }}
                    >
                      <div
                        className="absolute top-0 left-0 h-[2px] w-0 group-hover:w-full transition-all duration-300 rounded-t-[var(--radius-lg)]"
                        style={{
                          background:
                            "linear-gradient(90deg, var(--primary), var(--color-fg-blue-deep))",
                        }}
                      />
                      <div className="flex items-center gap-3 mb-6">
                        {team.logo ? (
                          <Image
                            src={team.logo}
                            alt=""
                            width={44}
                            height={44}
                            className="w-11 h-11 object-contain"
                          />
                        ) : (
                          <div
                            className="w-11 h-11 grid place-items-center fg-display text-[14px]"
                            style={{
                              background: "var(--primary)",
                              color: "var(--primary-foreground)",
                            }}
                          >
                            {team.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        {s.rank > 0 && (
                          <span
                            className="ml-auto fg-mono text-[11px]"
                            style={{ color: "var(--color-fg-ink-muted)" }}
                          >
                            #{s.rank}
                          </span>
                        )}
                      </div>
                      <h3
                        className="fg-display mb-1"
                        style={{
                          fontSize: 20,
                          lineHeight: 1.1,
                          color: "var(--color-fg-ink)",
                        }}
                      >
                        {team.name}
                      </h3>
                      <p
                        className="fg-label mb-5"
                        style={{ color: "var(--color-fg-ink-muted)" }}
                      >
                        {team.memberCount}명 · {s.points}PTS
                      </p>
                      <div
                        className="grid grid-cols-3 gap-px border overflow-hidden rounded-[var(--radius-md)]"
                        style={{
                          background: "var(--color-fg-line-soft)",
                          borderColor: "var(--color-fg-line-soft)",
                        }}
                      >
                        {[
                          { k: "W", v: s.wins },
                          { k: "D", v: s.draws },
                          { k: "L", v: s.losses },
                        ].map((cell) => (
                          <div
                            key={cell.k}
                            className="py-3 text-center"
                            style={{ background: "var(--color-fg-paper)" }}
                          >
                            <div
                              className="fg-display fg-mono tabular-nums"
                              style={{
                                fontSize: 22,
                                lineHeight: 1,
                                color: "var(--color-fg-ink)",
                              }}
                            >
                              {cell.v}
                            </div>
                            <div
                              className="fg-label mt-1.5 text-[10px]"
                              style={{ color: "var(--color-fg-ink-muted)" }}
                            >
                              {cell.k}
                            </div>
                          </div>
                        ))}
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
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
        <div className="relative max-w-6xl mx-auto">
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
            <div className="flex flex-wrap items-end justify-center gap-6 md:gap-10">
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
                    href={`/players/${player.id}`}
                    className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
                    style={{ outlineColor: "var(--color-ring)" }}
                  >
                    <PlayerCard player={player} size="lg" />
                  </Link>
                </motion.div>
              ))}
            </div>
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
              href="/register"
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
