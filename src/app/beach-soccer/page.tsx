import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  Layers,
  ListChecks,
  MapPinned,
  Medal,
  ShieldCheck,
  Ticket,
  Trophy,
  Users,
} from "lucide-react";
import {
  BEACH_SOCCER_APPLY_PATH,
  BEACH_SOCCER_AWARD_SHORT_LABEL,
  BEACH_SOCCER_AWARD_BENEFIT,
  BEACH_SOCCER_DIVISIONS,
  BEACH_SOCCER_DIVISIONS_LABEL,
  BEACH_SOCCER_ENTRY_FEE_LABEL,
  BEACH_SOCCER_EVENT_DATE_FULL_LABEL,
  BEACH_SOCCER_EVENT_DATE_LABEL,
  BEACH_SOCCER_EVENT_LOCATION_FULL_LABEL,
  BEACH_SOCCER_EVENT_LOCATION_LABEL,
  BEACH_SOCCER_MATCH_FORMAT_LABEL,
  BEACH_SOCCER_MIN_TEAMS_NOTE,
  BEACH_SOCCER_PRIZE_LABEL,
  BEACH_SOCCER_REGULATIONS,
  BEACH_SOCCER_RULEBOOK,
  BEACH_SOCCER_TEAM_LIMIT_LABEL,
} from "@/lib/beach-soccer-event";
import { SITE_URL } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "전국 비치사커대회",
  description:
    `FairGround 여름 특별 프로젝트. ${BEACH_SOCCER_EVENT_DATE_FULL_LABEL} ${BEACH_SOCCER_EVENT_LOCATION_FULL_LABEL}에서 열리는 전국 비치사커대회. ${BEACH_SOCCER_DIVISIONS_LABEL} 세 부문, 총상금 ${BEACH_SOCCER_PRIZE_LABEL}, 참가비 ${BEACH_SOCCER_ENTRY_FEE_LABEL}, 입상 혜택 ${BEACH_SOCCER_AWARD_SHORT_LABEL}.`,
  alternates: { canonical: `${SITE_URL}/beach-soccer` },
  openGraph: {
    title: "전국 비치사커대회",
    description:
      "대학부·남자부·여자부 세 부문으로 겨루는 FairGround 여름 비치사커 이벤트 매치.",
    url: `${SITE_URL}/beach-soccer`,
    images: [
      {
        url: "/promotions/beach-soccer-2026-3div.png",
        width: 1080,
        height: 1350,
        alt: "전국 비치사커대회",
      },
    ],
  },
};

const PROJECT_POINTS = [
  {
    icon: Layers,
    title: "세 부문으로 출전",
    body: "대학부·남자부·여자부 세 부문으로 나누어 참가하며, 각 부문 4팀 이상이 모이면 경기가 진행됩니다.",
  },
  {
    icon: MapPinned,
    title: `${BEACH_SOCCER_EVENT_LOCATION_LABEL} 개최`,
    body: `${BEACH_SOCCER_EVENT_DATE_FULL_LABEL}, ${BEACH_SOCCER_EVENT_LOCATION_FULL_LABEL}에서 여름 바다를 배경으로 열립니다.`,
  },
  {
    icon: ClipboardCheck,
    title: "하루 집중 이벤트",
    body: "짧고 선명한 대회 일정으로 참가팀이 부담 없이 모이고, 현장에서 바로 경기를 즐길 수 있습니다.",
  },
  {
    icon: Medal,
    title: "경기 기록 제공",
    body: "득점, 도움, 경기 결과가 기록되어 참가자들이 대회 후에도 자신의 순간을 확인할 수 있습니다.",
  },
  {
    icon: Trophy,
    title: "입상팀 골드 등급 승급",
    body: BEACH_SOCCER_AWARD_BENEFIT,
  },
] as const;

const EVENT_FACTS = [
  { icon: CalendarDays, label: "일정", value: BEACH_SOCCER_EVENT_DATE_LABEL },
  { icon: MapPinned, label: "장소", value: BEACH_SOCCER_EVENT_LOCATION_LABEL },
  { icon: Layers, label: "부문", value: BEACH_SOCCER_DIVISIONS_LABEL },
  { icon: Users, label: "경기 방식", value: BEACH_SOCCER_MATCH_FORMAT_LABEL },
  { icon: ListChecks, label: "팀 인원", value: BEACH_SOCCER_TEAM_LIMIT_LABEL },
  { icon: Trophy, label: "총상금", value: BEACH_SOCCER_PRIZE_LABEL },
  { icon: Ticket, label: "참가비", value: BEACH_SOCCER_ENTRY_FEE_LABEL },
  { icon: Medal, label: "입상 혜택", value: BEACH_SOCCER_AWARD_SHORT_LABEL },
] as const;

