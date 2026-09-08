import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Clock3,
  CloudRain,
  Gauge,
  IdCard,
  Layers,
  ListChecks,
  MapPinned,
  ReceiptText,
  Repeat,
  ShieldAlert,
  ShieldCheck,
  Target,
  Ticket,
  Trophy,
  UserCheck,
  Users,
} from "lucide-react";
import { MixedFutsalEligibilityTable } from "@/components/mixed-futsal-eligibility-table";
import { MixedFutsalCardNews } from "@/components/mixed-futsal-card-news";
import {
  MIXED_FUTSAL_APPLY_PATH,
  MIXED_FUTSAL_ELIGIBILITY_LABEL,
  MIXED_FUTSAL_ELIGIBILITY_NOTE,
  MIXED_FUTSAL_ENTRY_FEE_EARLY_AMOUNT,
  MIXED_FUTSAL_ENTRY_FEE_EARLY_LABEL,
  MIXED_FUTSAL_ENTRY_FEE_LABEL,
  MIXED_FUTSAL_ENTRY_FEE_NOTE,
  MIXED_FUTSAL_ENTRY_FEE_REGULAR_AMOUNT,
  MIXED_FUTSAL_ENTRY_FEE_REGULAR_LABEL,
  MIXED_FUTSAL_EVENT_DATE_FULL_LABEL,
  MIXED_FUTSAL_EVENT_DATE_LABEL,
  MIXED_FUTSAL_EVENT_DATETIME_LABEL,
  MIXED_FUTSAL_EVENT_END_ISO,
  MIXED_FUTSAL_EVENT_LOCATION_FULL_LABEL,
  MIXED_FUTSAL_EVENT_LOCATION_LABEL,
  MIXED_FUTSAL_EVENT_NAME,
  MIXED_FUTSAL_EVENT_PATH,
  MIXED_FUTSAL_EVENT_START_ISO,
  MIXED_FUTSAL_EVENT_TAGLINE,
  MIXED_FUTSAL_EVENT_TIME_LABEL,
  MIXED_FUTSAL_EVENT_VENUE_NOTE,
  MIXED_FUTSAL_FORMAT_SUMMARY_LABEL,
  MIXED_FUTSAL_GENDER_RULE_LABEL,
  MIXED_FUTSAL_GENDER_RULE_NOTE,
  MIXED_FUTSAL_GROUP_LABEL,
  MIXED_FUTSAL_GUARANTEE_LABEL,
  MIXED_FUTSAL_GUARANTEE_NOTE,
  MIXED_FUTSAL_MATCH_FORMAT_LABEL,
  MIXED_FUTSAL_REFUND_LABEL,
  MIXED_FUTSAL_REFUND_NOTE,
  MIXED_FUTSAL_REGULATIONS,
  MIXED_FUTSAL_ROSTER_LABEL,
  MIXED_FUTSAL_RULEBOOK,
  MIXED_FUTSAL_SAFETY_LABEL,
  MIXED_FUTSAL_SAFETY_NOTE,
  MIXED_FUTSAL_SIDE_EVENTS,
  MIXED_FUTSAL_SIDE_EVENT_LABEL,
  MIXED_FUTSAL_SIDE_EVENT_TIMING_LABEL,
  MIXED_FUTSAL_TEAM_COUNT_LABEL,
  MIXED_FUTSAL_WEATHER_LABEL,
  MIXED_FUTSAL_WEATHER_NOTE,
} from "@/lib/mixed-futsal-event";
import { SeoJsonLd } from "@/components/seo-json-ld";
import { SITE_NAME, SITE_URL } from "@/lib/site-config";
import { absoluteUrl, breadcrumbJsonLd, createSeoMetadata, faqPageJsonLd } from "@/lib/seo";

