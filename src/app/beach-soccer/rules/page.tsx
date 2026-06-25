import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Layers,
  ListChecks,
  MapPinned,
  Medal,
  Ticket,
  Trophy,
  Users,
} from "lucide-react";
import {
  BEACH_SOCCER_APPLY_PATH,
  BEACH_SOCCER_AWARD_SHORT_LABEL,
  BEACH_SOCCER_AWARD_BENEFIT,
  BEACH_SOCCER_DIVISIONS_LABEL,
  BEACH_SOCCER_ENTRY_FEE_LABEL,
  BEACH_SOCCER_EVENT_DATE_LABEL,
  BEACH_SOCCER_EVENT_LOCATION_LABEL,
  BEACH_SOCCER_MATCH_FORMAT_LABEL,
  BEACH_SOCCER_PRIZE_LABEL,
  BEACH_SOCCER_REGULATIONS,
  BEACH_SOCCER_RULEBOOK,
  BEACH_SOCCER_TEAM_LIMIT_LABEL,
} from "@/lib/beach-soccer-event";
import { SITE_URL } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "비치사커 룰북·규정 — 전국 비치사커대회",
  description:
    "전국 비치사커대회 공식 룰북. 대학부·남자부·여자부 세 부문, 경기 방식(6인제), 경기 시간(예선 12분·4강부터 15분), 공·경기장 규격, 킥인·5초 룰, 반칙·프리킥, 경고·퇴장, 복장·안전 등 비치사커 규정을 상세히 안내합니다.",
  alternates: { canonical: `${SITE_URL}/beach-soccer/rules` },
};

const OVERVIEW = [
  { icon: CalendarDays, label: "일정", value: BEACH_SOCCER_EVENT_DATE_LABEL },
  { icon: MapPinned, label: "장소", value: BEACH_SOCCER_EVENT_LOCATION_LABEL },
  { icon: Layers, label: "부문", value: BEACH_SOCCER_DIVISIONS_LABEL },
  { icon: Users, label: "경기 방식", value: BEACH_SOCCER_MATCH_FORMAT_LABEL },
  { icon: Trophy, label: "총상금", value: BEACH_SOCCER_PRIZE_LABEL },
  { icon: Ticket, label: "참가비", value: BEACH_SOCCER_ENTRY_FEE_LABEL },
  { icon: ListChecks, label: "팀 인원", value: BEACH_SOCCER_TEAM_LIMIT_LABEL },
  { icon: Medal, label: "입상 혜택", value: BEACH_SOCCER_AWARD_SHORT_LABEL },
] as const;