const FLOW = [
  "팀 대표가 참가 신청",
  "팀원이 회원가입 후 팀가입 신청",
  "대회 안내 수신",
  "비치사커 경기 출전",
] as const;

export default function BeachSoccerPage() {
  return (
    <div
      className="bg-white text-[#0D1B2A]"
      style={{ wordBreak: "keep-all", overflowWrap: "break-word" }}
    >
      <section className="relative min-h-[calc(100svh-96px)] overflow-hidden bg-[#06162a] px-5 py-12 text-white sm:px-8 sm:py-16 md:px-10 md:py-20">
        <Image
          src="/promotions/beach-soccer-2026-3div.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-48"
        />
        <div
          className="absolute inset-0"
          aria-hidden
          style={{
            background:
              "linear-gradient(90deg, rgba(6,22,42,0.94) 0%, rgba(6,22,42,0.78) 38%, rgba(6,22,42,0.34) 100%)",
          }}
        />
        <div className="relative mx-auto flex min-h-[calc(100svh-216px)] max-w-[1320px] flex-col justify-end sm:min-h-[calc(100svh-244px)]">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 border border-[#f3d38a]/48 px-3 py-1.5 text-[10px] font-black tracking-[0.18em] text-[#f3d38a] sm:mb-5 sm:tracking-[0.24em]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#f3d38a]" />
              SUMMER PROJECT
            </div>
            <h1 className="text-[38px] font-black leading-[1.06] text-white sm:text-[64px] sm:leading-[1.02] md:text-[84px]">
              전국
              <br />
              비치사커대회
            </h1>
            <div className="mt-5 flex flex-wrap gap-2 sm:mt-6">
              {BEACH_SOCCER_DIVISIONS.map((division) => (
                <span
                  key={division}
                  className="inline-flex items-center rounded-[var(--radius-pill)] border border-[#f3d38a]/55 px-3.5 py-1.5 text-[13px] font-black text-[#f3d38a] sm:text-sm"
                >
                  {division}
                </span>
              ))}
            </div>
            <p className="mt-5 max-w-2xl text-[16px] leading-[1.78] text-white/76 md:text-[19px]">
              {BEACH_SOCCER_EVENT_LOCATION_FULL_LABEL}에서 열리는 여름 비치사커 이벤트입니다.
              대학부·남자부·여자부 세 부문으로 팀을 꾸리고, 전국에서 모인
              참가자들과 바다 위에서 특별한 경기를 만들어보세요.
            </p>
            <div className="mt-7 flex flex-wrap gap-3 sm:mt-8">
              <Link
                href={BEACH_SOCCER_APPLY_PATH}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[#f3d38a] px-5 text-[15px] font-black text-[#071a2f] transition hover:bg-[#ffe3a2] sm:w-auto"
              >
                참가 신청하기
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/tournaments"
                className="inline-flex min-h-12 w-full items-center justify-center rounded-[var(--radius-md)] border border-white/30 px-5 text-[15px] font-bold text-white transition hover:bg-white/10 sm:w-auto"
              >
                대회 전체 보기
              </Link>
              <Link
                href="/beach-soccer/rules"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-white/30 px-5 text-[15px] font-bold text-white transition hover:bg-white/10 sm:w-auto"
              >
                룰북·규정 보기
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#D0D8E8] bg-white px-5 py-9 sm:px-8 sm:py-10 md:px-10">
        <div className="mx-auto grid max-w-[1320px] gap-6 md:grid-cols-[0.88fr_1.12fr] md:items-end">
          <div>
            <p className="fg-label mb-3 text-[11px] text-[#0047AB]">
              EVENT INFO
            </p>
            <h2 className="max-w-2xl text-[27px] font-black leading-[1.18] sm:text-[42px] sm:leading-tight">
              8월 7일 금요일, {BEACH_SOCCER_EVENT_LOCATION_LABEL}에서 만나요.
            </h2>
          </div>
          <p className="max-w-3xl text-[15px] leading-[1.78] text-[#526277] sm:text-[16px]">
            대학부·남자부·여자부 세 부문으로 전국 팀이 모이는 여름 비치사커
            대회입니다. 팀을 만들고, 모래 위에서 뛰는 색다른 경기 경험을
            남겨보세요. 각 부문은 4팀 이상 모일 때 진행됩니다.
          </p>
        </div>

        <div className="mx-auto mt-7 grid max-w-[1320px] grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-8">
          {EVENT_FACTS.map((fact) => {
            const Icon = fact.icon;
            return (
              <div
                key={fact.label}
                className="border border-[#D0D8E8] bg-[#F8FAFF] p-4 sm:p-5"
              >
                <div className="mb-2.5 flex items-center gap-2">
                  <Icon className="h-4 w-4 text-[#0047AB]" />
                  <span className="fg-label text-[10px] text-[#6B7A90]">{fact.label}</span>
                </div>
                <div className="text-[18px] font-black leading-[1.2] sm:text-[20px]">
                  {fact.value}
                </div>
              </div>
            );
          })}
        </div>

        <p className="mx-auto mt-4 max-w-[1320px] border-l-2 border-[#0047AB] bg-[#F8FAFF] px-4 py-3 text-[13px] leading-[1.7] text-[#526277] sm:text-[14px]">
          {BEACH_SOCCER_MIN_TEAMS_NOTE}
        </p>
      </section>

      <section className="px-5 py-12 sm:px-8 sm:py-14 md:px-10 md:py-20">
        <div className="mx-auto grid max-w-[1320px] gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {PROJECT_POINTS.map((point) => {
            const Icon = point.icon;
            return (
              <article
                key={point.title}
                className="border border-[#D0D8E8] bg-[#F8FAFF] p-4 sm:p-5"
              >
                <Icon className="mb-4 h-6 w-6 text-[#0047AB] sm:mb-5" />
                <h3 className="text-[19px] font-black leading-[1.25] sm:text-[20px]">
                  {point.title}
                </h3>
                <p className="mt-3 text-[14px] leading-[1.72] text-[#6B7A90]">
                  {point.body}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="bg-[#071a2f] px-5 py-12 text-white sm:px-8 sm:py-14 md:px-10 md:py-20">
        <div className="mx-auto grid max-w-[1320px] gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
          <div>
            <p className="fg-label mb-3 text-[11px] text-[#f3d38a]">
              PARTICIPANT GUIDE
            </p>
            <h2 className="text-[27px] font-black leading-[1.18] text-white sm:text-[42px] sm:leading-tight">
              참가자는 신청하고, 명단을 내고, 현장에 오면 됩니다.
            </h2>
            <p className="mt-5 text-[15px] leading-[1.78] text-white/70 sm:text-[16px]">
              복잡한 설명보다 필요한 정보만 빠르게 확인할 수 있게 준비합니다.
              팀 대표가 먼저 참가 신청을 하고, 팀원들은 회원가입 후 팀가입을
              신청합니다. 이후 대회 안내를 받고 비치사커 경기에 출전하면 됩니다.
            </p>
          </div>

          <div className="grid gap-3">
            {FLOW.map((item, index) => (
              <div
                key={item}
                className="flex items-center gap-3 border border-white/14 bg-white/[0.06] px-4 py-4 sm:gap-4"
              >
                <span className="fg-mono w-7 shrink-0 text-[12px] text-[#f3d38a] sm:w-8">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-[15px] font-bold leading-[1.45] text-white sm:text-base">
                  {item}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="beach-rules"
        className="border-y border-[#D0D8E8] bg-[#F7FAFF] px-5 py-12 sm:px-8 sm:py-14 md:px-10 md:py-20"
      >
        <div className="mx-auto max-w-[1320px]">
          <div className="max-w-3xl">
            <p className="fg-label mb-3 text-[11px] text-[#0047AB]">
              RULEBOOK
            </p>
            <h2 className="text-[27px] font-black leading-[1.18] sm:text-[42px] sm:leading-tight">
              비치사커 룰북과 대회 규정
            </h2>
            <p className="mt-5 text-[15px] leading-[1.78] text-[#526277] sm:text-[16px]">
              참가자가 현장에서 바로 이해할 수 있도록 경기 운영 기준과
              참가 규정을 한 페이지 안에 정리했습니다. 최종 세부 운영은
              참가팀 확정 후 전달되는 대회 안내를 기준으로 적용합니다.
            </p>
          </div>

          <div className="mt-9 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="border border-[#C7D3E8] bg-white p-5 sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <BookOpen className="h-5 w-5 text-[#0047AB]" />
                <h3 className="text-[21px] font-black leading-tight sm:text-[24px]">
                  경기 룰북
                </h3>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {BEACH_SOCCER_RULEBOOK.map((rule) => (
                  <article key={rule.title} className="border-t border-[#DCE4F2] pt-4">
                    <h4 className="text-[17px] font-black leading-tight text-[#0D1B2A]">
                      {rule.title}
                    </h4>
                    <ul className="mt-3 space-y-2 text-[14px] leading-[1.68] text-[#526277]">
                      {rule.items.map((item) => (
                        <li key={item} className="flex gap-2">
                          <span className="mt-[0.72em] h-1.5 w-1.5 shrink-0 rounded-full bg-[#0047AB]" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </div>

            <div className="border border-[#C7D3E8] bg-white p-5 sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <ListChecks className="h-5 w-5 text-[#0047AB]" />
                <h3 className="text-[21px] font-black leading-tight sm:text-[24px]">
                  참가·운영 규정
                </h3>
              </div>
              <div className="space-y-4">
                {BEACH_SOCCER_REGULATIONS.map((regulation) => (
                  <article key={regulation.title} className="border-t border-[#DCE4F2] pt-4">
                    <h4 className="text-[17px] font-black leading-tight text-[#0D1B2A]">
                      {regulation.title}
                    </h4>
                    <p className="mt-2 text-[14px] leading-[1.72] text-[#526277]">
                      {regulation.body}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-4 border border-[#C7D3E8] bg-white px-4 py-4 text-[14px] leading-[1.72] text-[#526277] sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p>
              <strong className="font-black text-[#0D1B2A]">운영 기준:</strong>{" "}
              경기 시간, 출전 명단, 안전 제재, 기록 정정은 현장 심판과 운영진의
              최종 확인을 기준으로 처리합니다.
            </p>
            <Link
              href="/beach-soccer/rules"
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[#0047AB] px-5 text-[14px] font-black text-white transition hover:-translate-y-0.5"
            >
              전체 룰북·규정 자세히 보기
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="px-5 py-12 sm:px-8 sm:py-14 md:px-10 md:py-20">
        <div className="mx-auto grid max-w-[1320px] gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <div className="relative mx-auto w-full max-w-[460px] overflow-hidden border border-[#D0D8E8] bg-[#071a2f]">
            <Image
              src="/promotions/beach-soccer-2026-3div.png"
              alt="전국 비치사커대회 공식 포스터"
              width={1080}
              height={1350}
              sizes="(max-width: 1024px) 92vw, 460px"
              className="h-auto w-full"
            />
          </div>
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[#D0D8E8] px-4 py-2 text-[13px] font-bold text-[#0047AB]">
              <ShieldCheck className="h-4 w-4" />
              참가 안내
            </div>
            <h2 className="text-[27px] font-black leading-[1.18] sm:text-[42px] sm:leading-tight">
              올여름, 바다 위에서 뛰세요.
            </h2>
            <p className="mt-5 max-w-2xl text-[15px] leading-[1.78] text-[#526277] sm:text-[16px]">
              {BEACH_SOCCER_EVENT_DATE_FULL_LABEL}, {BEACH_SOCCER_EVENT_LOCATION_FULL_LABEL}에서 전국
              비치사커대회가 열립니다. 대학부·남자부·여자부 중 우리 팀에 맞는
              부문으로 참가팀을 만들고, 여름 바다에서 기억에 남을 경기를 남겨보세요.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={BEACH_SOCCER_APPLY_PATH}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[#0047AB] px-5 text-[15px] font-black text-white transition hover:bg-[#003080] sm:w-auto"
              >
                참가 신청하기
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/"
                className="inline-flex min-h-12 w-full items-center justify-center rounded-[var(--radius-md)] border border-[#D0D8E8] px-5 text-[15px] font-bold text-[#0047AB] transition hover:bg-[#EEF3FF] sm:w-auto"
              >
                홈으로 돌아가기
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