export const metadata: Metadata = createSeoMetadata({
  title: `${MIXED_FUTSAL_EVENT_NAME} — 대회 안내`,
  description: `${MIXED_FUTSAL_EVENT_DATE_FULL_LABEL} ${MIXED_FUTSAL_EVENT_TIME_LABEL}, ${MIXED_FUTSAL_EVENT_LOCATION_FULL_LABEL}에서 열리는 ${MIXED_FUTSAL_EVENT_NAME}. ${MIXED_FUTSAL_TEAM_COUNT_LABEL}(${MIXED_FUTSAL_GROUP_LABEL}) 규모, ${MIXED_FUTSAL_MATCH_FORMAT_LABEL}, ${MIXED_FUTSAL_FORMAT_SUMMARY_LABEL}으로 탈락 없이 ${MIXED_FUTSAL_GUARANTEE_LABEL}. 참가비 ${MIXED_FUTSAL_ENTRY_FEE_LABEL}.`,
  path: MIXED_FUTSAL_EVENT_PATH,
  keywords: [
    "혼성 풋살 대회",
    "혼성풋살대회",
    "제1회 페어그라운드 혼성 풋살 대회",
    "은평 풋살대회",
    "엠무브 은평점 풋살",
    "서울 혼성 풋살 대회",
    "아마추어 풋살 대회 참가 신청",
    "실외 풋살 대회",
  ],
});

const EVENT_FACTS = [
  { icon: CalendarDays, label: "일시", value: MIXED_FUTSAL_EVENT_DATE_LABEL },
  { icon: Clock3, label: "시간", value: MIXED_FUTSAL_EVENT_TIME_LABEL },
  { icon: MapPinned, label: "장소", value: MIXED_FUTSAL_EVENT_LOCATION_LABEL },
  { icon: Layers, label: "규모", value: MIXED_FUTSAL_TEAM_COUNT_LABEL },
  { icon: Users, label: "경기 방식", value: MIXED_FUTSAL_MATCH_FORMAT_LABEL },
  { icon: UserCheck, label: "참가 자격", value: MIXED_FUTSAL_ELIGIBILITY_LABEL },
  { icon: ListChecks, label: "로스터", value: MIXED_FUTSAL_ROSTER_LABEL },
  { icon: Ticket, label: "참가비", value: MIXED_FUTSAL_ENTRY_FEE_LABEL },
] as const;

const PROJECT_POINTS = [
  {
    icon: Trophy,
    title: "탈락 없는 대회",
    body: "조별 6팀이 서로 한 번씩 맞붙는 풀리그입니다. 첫 경기에서 지더라도 남은 경기가 그대로 남아, 하루를 끝까지 함께 뜁니다.",
  },
  {
    icon: Repeat,
    title: "팀당 5경기",
    body: "한 팀이 5경기를 모두 보장받습니다. 멀리 와서 두 경기만 뛰고 돌아가는 일이 없도록 일정을 짰습니다.",
  },
  {
    icon: Users,
    title: "혼성 5인제",
    body: `골키퍼를 포함한 코트 위 5명은 남자 3명 + 여자 2명으로 고정합니다. 성별이 섞인 팀이 기본값이고, 매 경기 여자 선수 2명이 코트 위에 섭니다.`,
  },
  {
    icon: UserCheck,
    title: "비선출 대회",
    body: MIXED_FUTSAL_ELIGIBILITY_NOTE,
  },
  {
    icon: ShieldAlert,
    title: "안전이 먼저",
    body: MIXED_FUTSAL_SAFETY_NOTE,
  },
  {
    icon: IdCard,
    title: "기록이 카드로 남습니다",
    body: "라이브 스코어와 개인 스탯이 그대로 기록되어, 대회가 끝난 뒤에도 선수 카드에서 그날의 경기를 다시 볼 수 있습니다.",
  },
] as const;

const FLOW = [
  "팀 대표가 참가 신청",
  "팀원이 회원가입 후 팀가입 신청",
  "운영진 확인 후 대회 안내 수신",
  "조별 풀리그 5경기 출전",
  "리그 종료 후 그라운드 챌린지 참여",
] as const;

const SIDE_EVENT_ICONS = [Gauge, Target] as const;

