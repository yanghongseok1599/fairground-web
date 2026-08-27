import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  Calendar,
  ClipboardList,
  Download,
  Layers,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { Section } from "@/components/section";
import { PlayerCard } from "@/components/player-card";
import { BADGES } from "@/constants/badges";
import { ANONYMOUS_PLAYER_CARD_POSE_SOURCES } from "@/lib/player-card-pose-templates";
import { MATCH_RULEBOOK_PDF_PATH } from "@/lib/rulebook-assets";
import { SITE_URL } from "@/lib/site-config";
import type { Player } from "@/types";

export const metadata: Metadata = {
  title: "소개 — 모두가 승리하는 그라운드",
  description:
    "현 풋살대회의 문제점과 FairGround의 해결책. 탈락 없는 시즌, 심판·부심·관리자 실시간 기록, 선수카드와 리그 데이터가 남는 그라운드.",
  alternates: { canonical: `${SITE_URL}/about` },
  openGraph: {
    title: "FairGround 소개 — 모두가 승리하는 그라운드",
    description:
      "경쟁만 강요하는 풋살대회를 축제로. 심판·부심·관리자 실시간 기록과 선수카드 성장까지 FairGround가 그라운드를 다시 설계한 이유.",
    url: `${SITE_URL}/about`,
  },
};

// 현 풋살대회의 문제점 (랜딩 chapter 01 → 이전)
const PROBLEMS = [
  {
    num: "01",
    title: "경쟁만 강요하는 구조",
    items: [
      "한 번 지면 끝, 30분 뛰고 집에 간다",
      "실력 무시한 대진 — 초보팀이 10-0으로 무너진다",
      "우승팀만 보상, 나머지는 기억에도 없다",
      "진 팀은 조용히 짐 싸고 나가는 분위기",
    ],
  },
  {
    num: "02",
    title: "돈 내고 시간 버리는 경험",
    items: [
      "2시간 기다려 12분 뛰는 일이 흔하다",
      "팀당 참가비 내고 돌아오는 게 없다",
      "골·어시스트 기록이 전혀 남지 않는다",
      "이전 대회 성과가 다음으로 이어지지 않는다",
    ],
  },
  {
    num: "03",
    title: "처음부터 막혀있는 문",
    items: [
      "팀 없으면 참가 불가 — 개인은 방법이 없다",
      "분위기 자체가 특정 사람을 전제로 한다",
      "정보가 카페·밴드에 흩어져 찾기 어렵다",
      "거친 플레이 방치, 심판 오심 난무",
    ],
  },
] as const;

// FairGround의 해결책 (랜딩 chapter 02 → 이전)
const SOLUTIONS = [
  {
    num: "01",
    title: "시즌 내내 화합하고 즐기는 축제",
    items: [
      "탈락 없이 시즌 전체를 뛴다",
      "시즌 후 상·하위 리그 분할 — 수준에 맞는 매칭",
      "참가팀 전원 시상",
      "꾸준히 나올수록 승점이 쌓인다",
    ],
  },
  {
    num: "02",
    title: "기록이 남는 경험",
    items: [
      "5경기 보장 — 충분한 경기 시간, 대기 최소화",
      "참가비만큼의 경험과 가치를 돌려준다",
      "심판·부심이 득점자와 어시스트 선수를 경기 중 체크",
      "놓친 어시스트는 관리자가 실시간 보강",
      "시즌 성과가 다음 시즌으로 이어진다",
    ],
  },
  {
    num: "03",
    title: "누구나 환영",
    items: [
      "개인 참가 가능, 팀 매칭 지원",
      "여성 2인 의무 출전 규정",
      "앱 하나로 모든 정보 한눈에",
      "안전 규정 최우선 + MOM은 심판이 선정",
    ],
  },
] as const;

// 브랜드킷 2026 — 3C
const THREE_C = [
  { letter: "C", word: "Connect", desc: "선수와 선수, 팀과 팀을 잇다" },
  { letter: "C", word: "Compete", desc: "모두가 공정하게 겨루는 무대" },
  { letter: "C", word: "Collect", desc: "기록이 쌓이는 나만의 스탯" },
] as const;