export default function BeachSoccerRulesPage() {
  return (
    <div
      className="bg-white text-[#0D1B2A]"
      style={{ wordBreak: "keep-all", overflowWrap: "break-word" }}
    >
      {/* Header */}
      <section className="bg-[#06162a] px-5 py-12 text-white sm:px-8 sm:py-14 md:px-10 md:py-16">
        <div className="mx-auto max-w-[1100px]">
          <Link
            href="/beach-soccer"
            className="inline-flex items-center gap-2 text-[13px] font-bold text-white/70 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            비치사커대회 소개로 돌아가기
          </Link>
          <p className="fg-label mt-6 text-[11px] text-[#f3d38a]">RULEBOOK &amp; REGULATIONS</p>
          <h1 className="mt-3 text-[32px] font-black leading-[1.1] sm:text-[48px]">
            비치사커 룰북 · 규정
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-[1.78] text-white/72 sm:text-[16px]">
            전국 비치사커대회의 경기 운영 기준과 참가 규정을
            한 페이지에 정리했습니다. 대학부·남자부·여자부 세 부문으로 진행되며,
            최종 세부 운영은 참가팀 확정 후 전달되는 대회 안내를 기준으로 적용합니다.
          </p>
        </div>
      </section>

      {/* 대회 개요 */}
      <section className="border-b border-[#D0D8E8] px-5 py-10 sm:px-8 md:px-10 md:py-12">
        <div className="mx-auto max-w-[1100px]">
          <h2 className="text-[20px] font-black sm:text-[24px]">대회 개요</h2>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-8">
            {OVERVIEW.map((fact) => {
              const Icon = fact.icon;
              return (
                <div
                  key={fact.label}
                  className="border border-[#D0D8E8] bg-[#F8FAFF] p-4"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <Icon className="h-4 w-4 text-[#0047AB]" />
                    <span className="fg-label text-[10px] text-[#6B7A90]">{fact.label}</span>
                  </div>
                  <div className="text-[16px] font-black leading-[1.2] sm:text-[18px]">
                    {fact.value}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 비치사커 소개 */}
      <section className="border-b border-[#D0D8E8] bg-[#F7FAFF] px-5 py-10 sm:px-8 md:px-10 md:py-14">
        <div className="mx-auto max-w-[1100px]">
          <p className="fg-label mb-3 text-[11px] text-[#0047AB]">ABOUT BEACH SOCCER</p>
          <h2 className="text-[22px] font-black leading-[1.2] sm:text-[30px]">
            비치사커는 이런 경기예요
          </h2>
          <div className="mt-5 grid gap-4 text-[15px] leading-[1.82] text-[#3C4A5C] md:grid-cols-2">
            <p>
              비치사커는 축구를 기반으로 하되 모래 위에서 진행되어 여러 특수성을
              갖습니다. 좁은 코트에서 한 팀 6명이 빠른 템포로 맞붙고, 아웃된 공은
              스로인 대신 <strong className="text-[#0D1B2A]">킥인</strong>으로 재개합니다.
              또한 공격팀은 페널티 구역 안에서 <strong className="text-[#0D1B2A]">5초 이상</strong>{" "}
              공을 소유할 수 없어, 경기가 끊김 없이 박진감 있게 흐릅니다.
            </p>
            <p>
              그라운드가 모래라 선수들은 <strong className="text-[#0D1B2A]">맨발(또는 모래양말)</strong>로
              뛰며, 땅볼 드리블·패스의 효율이 낮은 대신 롱킥을 통한 공중볼 전술과
              바이시클 킥 같은 아크로바틱한 시도가 자주 나옵니다. 동점 시에는 3분
              연장 후 서든데스 승부차기로 승부를 가립니다.
            </p>
          </div>
        </div>
      </section>

      {/* 경기 룰북 (상세) */}
      <section className="px-5 py-12 sm:px-8 md:px-10 md:py-16">
        <div className="mx-auto max-w-[1100px]">
          <div className="mb-7 flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-[#0047AB]" />
            <h2 className="text-[24px] font-black sm:text-[30px]">경기 룰북</h2>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {BEACH_SOCCER_RULEBOOK.map((rule, index) => (
              <article
                key={rule.title}
                className="border border-[#C7D3E8] bg-white p-5 sm:p-6"
              >
                <div className="flex items-baseline gap-3">
                  <span className="fg-mono text-[14px] text-[#0047AB]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="text-[19px] font-black leading-tight sm:text-[21px]">
                    {rule.title}
                  </h3>
                </div>
                <ul className="mt-4 space-y-3 text-[15px] leading-[1.72] text-[#445064]">
                  {rule.items.map((item) => (
                    <li key={item} className="flex gap-2.5">
                      <span className="mt-[0.66em] h-1.5 w-1.5 shrink-0 rounded-full bg-[#0047AB]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 참가·운영 규정 */}
      <section className="border-t border-[#D0D8E8] bg-[#071a2f] px-5 py-12 text-white sm:px-8 md:px-10 md:py-16">
        <div className="mx-auto max-w-[1100px]">
          <div className="mb-7 flex items-center gap-3">
            <ListChecks className="h-6 w-6 text-[#f3d38a]" />
            <h2 className="text-[24px] font-black sm:text-[30px]">참가 · 운영 규정</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {BEACH_SOCCER_REGULATIONS.map((reg) => (
              <article
                key={reg.title}
                className="border border-white/14 bg-white/[0.05] p-5 sm:p-6"
              >
                <h3 className="text-[18px] font-black leading-tight text-white sm:text-[20px]">
                  {reg.title}
                </h3>
                <p className="mt-3 text-[15px] leading-[1.78] text-white/74">
                  {reg.body}
                </p>
              </article>
            ))}
          </div>

          <p className="mt-7 border border-white/14 bg-white/[0.05] px-5 py-4 text-[14px] leading-[1.72] text-white/72">
            <strong className="font-black text-white">운영 기준:</strong>{" "}
            경기 시간, 출전 명단, 안전 제재, 기록 정정은 현장 심판과 운영진의
            최종 확인을 기준으로 처리합니다. 규정은 운영 필요에 따라 사전 공지 후
            조정될 수 있습니다.
          </p>
          <p className="mt-3 border border-[#f3d38a]/30 bg-[#f3d38a]/10 px-5 py-4 text-[14px] font-bold leading-[1.72] text-[#f3d38a]">
            {BEACH_SOCCER_AWARD_BENEFIT}
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 py-12 sm:px-8 md:px-10 md:py-16">
        <div className="mx-auto flex max-w-[1100px] flex-col items-center gap-4 text-center">
          <h2 className="text-[22px] font-black sm:text-[28px]">
            규정을 확인했다면, 이제 팀을 꾸릴 차례예요.
          </h2>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href={BEACH_SOCCER_APPLY_PATH}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[#f3d38a] px-6 text-[15px] font-black text-[#071a2f] transition hover:bg-[#ffe3a2]"
            >
              참가 신청하기
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/beach-soccer"
              className="inline-flex min-h-12 items-center justify-center rounded-[var(--radius-md)] border border-[#C7D3E8] px-6 text-[15px] font-bold text-[#0047AB] transition hover:bg-[#F7FAFF]"
            >
              대회 소개로 돌아가기
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