const sportsEventData = {
  "@context": "https://schema.org",
  "@type": "SportsEvent",
  name: MIXED_FUTSAL_EVENT_NAME,
  description: `${MIXED_FUTSAL_EVENT_LOCATION_FULL_LABEL}에서 열리는 아마추어 혼성 풋살 대회. ${MIXED_FUTSAL_TEAM_COUNT_LABEL}이 ${MIXED_FUTSAL_GROUP_LABEL}으로 나뉘어 ${MIXED_FUTSAL_FORMAT_SUMMARY_LABEL}을 치르며, 탈락 없이 ${MIXED_FUTSAL_GUARANTEE_LABEL}.`,
  url: absoluteUrl(MIXED_FUTSAL_EVENT_PATH),
  startDate: MIXED_FUTSAL_EVENT_START_ISO,
  endDate: MIXED_FUTSAL_EVENT_END_ISO,
  eventStatus: "https://schema.org/EventScheduled",
  eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
  sport: ["Futsal", "Soccer"],
  organizer: {
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
  },
  location: {
    "@type": "Place",
    name: MIXED_FUTSAL_EVENT_LOCATION_LABEL,
    address: {
      "@type": "PostalAddress",
      addressCountry: "KR",
      addressRegion: "서울특별시",
      addressLocality: "은평구",
      streetAddress: MIXED_FUTSAL_EVENT_LOCATION_LABEL,
    },
  },
  offers: [
    {
      "@type": "Offer",
      name: MIXED_FUTSAL_ENTRY_FEE_EARLY_LABEL,
      price: MIXED_FUTSAL_ENTRY_FEE_EARLY_AMOUNT,
      priceCurrency: "KRW",
      availability: "https://schema.org/InStock",
      url: absoluteUrl(MIXED_FUTSAL_APPLY_PATH),
    },
    {
      "@type": "Offer",
      name: MIXED_FUTSAL_ENTRY_FEE_REGULAR_LABEL,
      price: MIXED_FUTSAL_ENTRY_FEE_REGULAR_AMOUNT,
      priceCurrency: "KRW",
      availability: "https://schema.org/InStock",
      url: absoluteUrl(MIXED_FUTSAL_APPLY_PATH),
    },
  ],
};