// 대회 운영 규정 요약 (대회 페이지 → 소개 이전)
const RULES = [
  {
    icon: Calendar,
    title: "시즌 운영",
    body: "한 번 지면 끝나는 토너먼트가 아니라 시즌 전체를 뛰는 구조입니다. 경기 결과와 개인 기록은 팀 전적과 선수카드에 계속 누적됩니다.",
  },
  {
    icon: Layers,
    title: "상·하위 리그",
    body: "시즌 성적에 따라 다음 시즌 상위/하위 리그로 나뉩니다. 실력 차이를 줄이고 비슷한 수준끼리 더 오래 경쟁합니다.",
  },
  {
    icon: ShieldCheck,
    title: "공정 경기 규정",
    body: "심판·부심·관리자가 득점자와 어시스트를 교차 확인합니다. 여성 2인 의무 출전, 안전 규정, 페널티 관리도 함께 운영합니다.",
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
    value: "BASE 70",
    body: "선수 등록을 완료하면 모든 선수는 기본 카드 70으로 시작합니다.",
  },
  {
    title: "기록 누적",
    value: "골 · 어시 · 경기 · MOM",
    body: "심판·부심이 득점자와 어시스트를 체크하고, 관리자가 놓친 기록을 보강해 카드 하단 스탯으로 쌓습니다.",
  },
  {
    title: "플래티넘 승격",
    value: "WINNER ONLY",
    body: "필드 우승팀은 팀카드 특수효과로 구분되고, 우승팀 선수에게는 플래티넘 테두리가 지급됩니다.",
  },
  {
    title: "90+ 성장",
    value: "PLATINUM 90+",
    body: "플래티넘 선수는 누적 기록을 바탕으로 90점 이상까지 성장할 수 있습니다.",
  },
];

