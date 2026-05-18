import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Section } from "@/components/section";

export const metadata: Metadata = {
  title: "소개 — 모두가 승리하는 그라운드",
  description:
    "현 풋살대회의 문제점과 FairGround의 해결책. 탈락 없는 시즌, 기록이 남는 경험, 누구나 환영하는 그라운드 — Connect · Compete · Collect.",
  alternates: { canonical: "https://fairground.kr/about" },
  openGraph: {
    title: "FairGround 소개 — 모두가 승리하는 그라운드",
    description:
      "경쟁만 강요하는 풋살대회를 축제로. 문제 → 해결, FairGround가 그라운드를 다시 설계한 이유.",
    url: "https://fairground.kr/about",
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
      "2시간 기다려 15분 뛰는 일이 흔하다",
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
      "골·어시스트·출전 기록 자동 저장",
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
      "안전 규정 최우선 + 경기 후 심판 평가로 운영 향상",
    ],
  },
] as const;

// 브랜드킷 2026 — 3C
const THREE_C = [
  { letter: "C", word: "Connect", desc: "선수와 선수, 팀과 팀을 잇다" },
  { letter: "C", word: "Compete", desc: "모두가 공정하게 겨루는 무대" },
  { letter: "C", word: "Collect", desc: "기록이 쌓이는 나만의 스탯" },
] as const;

export default function AboutPage() {
  return (
    <div>
      {/* ============================================================
          HERO INTRO
          ============================================================ */}
      <section
        className="relative overflow-hidden"
        style={{ background: "var(--primary)" }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden
          style={{
            background:
              "radial-gradient(120% 90% at 80% 0%, rgba(255,255,255,0.10), transparent 60%)",
          }}
        />
        <div className="relative max-w-6xl mx-auto px-5 md:px-10 pt-20 md:pt-28 pb-16 md:pb-24">
          <div
            className="fg-label mb-5"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            ABOUT FAIRGROUND
          </div>
          <h1
            className="fg-display"
            style={{
              fontSize: "clamp(40px, 8vw, 104px)",
              lineHeight: 0.98,
              letterSpacing: "-0.02em",
              color: "var(--color-fg-paper)",
            }}
          >
            모두가{" "}
            <span style={{ color: "rgba(255,255,255,0.4)" }}>승리하는</span>
            <br />
            그라운드
          </h1>
          <p
            className="mt-7 max-w-2xl text-[15px] md:text-[17px] leading-relaxed"
            style={{
              color: "rgba(255,255,255,0.78)",
              fontFamily: "var(--font-body)",
            }}
          >
            우리는 풋살대회를 다시 설계했습니다. 한 번 지면 끝나는 토너먼트가
            아니라, 시즌 내내 함께 뛰고 기록이 쌓이는 축제로. 실력과 상관없이
            누구나 들어와 자기 그라운드를 가질 수 있도록.
          </p>

          {/* 3C */}
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {THREE_C.map((c) => (
              <div
                key={c.word}
                className="px-6 py-7 rounded-[var(--radius-lg)]"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.18)",
                }}
              >
                <div
                  className="fg-display"
                  style={{
                    fontSize: 44,
                    lineHeight: 1,
                    letterSpacing: "-0.04em",
                    color: "var(--color-fg-paper)",
                  }}
                >
                  {c.letter}
                </div>
                <div
                  className="mt-2 fg-display tracking-[0.06em] text-[15px]"
                  style={{ color: "var(--color-fg-paper)" }}
                >
                  {c.word}
                </div>
                <div
                  className="mt-2 text-[13px] leading-relaxed"
                  style={{
                    color: "rgba(255,255,255,0.65)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {c.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          THE PROBLEM
          ============================================================ */}
      <Section
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