export default function MixedFutsalPage() {
  return (
    <>
      <SeoJsonLd
        data={[
          breadcrumbJsonLd([
            { name: "홈", path: "/" },
            { name: "대회", path: "/tournaments" },
            { name: MIXED_FUTSAL_EVENT_NAME, path: MIXED_FUTSAL_EVENT_PATH },
          ]),
          sportsEventData,
          faqPageJsonLd([
            {
              question: `${MIXED_FUTSAL_EVENT_NAME}는 언제, 어디에서 열리나요?`,
              answer: `${MIXED_FUTSAL_EVENT_DATE_FULL_LABEL} ${MIXED_FUTSAL_EVENT_TIME_LABEL}, ${MIXED_FUTSAL_EVENT_LOCATION_FULL_LABEL}에서 열립니다.`,
            },
            {
              question: "비가 오면 어떻게 되나요? 우천 시에도 대회가 진행되나요?",
              answer: MIXED_FUTSAL_WEATHER_NOTE,
            },
            {
              question: "대회가 취소되면 참가비는 어떻게 되나요?",
              answer: MIXED_FUTSAL_REFUND_NOTE,
            },
            {
              question: "팀 구성 조건은 어떻게 되나요?",
              answer: `혼성 5인제로 진행합니다. ${MIXED_FUTSAL_GENDER_RULE_NOTE} 교대 인원을 포함해 ${MIXED_FUTSAL_ROSTER_LABEL}합니다.`,
            },
            {
              question: "참가 자격 조건이 있나요?",
              answer: MIXED_FUTSAL_ELIGIBILITY_NOTE,
            },
            {
              question: "경기는 몇 경기나 할 수 있나요?",
              answer: MIXED_FUTSAL_GUARANTEE_NOTE,
            },
            {
              question: "참가비는 얼마인가요?",
              answer: MIXED_FUTSAL_ENTRY_FEE_NOTE,
            },
          ]),
        ]}
      />
      <div
        className="bg-white text-[#0D1B2A]"
        style={{ wordBreak: "keep-all", overflowWrap: "break-word" }}
      >
        <section className="bg-[#0D1B2A] px-5 py-12 text-white sm:px-8 sm:py-16 md:px-10 md:py-20">
          <div className="mx-auto max-w-4xl">
            <div>
              <p className="fg-label text-[11px] text-[#D6E4FF]">MIXED FUTSAL 2026</p>
              <h1 className="mt-4 text-[36px] font-black leading-[1.08] text-white sm:text-[56px] sm:leading-[1.04] md:text-[68px]">
                제1회 페어그라운드
                <br />
                혼성 풋살 대회
              </h1>
              <p className="mt-5 inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[#D6E4FF]/45 px-4 py-2 text-[14px] font-black text-[#D6E4FF] sm:text-[15px]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#D6E4FF]" aria-hidden />
                {MIXED_FUTSAL_EVENT_TAGLINE}
              </p>

              <dl className="mt-7 grid gap-3 sm:grid-cols-2">
                <div className="border border-white/16 bg-white/[0.06] px-4 py-4">
                  <dt className="fg-label mb-2 flex items-center gap-2 text-[10px] text-[#D6E4FF]">
                    <CalendarDays className="h-4 w-4" aria-hidden />
                    일시
                  </dt>
                  <dd className="text-[17px] font-black leading-[1.3] text-white sm:text-[19px]">
                    {MIXED_FUTSAL_EVENT_DATETIME_LABEL}
                  </dd>
                </div>
                <div className="border border-white/16 bg-white/[0.06] px-4 py-4">
                  <dt className="fg-label mb-2 flex items-center gap-2 text-[10px] text-[#D6E4FF]">
                    <MapPinned className="h-4 w-4" aria-hidden />
                    장소
                  </dt>
                  <dd className="text-[17px] font-black leading-[1.3] text-white sm:text-[19px]">
                    {MIXED_FUTSAL_EVENT_LOCATION_LABEL}
                    <span className="mt-1 block text-[13px] font-bold text-white/70">
                      실외 풋살장 · 2개 구장
                    </span>
                  </dd>
                </div>
              </dl>

              <p className="mt-6 max-w-2xl text-[16px] leading-[1.78] text-white/78 md:text-[18px]">
                남녀가 한 팀으로 함께 뛰는 아마추어 혼성 풋살 대회입니다. 12팀이
                조별 풀리그를 치르며, 탈락 없이 모든 팀이 5경기를 다 뜁니다.
                하루 동안 뛴 기록은 그대로 선수 카드에 남습니다.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={MIXED_FUTSAL_APPLY_PATH}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-white px-5 text-[15px] font-black text-[#0047AB] transition hover:bg-[#EEF3FF] sm:w-auto"
                >
                  참가 신청하기
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  href="#mixed-futsal-rules"
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-white/32 px-5 text-[15px] font-bold text-white transition hover:bg-white/10 sm:w-auto"
                >
                  룰북·규정 보기
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  href="/tournaments"
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-[var(--radius-md)] border border-white/32 px-5 text-[15px] font-bold text-white transition hover:bg-white/10 sm:w-auto"
                >
                  대회 전체 보기
                </Link>
              </div>
            </div>

          </div>
        </section>

        <MixedFutsalCardNews />

        <section className="border-b border-[#D0D8E8] bg-white px-5 py-10 sm:px-8 sm:py-12 md:px-10">
          <div className="mx-auto grid max-w-[1320px] gap-6 md:grid-cols-[0.88fr_1.12fr] md:items-end">
            <div>
              <p className="fg-label mb-3 text-[11px] text-[#0047AB]">EVENT INFO</p>
              <h2 className="max-w-2xl text-[27px] font-black leading-[1.18] sm:text-[42px] sm:leading-tight">
                10월 3일 토요일,
                <br className="hidden sm:block" /> {MIXED_FUTSAL_EVENT_LOCATION_LABEL}에서 만나요.
              </h2>
            </div>
            <p className="max-w-3xl text-[15px] leading-[1.78] text-[#526277] sm:text-[16px]">
              {MIXED_FUTSAL_EVENT_DATE_FULL_LABEL} {MIXED_FUTSAL_EVENT_TIME_LABEL}에{" "}
              {MIXED_FUTSAL_EVENT_LOCATION_FULL_LABEL}에서 열립니다.{" "}
              {MIXED_FUTSAL_EVENT_VENUE_NOTE} 12팀이 {MIXED_FUTSAL_GROUP_LABEL}으로 나뉘어
              하루 동안 30경기를 치릅니다.
            </p>
          </div>

          <dl className="mx-auto mt-7 grid max-w-[1320px] grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-8">
            {EVENT_FACTS.map((fact) => {
              const Icon = fact.icon;
              return (
                <div
                  key={fact.label}
                  className="border border-[#D0D8E8] bg-[#F5F7FF] p-4 sm:p-5"
                >
                  <dt className="mb-2.5 flex items-center gap-2">
                    <Icon className="h-4 w-4 text-[#0047AB]" aria-hidden />
                    <span className="fg-label text-[10px] text-[#526277]">{fact.label}</span>
                  </dt>
                  <dd className="text-[17px] font-black leading-[1.24] sm:text-[19px]">
                    {fact.value}
                  </dd>
                </div>
              );
            })}
          </dl>

          <div className="mx-auto mt-4 grid max-w-[1320px] gap-3">
            <p className="border-l-2 border-[#0047AB] bg-[#EEF3FF] px-4 py-3 text-[13px] leading-[1.7] text-[#526277] sm:text-[14px]">
              {MIXED_FUTSAL_GUARANTEE_NOTE}
            </p>
            <p className="flex gap-3 border-l-2 border-[#0047AB] bg-[#EEF3FF] px-4 py-3 text-[13px] leading-[1.7] text-[#526277] sm:text-[14px]">
              <CloudRain className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#0047AB]" aria-hidden />
              <span>
                <strong className="font-black text-[#0D1B2A]">{MIXED_FUTSAL_WEATHER_LABEL}.</strong>{" "}
                {MIXED_FUTSAL_WEATHER_NOTE}
              </span>
            </p>
            <p className="flex gap-3 border-l-2 border-[#0047AB] bg-[#EEF3FF] px-4 py-3 text-[13px] leading-[1.7] text-[#526277] sm:text-[14px]">
              <ReceiptText className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#0047AB]" aria-hidden />
              <span>
                <strong className="font-black text-[#0D1B2A]">{MIXED_FUTSAL_REFUND_LABEL}.</strong>{" "}
                {MIXED_FUTSAL_REFUND_NOTE}
              </span>
            </p>
          </div>
        </section>

        <section className="px-5 py-12 sm:px-8 sm:py-14 md:px-10 md:py-20">
          <div className="mx-auto max-w-[1320px]">
            <div className="max-w-3xl">
              <p className="fg-label mb-3 text-[11px] text-[#0047AB]">WHY THIS GROUND</p>
              <h2 className="text-[27px] font-black leading-[1.18] sm:text-[42px] sm:leading-tight">
                {MIXED_FUTSAL_EVENT_TAGLINE}
              </h2>
              <p className="mt-5 text-[15px] leading-[1.78] text-[#526277] sm:text-[16px]">
                이기는 팀만 남는 대회가 아니라, 참가한 12팀 모두가 하루를 끝까지
                뛰는 대회를 만들었습니다. 실력과 경력이 달라도 같은 코트에서
                함께 뛸 수 있도록 방식과 규정을 설계했습니다.
              </p>
            </div>

            <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {PROJECT_POINTS.map((point) => {
                const Icon = point.icon;
                return (
                  <article
                    key={point.title}
                    className="border border-[#D0D8E8] bg-[#F5F7FF] p-5 sm:p-6"
                  >
                    <Icon className="mb-4 h-6 w-6 text-[#0047AB]" aria-hidden />
                    <h3 className="text-[19px] font-black leading-[1.25] sm:text-[20px]">
                      {point.title}
                    </h3>
                    <p className="mt-3 text-[14px] leading-[1.72] text-[#526277]">
                      {point.body}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-[#0D1B2A] px-5 py-12 text-white sm:px-8 sm:py-14 md:px-10 md:py-20">
          <div className="mx-auto grid max-w-[1320px] gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
            <div>
              <p className="fg-label mb-3 text-[11px] text-[#D6E4FF]">TOURNAMENT FORMAT</p>
              <h2 className="text-[27px] font-black leading-[1.18] text-white sm:text-[42px] sm:leading-tight">
                탈락도 토너먼트도 없이,
                <br />모든 팀이 5경기를 뜁니다.
              </h2>
              <p className="mt-5 text-[15px] leading-[1.78] text-white/74 sm:text-[16px]">
                12팀을 {MIXED_FUTSAL_GROUP_LABEL}으로 나눠 조별 풀리그를 진행합니다.
                같은 조 6팀이 서로 한 번씩 맞붙어 팀당 5경기를 치르며, 별도의
                순위결정 토너먼트 없이 리그 성적으로 순위를 가립니다.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="border border-white/16 bg-white/[0.06] px-4 py-4">
                  <p className="fg-label mb-2 text-[10px] text-[#D6E4FF]">조 편성</p>
                  <p className="text-[17px] font-black text-white">{MIXED_FUTSAL_GROUP_LABEL}</p>
                </div>
                <div className="border border-white/16 bg-white/[0.06] px-4 py-4">
                  <p className="fg-label mb-2 text-[10px] text-[#D6E4FF]">보장 경기</p>
                  <p className="text-[17px] font-black text-white">
                    {MIXED_FUTSAL_GUARANTEE_LABEL}
                  </p>
                </div>
              </div>
            </div>

            <ol className="grid gap-3">
              {FLOW.map((item, index) => (
                <li
                  key={item}
                  className="flex items-center gap-3 border border-white/14 bg-white/[0.06] px-4 py-4 sm:gap-4"
                >
                  <span className="fg-mono w-7 shrink-0 text-[12px] text-[#D6E4FF] sm:w-8">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[15px] font-bold leading-[1.45] text-white sm:text-base">
                    {item}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="px-5 py-12 sm:px-8 sm:py-14 md:px-10 md:py-20">
          <div className="mx-auto max-w-4xl">
            <div>
              <p className="fg-label mb-3 text-[11px] text-[#0047AB]">TEAM &amp; ELIGIBILITY</p>
              <h2 className="text-[27px] font-black leading-[1.18] sm:text-[42px] sm:leading-tight">
                남녀가 한 팀으로,
                <br />
                비선출끼리 뜁니다.
              </h2>
              <p className="mt-5 max-w-2xl text-[15px] leading-[1.78] text-[#526277] sm:text-[16px]">
                {MIXED_FUTSAL_GENDER_RULE_NOTE} 교대 인원을 고려해{" "}
                {MIXED_FUTSAL_ROSTER_LABEL}합니다.
              </p>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <div className="border border-[#D0D8E8] bg-[#F5F7FF] p-4 sm:p-5">
                  <div className="mb-2.5 flex items-center gap-2">
                    <Users className="h-4 w-4 text-[#0047AB]" aria-hidden />
                    <span className="fg-label text-[10px] text-[#526277]">코트 위 구성</span>
                  </div>
                  <p className="text-[17px] font-black leading-[1.3] sm:text-[19px]">
                    {MIXED_FUTSAL_GENDER_RULE_LABEL}
                  </p>
                </div>
                <div className="border border-[#D0D8E8] bg-[#F5F7FF] p-4 sm:p-5">
                  <div className="mb-2.5 flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-[#0047AB]" aria-hidden />
                    <span className="fg-label text-[10px] text-[#526277]">로스터</span>
                  </div>
                  <p className="text-[17px] font-black leading-[1.3] sm:text-[19px]">
                    {MIXED_FUTSAL_ROSTER_LABEL}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <p className="flex gap-3 border border-[#D0D8E8] bg-white px-4 py-4 text-[14px] leading-[1.72] text-[#526277]">
                  <UserCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#0047AB]" aria-hidden />
                  <span>{MIXED_FUTSAL_ELIGIBILITY_NOTE}</span>
                </p>
                <MixedFutsalEligibilityTable />
                <p className="flex gap-3 border border-[#D0D8E8] bg-white px-4 py-4 text-[14px] leading-[1.72] text-[#526277]">
                  <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[#0047AB]" aria-hidden />
                  <span>
                    <strong className="font-black text-[#0D1B2A]">{MIXED_FUTSAL_SAFETY_LABEL}.</strong>{" "}
                    {MIXED_FUTSAL_SAFETY_NOTE}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-[#D0D8E8] bg-[#EEF3FF] px-5 py-12 sm:px-8 sm:py-14 md:px-10 md:py-20">
          <div className="mx-auto max-w-4xl">
            <div>
              <p className="fg-label mb-3 text-[11px] text-[#0047AB]">GROUND CHALLENGE</p>
              <h2 className="text-[27px] font-black leading-[1.18] sm:text-[42px] sm:leading-tight">
                리그가 끝나면
                <br />
                챌린지가 시작됩니다.
              </h2>
              <p className="mt-5 max-w-2xl text-[15px] leading-[1.78] text-[#526277] sm:text-[16px]">
                {MIXED_FUTSAL_SIDE_EVENT_LABEL}는 {MIXED_FUTSAL_SIDE_EVENT_TIMING_LABEL}에
                진행하는 부대 이벤트입니다. 조별 리그를 모두 마친 뒤, 참가팀
                모두가 함께 기록을 남길 수 있습니다.
              </p>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {MIXED_FUTSAL_SIDE_EVENTS.map((sideEvent, index) => {
                  const Icon = SIDE_EVENT_ICONS[index] ?? Target;
                  return (
                    <article
                      key={sideEvent.title}
                      className="border border-[#D0D8E8] bg-white p-5 sm:p-6"
                    >
                      <Icon className="mb-4 h-6 w-6 text-[#0047AB]" aria-hidden />
                      <h3 className="text-[18px] font-black leading-[1.25] sm:text-[19px]">
                        {sideEvent.title}
                      </h3>
                      <p className="mt-3 text-[14px] leading-[1.72] text-[#526277]">
                        {sideEvent.body}
                      </p>
                    </article>
                  );
                })}
              </div>
            </div>

          </div>
        </section>

        <section
          id="mixed-futsal-rules"
          className="scroll-mt-24 bg-white px-5 py-12 sm:px-8 sm:py-14 md:px-10 md:py-20"
        >
          <div className="mx-auto max-w-[1320px]">
            <div className="max-w-3xl">
              <p className="fg-label mb-3 text-[11px] text-[#0047AB]">RULEBOOK</p>
              <h2 className="text-[27px] font-black leading-[1.18] sm:text-[42px] sm:leading-tight">
                혼성 풋살 룰북과 대회 규정
              </h2>
              <p className="mt-5 text-[15px] leading-[1.78] text-[#526277] sm:text-[16px]">
                참가자가 현장에서 바로 이해할 수 있도록 경기 운영 기준과 참가
                규정을 한 페이지에 정리했습니다. 경기 시간·교체·대진 순번 등
                세부 운영은 참가팀 확정 후 전달되는 대회 안내를 기준으로
                적용합니다.
              </p>
            </div>

            <div className="mt-9 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="border border-[#D0D8E8] bg-[#F5F7FF] p-5 sm:p-6">
                <div className="mb-5 flex items-center gap-3">
                  <BookOpen className="h-5 w-5 text-[#0047AB]" aria-hidden />
                  <h3 className="text-[21px] font-black leading-tight sm:text-[24px]">경기 룰북</h3>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {MIXED_FUTSAL_RULEBOOK.map((rule) => (
                    <article key={rule.title} className="border-t border-[#D0D8E8] pt-4">
                      <h4 className="text-[17px] font-black leading-tight text-[#0D1B2A]">
                        {rule.title}
                      </h4>
                      <ul className="mt-3 space-y-2 text-[14px] leading-[1.68] text-[#526277]">
                        {rule.items.map((item) => (
                          <li key={item} className="flex gap-2">
                            <span
                              className="mt-[0.72em] h-1.5 w-1.5 shrink-0 rounded-full bg-[#0047AB]"
                              aria-hidden
                            />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              </div>

              <div className="border border-[#D0D8E8] bg-[#F5F7FF] p-5 sm:p-6">
                <div className="mb-5 flex items-center gap-3">
                  <ListChecks className="h-5 w-5 text-[#0047AB]" aria-hidden />
                  <h3 className="text-[21px] font-black leading-tight sm:text-[24px]">
                    참가·운영 규정
                  </h3>
                </div>
                <div className="space-y-4">
                  {MIXED_FUTSAL_REGULATIONS.map((regulation) => (
                    <article key={regulation.title} className="border-t border-[#D0D8E8] pt-4">
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

            <div className="mt-5 flex flex-col gap-4 border border-[#D0D8E8] bg-white px-4 py-4 text-[14px] leading-[1.72] text-[#526277] sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p>
                <strong className="font-black text-[#0D1B2A]">운영 기준:</strong> 경기 시간,
                출전 명단, 안전 제재, 기록 정정은 현장 심판과 운영진의 최종 확인을
                기준으로 처리합니다.
              </p>
              <Link
                href={MIXED_FUTSAL_APPLY_PATH}
                className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[#0047AB] px-5 text-[14px] font-black text-white transition hover:bg-[#003080]"
              >
                참가 신청하기
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        </section>

        <section className="border-t border-[#D0D8E8] bg-[#F5F7FF] px-5 py-12 sm:px-8 sm:py-14 md:px-10 md:py-20">
          <div className="mx-auto max-w-4xl">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[#D0D8E8] bg-white px-4 py-2 text-[13px] font-bold text-[#0047AB]">
                <ShieldCheck className="h-4 w-4" aria-hidden />
                참가 안내
              </div>
              <h2 className="text-[27px] font-black leading-[1.18] sm:text-[42px] sm:leading-tight">
                올가을, 함께 만드는 그라운드로 오세요.
              </h2>

              <dl className="mt-7 grid gap-3 border border-[#D0D8E8] bg-white p-5 sm:p-6">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <dt className="fg-label w-20 text-[10px] text-[#526277]">일시</dt>
                  <dd className="text-[16px] font-black text-[#0D1B2A] sm:text-[17px]">
                    {MIXED_FUTSAL_EVENT_DATE_FULL_LABEL} {MIXED_FUTSAL_EVENT_TIME_LABEL}
                  </dd>
                </div>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <dt className="fg-label w-20 text-[10px] text-[#526277]">장소</dt>
                  <dd className="text-[16px] font-black text-[#0D1B2A] sm:text-[17px]">
                    {MIXED_FUTSAL_EVENT_LOCATION_FULL_LABEL}
                  </dd>
                </div>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <dt className="fg-label w-20 text-[10px] text-[#526277]">참가비</dt>
                  <dd className="text-[16px] font-black text-[#0D1B2A] sm:text-[17px]">
                    {MIXED_FUTSAL_ENTRY_FEE_EARLY_LABEL} · {MIXED_FUTSAL_ENTRY_FEE_REGULAR_LABEL}
                  </dd>
                </div>
              </dl>

              <p className="mt-4 border-l-2 border-[#0047AB] bg-white px-4 py-3 text-[13px] leading-[1.7] text-[#526277] sm:text-[14px]">
                공식 일정과 장소는 이 페이지에 적힌 내용을 기준으로 합니다.
                외부 안내물에 표기된 일부 문구와 다를 수 있으니, 위 안내를
                확인해주세요.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={MIXED_FUTSAL_APPLY_PATH}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[#0047AB] px-5 text-[15px] font-black text-white transition hover:bg-[#003080] sm:w-auto"
                >
                  참가 신청하기
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  href="/"
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-[var(--radius-md)] border border-[#D0D8E8] bg-white px-5 text-[15px] font-bold text-[#0047AB] transition hover:bg-[#EEF3FF] sm:w-auto"
                >
                  홈으로 돌아가기
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