const CARD_SYSTEM_PLAYERS: Array<{ id: "bronze" | "silver" | "gold" | "premium"; label: string; player: Player }> = [
  {
    id: "bronze",
    label: "BRONZE 70",
    player: {
      id: "card-system-bronze",
      uid: "card-system-bronze",
      name: "박민수",
      number: 4,
      position: "ALA",
      teamId: "sample",
      nationality: "KOR",
      photoUrl: ANONYMOUS_PLAYER_CARD_POSE_SOURCES.female02,
      cardType: "bronze",
      cardRating: 72,
      stats: { goals: 2, assists: 3, games: 8, mom: 0 },
      badges: ["fair_play"],
      penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 0 },
      isApproved: true,
      role: "player",
      createdAt: 0,
    },
  },
  {
    id: "silver",
    label: "SILVER 80",
    player: {
      id: "card-system-silver",
      uid: "card-system-silver",
      name: "정우진",
      number: 8,
      position: "PIVO",
      teamId: "sample",
      nationality: "KOR",
      photoUrl: ANONYMOUS_PLAYER_CARD_POSE_SOURCES.male02,
      cardType: "silver",
      cardRating: 84,
      stats: { goals: 6, assists: 5, games: 12, mom: 1 },
      badges: ["playmaker", "iron_man"],
      penaltyStatus: { isBanned: false, banMatchesRemaining: 0, seasonYellowCards: 0 },
      isApproved: true,
      role: "player",
      createdAt: 0,
    },
  },
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
      photoUrl: ANONYMOUS_PLAYER_CARD_POSE_SOURCES.female01,
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
    label: "PLATINUM 100+",
    player: {
      id: "card-system-premium",
      uid: "card-system-premium",
      name: "김도현",
      number: 10,
      position: "PIVO",
      teamId: "sample",
      nationality: "KOR",
      photoUrl: ANONYMOUS_PLAYER_CARD_POSE_SOURCES.male01,
      cardType: "premium",
      cardRating: 104,
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

export default function AboutPage() {
  return (
    // word-break: keep-all — 한글이 음절 중간(예: 해결책→해결/책, 축제→축/제)에서
    // 끊기지 않고 공백(어절) 단위로만 줄바꿈되게 해 모든 모바일 폭에서 가독성 확보.
    // overflow-wrap: 아주 긴 토큰만 예외적으로 분절.
    <div style={{ wordBreak: "keep-all", overflowWrap: "break-word" }}>
      {/* ============================================================
          HERO INTRO
          ============================================================ */}
      <section className="relative min-h-[calc(100vh-60px)] overflow-hidden bg-white pt-[60px]">
        <img
          src="/image.png"
          alt=""
          aria-hidden="true"
          className="absolute inset-y-0 right-0 h-full w-[62%] object-cover object-[58%_center] md:w-[78%] md:object-[42%_center] lg:w-[74%]"
        />
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden
          style={{
            background:
              "linear-gradient(90deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0.98) 38%, rgba(255,255,255,0.58) 62%, rgba(255,255,255,0.08) 100%)",
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none opacity-50"
          aria-hidden
          style={{
            backgroundImage:
              "linear-gradient(rgba(0,71,171,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,71,171,0.05) 1px, transparent 1px)",
            backgroundSize: "42px 42px",
          }}
        />

        <div className="relative mx-auto flex min-h-[calc(100vh-60px)] max-w-[1440px] flex-col justify-between px-5 pb-8 pt-16 sm:px-8 md:px-12 md:pb-10 md:pt-24">
          <div className="max-w-[620px]">
            <div
              className="fg-label mb-8"
              style={{ color: "var(--color-fg-blue)" }}
            >
              ABOUT FAIRGROUND
            </div>
            <p
              className="mb-5 text-[15px] font-black tracking-[-0.02em] md:text-[18px]"
              style={{ color: "var(--color-fg-blue-deep)" }}
            >
              모두가 승리하는 그라운드
            </p>
            <h1
              className="fg-display"
              style={{
                // "FAIRGROUND"(10글자)가 max-w-620 컬럼을 넘어 단어 중간에서
                // 줄바꿈되던 문제 → 컬럼에 맞게 상한을 낮추고 nowrap 으로 고정.
                fontSize: "clamp(40px, 8.5vw, 88px)",
                lineHeight: 0.95,
                letterSpacing: "-0.03em",
                whiteSpace: "nowrap",
                color: "var(--color-fg-blue-deep)",
                textShadow: "0 8px 22px rgba(0,71,171,0.10)",
              }}
            >
              FAIRGROUND
              <br />
              REAL GAME.
            </h1>
            <div
              className="mt-8 max-w-[500px] space-y-3 text-[15px] leading-relaxed md:text-[17px]"
              style={{
                color: "var(--color-fg-ink)",
                fontFamily: "var(--font-body)",
              }}
            >
              <p style={{ color: "var(--color-fg-ink)", fontWeight: 600 }}>
                우리는 풋살대회를 다시 설계했습니다.
              </p>
              <p>
                한 번 지면 끝나는 토너먼트가 아니라,
                <br />
                시즌 내내 함께 뛰고 기록이 쌓이는 축제로.
              </p>
              <p>
                실력과 상관없이 누구나 들어와
                <br />
                자기 그라운드를 가질 수 있도록.
              </p>
            </div>

            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                href="#problem"
                className="inline-flex min-h-[48px] items-center gap-4 px-7 fg-display text-[14px] tracking-[0.04em] transition-transform hover:-translate-y-0.5"
                style={{
                  background: "var(--primary)",
                  color: "var(--primary-foreground)",
                  boxShadow: "0 14px 30px rgba(0,71,171,0.20)",
                }}
              >
                리그 알아보기
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/tournaments"
                className="inline-flex min-h-[48px] items-center gap-4 border px-7 fg-display text-[14px] tracking-[0.04em] transition-transform hover:-translate-y-0.5"
                style={{
                  background: "rgba(255,255,255,0.72)",
                  borderColor: "rgba(0,71,171,0.24)",
                  color: "var(--primary)",
                }}
              >
                경기 일정 보기
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="mt-12 flex flex-col gap-5 md:mt-16 md:flex-row md:items-end md:justify-between">
            <div className="grid max-w-[560px] grid-cols-3 gap-2">
              {THREE_C.map((c) => (
                <div
                  key={c.word}
                  className="border-l-2 py-1 pl-3"
                  style={{ borderColor: "var(--primary)" }}
                >
                  <div
                    className="fg-display text-[13px] tracking-[0.08em]"
                    style={{ color: "var(--primary)" }}
                  >
                    {c.word}
                  </div>
                  <div
                    className="mt-1 text-[11px] leading-snug"
                    style={{ color: "var(--color-fg-ink)" }}
                  >
                    {c.desc}
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden items-center gap-5 md:flex">
              <span
                className="fg-label text-[10px]"
                style={{ color: "var(--primary)" }}
              >
                SCROLL
              </span>
              <span
                className="h-px w-28"
                style={{ background: "rgba(0,71,171,0.25)" }}
              />
              <span
                className="fg-label text-[10px]"
                style={{ color: "var(--primary)" }}
              >
                01 / 05
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          THE PROBLEM
          ============================================================ */}
      <Section
        id="problem"
        chapter="01"
        label="THE PROBLEM"
        title="현 풋살대회의 문제점"
        description="아마추어가 시간과 돈을 들여 경기장에 서지만, 돌아오는 건 너무 적었습니다."
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PROBLEMS.map((card) => (
            <div
              key={card.num}
              className="group relative p-7 rounded-[var(--radius-lg)] transition-all duration-200 hover:-translate-y-1 border"
              style={{
                background: "var(--color-fg-paper-2)",
                borderColor: "var(--color-fg-line-soft)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div
                className="absolute top-0 left-0 h-[2px] w-full rounded-t-[var(--radius-lg)]"
                style={{ background: "var(--color-fg-ink-muted)" }}
              />
              <div className="flex items-start justify-between mb-6">
                <span
                  className="fg-mono text-[11px]"
                  style={{ color: "var(--color-fg-ink-muted)" }}
                >
                  PROB · {card.num}
                </span>
                <span
                  className="fg-display"
                  style={{
                    fontSize: 44,
                    color: "var(--color-fg-paper-3)",
                    lineHeight: 1,
                  }}
                >
                  {card.num}
                </span>
              </div>
              <h3
                className="fg-display mb-6"
                style={{
                  fontSize: 26,
                  lineHeight: 1.05,
                  color: "var(--color-fg-ink)",
                }}
              >
                {card.title}
              </h3>
              <ul className="space-y-3">
                {card.items.map((p, i) => (
                  <li
                    key={i}
                    className="flex gap-3 text-[13px] leading-relaxed"
                    style={{
                      color: "var(--color-fg-ink-muted)",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    <span
                      className="shrink-0 mt-[6px] w-2 h-[2px]"
                      style={{ background: "var(--color-fg-ink-muted)" }}
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
      <Section
        chapter="02"
        label="HOW WE FIX IT"
        title="FAIRGROUND의 해결책"
        description="문제를 하나씩 뒤집었습니다. 탈락 대신 시즌, 소비 대신 기록, 장벽 대신 환영."
        dark
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SOLUTIONS.map((card) => (
            <div
              key={card.num}
              className="group relative p-7 rounded-[var(--radius-lg)] transition-all duration-200 hover:-translate-y-1 border"
              style={{
                background: "var(--color-fg-paper)",
                borderColor: "var(--color-fg-line-soft)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div
                className="absolute top-0 left-0 h-[2px] w-full rounded-t-[var(--radius-lg)]"
                style={{ background: "var(--primary)" }}
              />
              <div className="flex items-start justify-between mb-6">
                <span
                  className="fg-mono text-[11px]"
                  style={{ color: "var(--primary)" }}
                >
                  SOLV · {card.num}
                </span>
                <span
                  className="fg-display"
                  style={{
                    fontSize: 44,
                    color: "var(--color-fg-paper-3)",
                    lineHeight: 1,
                  }}
                >
                  {card.num}
                </span>
              </div>
              <h3
                className="fg-display mb-6"
                style={{
                  fontSize: 26,
                  lineHeight: 1.05,
                  color: "var(--color-fg-ink)",
                }}
              >
                {card.title}
              </h3>
              <ul className="space-y-3">
                {card.items.map((s, i) => (
                  <li
                    key={i}
                    className="flex gap-3 text-[13px] leading-relaxed"
                    style={{
                      color: "var(--color-fg-ink-muted)",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    <span
                      className="shrink-0 mt-[6px] w-2 h-[2px]"
                      style={{ background: "var(--primary)" }}
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
          RULES (대회 페이지 → 이전)
          ============================================================ */}
      <section id="rules" className="scroll-mt-24 px-5 py-12 sm:px-8 md:px-10 md:py-18" style={{ background: "var(--color-fg-paper-2)" }}>
        <div className="mx-auto max-w-6xl">
          <p className="fg-label mb-3" style={{ color: "var(--color-fg-paper)" }}>
            Rules
          </p>
          <h2 className="fg-display text-[28px] sm:text-[36px] md:text-[56px]" style={{ color: "var(--color-fg-ink)" }}>
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
                { label: "경기", value: "득점·어시 실시간 체크" },
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

          {/* 전체 룰북 보기 — 상세 경기·운영 규정 페이지로 이동 */}
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/rulebook"
              className="inline-flex min-h-[48px] items-center gap-2 px-7 text-[14px] font-bold transition-transform hover:-translate-y-0.5"
              style={{ background: "var(--primary)", color: "var(--color-fg-paper)", boxShadow: "0 12px 26px rgba(0,71,171,0.28)" }}
            >
              경기규정 상세 보기 →
            </Link>
            <a
              href={MATCH_RULEBOOK_PDF_PATH}
              download
              className="inline-flex min-h-[48px] items-center gap-2 border px-7 text-[14px] font-bold transition-transform hover:-translate-y-0.5"
              style={{ background: "var(--color-fg-paper)", borderColor: "rgba(0,71,171,0.22)", color: "var(--primary)" }}
            >
              <Download className="h-4 w-4" />
              PDF 다운로드
            </a>
          </div>
        </div>
      </section>

      {/* ============================================================
          CARD SYSTEM + BADGE SYSTEM (대회 페이지 → 이전)
          ============================================================ */}
      <section id="card-system" className="scroll-mt-24 px-5 py-12 sm:px-8 md:px-10 md:py-18" style={{ background: "var(--foreground)" }}>
        <div className="mx-auto max-w-6xl">
          <div className="mb-9 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="fg-label mb-3" style={{ color: "var(--color-fg-paper)" }}>
                Player Card System
              </p>
              <h2 className="fg-display text-[28px] sm:text-[36px] md:text-[56px]" style={{ color: "var(--background)" }}>
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
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center max-w-full min-w-0">
            <div className="flex flex-wrap items-end justify-center gap-4 pb-4 md:gap-6 max-w-full min-w-0">
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
                <div key={rule.title} className="border p-5" style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)" }}>
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-3.5 w-3.5" style={{ color: "var(--color-fg-paper)" }} />
                      <span className="fg-label text-[9px]" style={{ color: "var(--color-fg-paper)" }}>
                        {rule.title}
                      </span>
                    </div>
                    <span className="fg-mono text-[10px]" style={{ color: "rgba(255,255,255,0.36)" }}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="fg-display min-h-[40px] text-[20px] leading-none" style={{ color: "var(--background)" }}>
                    {rule.value}
                  </div>
                  <p className="mt-3 text-[13px] leading-relaxed" style={{ color: "var(--color-fg-ink-dim)" }}>
                    {rule.body}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-3">
            {[
              "골드 카드는 등록 즉시 지급되는 기본 카드입니다.",
              "필드 우승팀은 팀카드 테두리에 특수효과가 적용됩니다.",
              "우승팀 선수는 플래티넘으로 승격되고 누적 기록에 따라 90점 이상 성장합니다.",
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
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                      {badges.map((badge) => (
                        <div
                          key={badge.id}
                          className="flex flex-col gap-2 border p-3 sm:grid sm:grid-cols-[56px_1fr] sm:gap-4 sm:p-4"
                          style={{
                            borderColor: "rgba(255,255,255,0.12)",
                            background: "rgba(255,255,255,0.045)",
                          }}
                        >
                          <div className="flex h-12 w-12 items-center justify-center sm:h-14 sm:w-14">
                            <img
                              src={badge.imageUrl}
                              alt=""
                              className="h-12 w-12 object-contain sm:h-14 sm:w-14"
                              style={{ filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.35))" }}
                              draggable={false}
                            />
                          </div>
                          <div className="min-w-0">
                            <h5 className="font-black leading-tight" style={{ color: "var(--background)" }}>
                              {badge.name}
                            </h5>
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

      {/* ============================================================
          TAGLINE + CTA
          ============================================================ */}
      <section
        className="relative overflow-hidden"
        style={{ background: "var(--color-fg-ink)" }}
      >
        <div className="relative max-w-4xl mx-auto px-5 md:px-10 py-20 md:py-28 text-center">
          <p
            className="fg-display"
            style={{
              fontSize: "clamp(28px, 5vw, 56px)",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              color: "var(--color-fg-paper)",
            }}
          >
            모두가{" "}
            <span style={{ color: "rgba(255,255,255,0.35)" }}>승리하는</span>{" "}
            그라운드
          </p>
          <p
            className="mt-4 fg-label"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            EVERYONE WINS ON THIS GROUND
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
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
              리그 참가하기
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-3 px-7 py-4 fg-display tracking-[0.06em] text-[15px] border rounded-[var(--radius-md)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{
                borderColor: "rgba(255,255,255,0.25)",
                color: "var(--color-fg-paper)",
                outlineColor: "var(--color-ring)",
              }}
            >
              그라운드 둘러보기
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
