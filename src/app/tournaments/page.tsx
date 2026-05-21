"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useDataStore } from "@/stores/dataStore";
import { BADGES } from "@/constants/badges";
import { EmptyState } from "@/components/empty-state";
import { PlayerCard } from "@/components/player-card";
import { StandingsTable } from "@/components/standings-table";
import type { Player, TeamStanding, Tournament } from "@/types";
import {
  ArrowRight,
  Award,
  Calendar,
  ClipboardList,
  Layers,
  MapPin,
  ShieldCheck,
  Trophy,
  UserPlus,
} from "lucide-react";

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

const RULES = [
  {
    icon: Calendar,
    title: "시즌 운영",
    body: "한 번 지면 끝나는 토너먼트가 아니라 시즌 전체를 뛰는 구조입니다. 경기 결과는 팀 전적과 선수 기록에 계속 누적됩니다.",
  },
  {
    icon: Layers,
    title: "상·하위 리그",
    body: "시즌 성적에 따라 다음 시즌 상위/하위 리그로 나뉩니다. 실력 차이를 줄이고 비슷한 수준끼리 더 오래 경쟁합니다.",
  },
  {
    icon: ShieldCheck,
    title: "공정 경기 규정",
    body: "여성 2인 의무 출전, 안전 규정, 페널티 관리를 기준으로 운영합니다. 거친 플레이와 비매너는 누적 관리됩니다.",
  },
  {
    icon: Award,
    title: "참가팀 전원 시상",
    body: "우승팀만 기억되는 대회가 아니라 모든 참가팀이 시즌 안에서 목표와 보상을 가질 수 있게 설계합니다.",
  },
];

const CARD_RULES = [
  {
    title: "기본 등록",
    value: "GOLD 90",
    body: "선수 등록을 완료하면 모든 선수는 골드 카드 90으로 시작합니다.",
  },
  {
    title: "기록 누적",
    value: "골 · 어시 · 경기 · MOM",
    body: "경기마다 주요 기록이 카드 하단 스탯으로 쌓입니다.",
  },
  {
    title: "프리미엄 승격",
    value: "WINNER ONLY",
    body: "시즌 우승팀 선수에게만 프리미엄 테두리가 지급됩니다.",
  },
  {
    title: "90+ 성장",
    value: "PREMIUM 90+",
    body: "프리미엄 선수만 누적 기록을 바탕으로 90점 이상 점수가 성장합니다.",
  },
];

