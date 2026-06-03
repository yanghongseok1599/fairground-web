"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useDataStore } from "@/stores/dataStore";
import { useAuth } from "@/hooks/useAuth";
import { EmptyState } from "@/components/empty-state";
import { StandingsTable } from "@/components/standings-table";
import type { TeamStanding, Tournament } from "@/types";
import { ArrowRight, Calendar, MapPin, Trophy } from "lucide-react";

const statusLabel: Record<string, string> = {
  upcoming: "예정",
  ongoing: "진행중",
  completed: "종료",
};

const statusStyle: Record<string, { bg: string; color: string }> = {
  upcoming: { bg: "rgba(79,195,247,0.15)", color: "#4FC3F7" },
  ongoing: { bg: "rgba(0,200,83,0.15)", color: "#00C853" },
  completed: { bg: "rgba(98,125,152,0.2)", color: "#627D98" },
};

export default function TournamentsPage() {
  const store = useDataStore();
  const { user } = useAuth();
  const playerSetupHref = user ? "/my/player-setup" : "/login?returnTo=/my/player-setup";
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [standings, setStandings] = useState<TeamStanding[]>([]);
  const [loadingTournaments, setLoadingTournaments] = useState(true);
  const [loadingStandings, setLoadingStandings] = useState(true);

  useEffect(() => {
    store.fetchTournaments().then((list) => {
      setTournaments(list.sort((a, b) => b.createdAt - a.createdAt));
      setLoadingTournaments(false);
    });
    store.fetchStandings().then(() => {
      setLoadingStandings(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loadingStandings) {
      setStandings(store.standings);
    }
  }, [loadingStandings, store.standings]);

  return (
    <div className="pt-[60px] overflow-x-hidden">
      <section className="relative overflow-hidden px-5 py-14 sm:px-8 md:px-10 md:py-20" style={{ background: "var(--foreground)" }}>
        <div
          className="absolute inset-0 opacity-25"
          aria-hidden
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
            backgroundSize: "42px 42px",
          }}
        />
        <div className="relative mx-auto max-w-6xl">
          <div className="flex items-center gap-3 mb-4">
            <Trophy className="h-5 w-5" style={{ color: "var(--color-fg-paper)" }} />
            <span className="fg-label" style={{ color: "var(--color-fg-paper)" }}>
              Tournament Hub
            </span>
          </div>
          <h1
            className="fg-display leading-none"
            style={{
              fontSize: "clamp(44px, 7vw, 84px)",
              letterSpacing: "-0.02em",
              color: "var(--background)",
            }}
          >
            대회 · 순위
          </h1>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed" style={{ color: "var(--color-fg-ink-dim)" }}>
            페어그라운드 시즌 일정과 리그 순위를 실시간으로 확인하세요. 규정·카드·뱃지 안내는 소개 페이지에 있습니다.
          </p>
          <div className="mt-8 flex flex-wrap gap-2 sm:gap-3">
            {[
              { label: "대회 목록", href: "#schedule" },
              { label: "리그 순위", href: "#standings" },
              { label: "대회 규정", href: "/about#rules" },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="fg-label whitespace-nowrap border px-3 py-1.5 text-[11px] sm:px-4 sm:py-2 sm:text-xs transition-colors"
                style={{
                  color: "var(--background)",
                  borderColor: "rgba(255,255,255,0.18)",
                  background: "rgba(255,255,255,0.06)",
                }}
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      <section id="schedule" className="px-5 py-12 sm:px-8 md:px-10 md:py-18" style={{ background: "var(--color-fg-paper)" }}>
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-3 sm:gap-4">
            <div className="min-w-0">
              <p className="fg-label mb-3" style={{ color: "var(--color-fg-paper)" }}>
                Schedule
              </p>
              <h2 className="fg-display text-[28px] sm:text-[36px] md:text-[56px]" style={{ color: "var(--color-fg-ink)" }}>
                대회 목록
              </h2>
            </div>
            <Link
              href="/my/team"
              className="inline-flex items-center gap-2 whitespace-nowrap px-4 py-2.5 sm:px-5 sm:py-3 fg-display text-[12px] sm:text-[13px] tracking-[0.06em]"
              style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              팀 등록하기
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {loadingTournaments ? (
            <div className="py-16 text-center text-fg-gray-500">불러오는 중...</div>
          ) : tournaments.length === 0 ? (
            <EmptyState
              eyebrow="TOURNAMENTS"
              title="등록된 대회가 없습니다"
              description="새 시즌 일정이 확정되면 이곳에서 확인할 수 있습니다."
              actions={[
                { label: "우리팀 등록하기", href: "/my/team" },
                { label: "선수등록", href: playerSetupHref },
              ]}
            />
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {tournaments.map((t) => {
                const s = statusStyle[t.status] || statusStyle.completed;
                return (
                  <Link key={t.id} href={`/tournaments/${t.id}`}>
                    <div className="flex h-full cursor-pointer flex-col border bg-white p-6 transition-all hover:-translate-y-1 hover:shadow-lg" style={{ borderColor: "var(--color-fg-line-soft)" }}>
                      <div className="mb-4 flex items-center justify-between">
                        <span className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[2px]" style={{ background: s.bg, color: s.color, fontFamily: "var(--font-space-mono)" }}>
                          {statusLabel[t.status] || t.status}
                        </span>
                        {t.winningTeamName && (
                          <span className="text-xs font-semibold" style={{ color: "var(--color-fg-paper)" }}>
                            우승 {t.winningTeamName}
                          </span>
                        )}
                      </div>
                      <h3 className="mb-3 flex-1 text-xl font-bold leading-tight" style={{ fontFamily: "var(--font-outfit)", color: "#0D1B2A", letterSpacing: "-0.5px" }}>
                        {t.name}
                      </h3>
                      <div className="mt-auto space-y-1.5">
                        <div className="flex items-center gap-2 text-xs" style={{ color: "#627D98" }}>
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{t.date}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs" style={{ color: "#627D98" }}>
                          <MapPin className="h-3.5 w-3.5" />
                          <span>{t.location}</span>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center gap-1 text-xs font-medium" style={{ color: "#00C853" }}>
                        상세 보기 <ArrowRight className="h-3 w-3" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>


      <section id="standings" className="px-5 py-12 sm:px-8 md:px-10 md:py-18" style={{ background: "var(--color-fg-paper)" }}>
        <div className="mx-auto max-w-6xl min-w-0">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="fg-label mb-3" style={{ color: "var(--color-fg-paper)" }}>
                League Table
              </p>
              <h2 className="fg-display text-[28px] sm:text-[36px] md:text-[56px]" style={{ color: "var(--color-fg-ink)" }}>
                리그 순위
              </h2>
              {store.currentSeason && (
                <p className="mt-3 text-sm" style={{ color: "var(--color-fg-ink-muted)" }}>
                  {store.currentSeason.name} · {store.currentSeason.startDate} ~ {store.currentSeason.endDate}
                </p>
              )}
            </div>
          </div>

          {loadingStandings ? (
            <div className="py-16 text-center" style={{ color: "var(--color-fg-ink-dim)" }}>
              불러오는 중...
            </div>
          ) : standings.length === 0 ? (
            <EmptyState
              eyebrow="STANDINGS"
              title="아직 집계된 순위가 없습니다"
              description="시즌 경기가 진행되면 순위가 자동으로 집계됩니다."
              actions={[
                { label: "라이브 보기", href: "/live" },
                { label: "대회 목록", href: "#schedule" },
              ]}
            />
          ) : (
            <StandingsTable standings={standings} showPromotionSplit />
          )}
        </div>
      </section>

    </div>
  );
}