const CARD_SYSTEM_PLAYERS: Array<{ id: "gold" | "premium"; label: string; player: Player }> = [
  {
    id: "gold",
    label: "GOLD 90",
    player: {
      id: "card-system-gold",
      uid: "card-system-gold",
      name: "이서준",
      number: 11,
      position: "ALA",
      teamId: "sample",
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
  },
  {
    id: "premium",
    label: "PREMIUM 90+",
    player: {
      id: "card-system-premium",
      uid: "card-system-premium",
      name: "김도현",
      number: 10,
      position: "PIVO",
      teamId: "sample",
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
  },
];

const BADGE_CATEGORY_LABEL: Record<string, string> = {
  field: "필드 선수",
  goalkeeper: "골키퍼",
  referee: "심판",
};

export default function TournamentsPage() {
  const store = useDataStore();
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
    <div className="pt-[60px]">
      <section className="relative overflow-hidden px-6 py-16 md:px-10 md:py-20" style={{ background: "var(--foreground)" }}>
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
            대회 · 규정 · 순위
          </h1>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed" style={{ color: "var(--color-fg-ink-dim)" }}>
            페어그라운드 시즌 운영 방식, 리그 순위, 선수 카드 시스템을 한 곳에서 확인하세요.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {[
              { label: "대회 목록", href: "#schedule" },
              { label: "대회 규정", href: "#rules" },
              { label: "리그 순위", href: "#standings" },
              { label: "카드 시스템", href: "#card-system" },
              { label: "뱃지 시스템", href: "#badge-system" },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="fg-label border px-4 py-2 transition-colors"
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

      <section id="schedule" className="px-6 py-14 md:px-10 md:py-18" style={{ background: "var(--color-fg-paper)" }}>
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="fg-label mb-3" style={{ color: "var(--color-fg-paper)" }}>
                Schedule
              </p>
              <h2 className="fg-display text-[36px] md:text-[56px]" style={{ color: "var(--color-fg-ink)" }}>
                대회 목록
              </h2>
            </div>
            <Link
              href="/my/team"
              className="inline-flex items-center gap-2 px-5 py-3 fg-display text-[13px] tracking-[0.06em]"
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
                { label: "선수등록", href: "/my/player-setup" },
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

      <section id="rules" className="px-6 py-14 md:px-10 md:py-18" style={{ background: "var(--color-fg-paper-2)" }}>
        <div className="mx-auto max-w-6xl">
          <p className="fg-label mb-3" style={{ color: "var(--color-fg-paper)" }}>
            Rules
          </p>
          <h2 className="fg-display text-[36px] md:text-[56px]" style={{ color: "var(--color-fg-ink)" }}>
            대회 규정
          </h2>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed" style={{ color: "var(--color-fg-ink-muted)" }}>
            실력 차이를 줄이고, 누구나 시즌 끝까지 즐길 수 있도록 운영 규칙을 명확히 관리합니다.
          </p>
          <div className="mt-10 overflow-hidden border bg-white" style={{ borderColor: "var(--color-fg-line-soft)" }}>
            <div className="grid grid-cols-1 md:grid-cols-4">
              {RULES.map((rule, index) => {
                const Icon = rule.icon;
                return (
                  <div
                    key={rule.title}
                    className="relative min-h-[260px] border-b p-6 md:border-b-0 md:border-r"
                    style={{ borderColor: "var(--color-fg-line-soft)" }}
                  >
                    <div className="mb-8 flex items-center justify-between">
                      <div
                        className="flex h-12 w-12 items-center justify-center"
                        style={{
                          background: index === 0 ? "var(--primary)" : "color-mix(in srgb, var(--primary) 10%, transparent)",
                          color: index === 0 ? "var(--primary-foreground)" : "var(--primary)",
                        }}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="fg-mono text-[11px]" style={{ color: "var(--color-fg-paper)" }}>
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>
                    {index < RULES.length - 1 && (
                      <div className="absolute right-[-15px] top-9 z-10 hidden h-[30px] w-[30px] rotate-45 border-r border-t bg-white md:block" style={{ borderColor: "var(--color-fg-line-soft)" }} />
                    )}
                    <h3 className="text-lg font-black" style={{ color: "var(--color-fg-ink)" }}>
                      {rule.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--color-fg-ink-muted)" }}>
                      {rule.body}
                    </p>
                    <div className="absolute bottom-0 left-0 h-1" style={{ width: `${25 * (index + 1)}%`, background: "var(--primary)" }} />
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-1 border-t md:grid-cols-3" style={{ borderColor: "var(--color-fg-line-soft)" }}>
              {[
                { label: "참가", value: "팀/선수 등록" },
                { label: "경기", value: "시즌 기록 누적" },
                { label: "결과", value: "순위·카드·시상 반영" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between border-b px-6 py-4 md:border-b-0 md:border-r" style={{ borderColor: "var(--color-fg-line-soft)" }}>
                  <span className="fg-label text-[10px]" style={{ color: "var(--color-fg-paper)" }}>
                    {item.label}
                  </span>
                  <span className="text-sm font-black" style={{ color: "var(--color-fg-ink)" }}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="standings" className="px-6 py-14 md:px-10 md:py-18" style={{ background: "var(--color-fg-paper)" }}>
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="fg-label mb-3" style={{ color: "var(--color-fg-paper)" }}>
                League Table
              </p>
              <h2 className="fg-display text-[36px] md:text-[56px]" style={{ color: "var(--color-fg-ink)" }}>
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
            <>
              <StandingsTable standings={standings} showPromotionSplit />
              {standings.length > 1 && (
                <div className="mt-6 flex flex-wrap gap-5 text-xs" style={{ color: "var(--color-fg-ink-muted)", fontFamily: "var(--font-body)" }}>
                  <div className="flex items-center gap-2">
                    <span className="fg-label px-1.5 py-0.5 text-[9px]" style={{ color: "var(--color-fg-paper)", border: "1px solid color-mix(in srgb, var(--primary) 40%, transparent)", background: "color-mix(in srgb, var(--primary) 6%, transparent)" }}>
                      상위
                    </span>
                    <span>상위 절반 — 다음 시즌 상위 리그 배정</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="fg-label px-1.5 py-0.5 text-[9px]" style={{ color: "var(--color-fg-ink-dim)", border: "1px solid var(--color-fg-line-soft)" }}>
                      하위
                    </span>
                    <span>하위 절반 — 다음 시즌 하위 리그 배정</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <section id="card-system" className="px-6 py-14 md:px-10 md:py-18" style={{ background: "var(--foreground)" }}>
        <div className="mx-auto max-w-6xl">
          <div className="mb-9 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="fg-label mb-3" style={{ color: "var(--color-fg-paper)" }}>
                Player Card System
              </p>
              <h2 className="fg-display text-[36px] md:text-[56px]" style={{ color: "var(--background)" }}>
                카드 시스템
              </h2>
              <p className="mt-4 max-w-2xl text-[15px] leading-relaxed" style={{ color: "var(--color-fg-ink-dim)" }}>
                페어그라운드의 카드는 단순 프로필이 아니라 시즌 기록과 우승 이력이 남는 선수 성장판입니다.
              </p>
            </div>
            <Link
              href="/my/player-setup"
              className="inline-flex items-center gap-2 px-5 py-3 fg-display text-[13px] tracking-[0.06em]"
              style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              <UserPlus className="h-4 w-4" />
              선수등록
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div className="flex flex-wrap items-end justify-center gap-4 pb-4 md:gap-6">
              {CARD_SYSTEM_PLAYERS.map((card) => (
                <div key={card.id} className="flex shrink-0 flex-col items-center gap-3">
                  <span
                    className="fg-label rounded-full px-3 py-1 text-[10px]"
                    style={{
                      color: card.id === "premium" ? "var(--background)" : "var(--color-fg-blue-soft)",
                      border: "1px solid rgba(255,255,255,0.18)",
                      background: card.id === "premium" ? "var(--primary)" : "rgba(255,255,255,0.08)",
                    }}
                  >
                    {card.label}
                  </span>
                  <div
                    style={{
                      filter:
                        card.id === "premium"
                          ? "drop-shadow(0 0 10px rgba(0,230,180,0.35)) drop-shadow(0 18px 22px rgba(0,0,0,0.35))"
                          : "drop-shadow(0 18px 22px rgba(0,0,0,0.35))",
                    }}
                  >
                    <PlayerCard player={card.player} size="md" disableHoverScale />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {CARD_RULES.map((rule, index) => (
                <div key={rule.title} className="border p-6" style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)" }}>
                  <div className="mb-5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-4 w-4" style={{ color: "var(--color-fg-paper)" }} />
                      <span className="fg-label text-[10px]" style={{ color: "var(--color-fg-paper)" }}>
                        {rule.title}
                      </span>
                    </div>
                    <span className="fg-mono text-[11px]" style={{ color: "rgba(255,255,255,0.36)" }}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="fg-display min-h-[56px] text-[26px] leading-none" style={{ color: "var(--background)" }}>
                    {rule.value}
                  </div>
                  <p className="mt-4 text-sm leading-relaxed" style={{ color: "var(--color-fg-ink-dim)" }}>
                    {rule.body}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-3">
            {[
              "골드 카드는 등록 즉시 지급되는 기본 카드입니다.",
              "우승팀 선수만 프리미엄 테두리로 승격됩니다.",
              "프리미엄부터 누적 기록에 따라 90점 이상 성장합니다.",
            ].map((text) => (
              <div key={text} className="border px-5 py-4 text-sm" style={{ borderColor: "rgba(255,255,255,0.12)", color: "var(--color-fg-ink-dim)" }}>
                {text}
              </div>
            ))}
          </div>

          <div id="badge-system" className="mt-16 scroll-mt-24 border-t pt-12" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
            <div className="mb-9 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="fg-label mb-3" style={{ color: "var(--color-fg-paper)" }}>
                  Badge System
                </p>
                <h3 className="fg-display text-[32px] md:text-[48px]" style={{ color: "var(--background)" }}>
                  뱃지 시스템
                </h3>
                <p className="mt-4 max-w-2xl text-[15px] leading-relaxed" style={{ color: "var(--color-fg-ink-dim)" }}>
                  뱃지는 단순 장식이 아니라 시즌 안에서 남긴 업적의 기록입니다. 득점, 출전, 우승, 페어플레이, 심판 평가까지 선수 카드에 업적으로 남습니다.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {Object.entries(BADGE_CATEGORY_LABEL).map(([key, label]) => (
                  <div key={key} className="border px-4 py-3" style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)" }}>
                    <div className="fg-display text-[22px]" style={{ color: "var(--background)" }}>
                      {BADGES.filter((badge) => badge.category === key).length}
                    </div>
                    <div className="fg-label mt-1 text-[9px]" style={{ color: "var(--color-fg-ink-dim)" }}>
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-10">
              {Object.entries(BADGE_CATEGORY_LABEL).map(([category, label]) => {
                const badges = BADGES.filter((badge) => badge.category === category);
                return (
                  <div key={category}>
                    <div className="mb-4 flex items-center gap-3">
                      <span className="h-px w-8" style={{ background: "rgba(255,255,255,0.35)" }} />
                      <h4 className="fg-label text-[12px]" style={{ color: "var(--color-fg-paper)" }}>
                        {label} 뱃지
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {badges.map((badge) => (
                        <div
                          key={badge.id}
                          className="grid grid-cols-[56px_1fr] gap-4 border p-4"
                          style={{
                            borderColor: "rgba(255,255,255,0.12)",
                            background: "rgba(255,255,255,0.045)",
                          }}
                        >
                          <div className="flex h-14 w-14 items-center justify-center">
                            <img
                              src={badge.imageUrl}
                              alt=""
                              className="h-14 w-14 object-contain"
                              style={{ filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.35))" }}
                              draggable={false}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <h5 className="font-black leading-tight" style={{ color: "var(--background)" }}>
                                {badge.name}
                              </h5>
                              {badge.maxProgress && badge.maxProgress > 1 && (
                                <span className="fg-mono shrink-0 text-[10px]" style={{ color: "var(--color-fg-paper)" }}>
                                  {badge.maxProgress}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--color-fg-ink-dim)" }}>
                              {badge.description}
                            </p>
                            <p className="mt-3 border-t pt-2 text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.58)", borderColor: "rgba(255,255,255,0.10)" }}>
                              획득 조건: {badge.unlockCondition}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
