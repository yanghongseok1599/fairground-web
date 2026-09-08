"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Layers,
  ListChecks,
  LockKeyhole,
  MapPinned,
  ShieldAlert,
  BookOpen,
  ShieldCheck,
  Ticket,
  UserCheck,
  Users,
} from "lucide-react";
import { MixedFutsalEligibilityTable } from "@/components/mixed-futsal-eligibility-table";
import { PushEnableCard } from "@/components/push-enable-card";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useSubmission } from "@/hooks/useSubmission";
import { registrationError } from "@/lib/registration/reliability";
import { useAuth } from "@/hooks/useAuth";
import { useDataStore } from "@/stores/dataStore";
import {
  MIXED_FUTSAL_ELIGIBILITY_LABEL,
  MIXED_FUTSAL_ELIGIBILITY_NOTE,
  MIXED_FUTSAL_ENTRY_FEE_EARLY_LABEL,
  MIXED_FUTSAL_ENTRY_FEE_LABEL,
  MIXED_FUTSAL_ENTRY_FEE_NOTE,
  MIXED_FUTSAL_ENTRY_FEE_REGULAR_LABEL,
  MIXED_FUTSAL_EVENT_DATE_FULL_LABEL,
  MIXED_FUTSAL_EVENT_DATE_LABEL,
  MIXED_FUTSAL_EVENT_LOCATION_FULL_LABEL,
  MIXED_FUTSAL_EVENT_LOCATION_LABEL,
  MIXED_FUTSAL_EVENT_NAME,
  MIXED_FUTSAL_EVENT_PATH,
  MIXED_FUTSAL_EVENT_TIME_LABEL,
  MIXED_FUTSAL_GENDER_RULE_LABEL,
  MIXED_FUTSAL_GENDER_RULE_NOTE,
  MIXED_FUTSAL_GROUP_LABEL,
  MIXED_FUTSAL_GUARANTEE_LABEL,
  MIXED_FUTSAL_MATCH_FORMAT_LABEL,
  MIXED_FUTSAL_REFUND_NOTE,
  MIXED_FUTSAL_ROSTER_LABEL,
  MIXED_FUTSAL_SAFETY_LABEL,
  MIXED_FUTSAL_SAFETY_NOTE,
  MIXED_FUTSAL_TEAM_COUNT_LABEL,
  MIXED_FUTSAL_WEATHER_NOTE,
} from "@/lib/mixed-futsal-event";

const DEFAULT_SEASON_STATS = {
  points: 0,
  rank: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  goalDifference: 0,
  gamesPlayed: 0,
};

const GUIDE_ITEMS = [
  { icon: CalendarDays, label: "일시", value: MIXED_FUTSAL_EVENT_DATE_LABEL },
  { icon: Clock3, label: "시간", value: MIXED_FUTSAL_EVENT_TIME_LABEL },
  { icon: MapPinned, label: "장소", value: MIXED_FUTSAL_EVENT_LOCATION_LABEL },
  { icon: Layers, label: "규모", value: MIXED_FUTSAL_TEAM_COUNT_LABEL },
  { icon: Users, label: "경기 방식", value: MIXED_FUTSAL_MATCH_FORMAT_LABEL },
  { icon: UserCheck, label: "참가 자격", value: MIXED_FUTSAL_ELIGIBILITY_LABEL },
  { icon: ListChecks, label: "로스터", value: MIXED_FUTSAL_ROSTER_LABEL },
  { icon: Ticket, label: "참가비", value: MIXED_FUTSAL_ENTRY_FEE_LABEL },
] as const;

export function MixedFutsalApplyClient() {
  const router = useRouter();
  const { user, player, initialized, updatePlayer } = useAuth();
  const createTeam = useDataStore((state) => state.createTeam);

  const [teamName, setTeamName] = useState("");
  const [captainName, setCaptainName] = useState("");
  const [captainPhone, setCaptainPhone] = useState("");
  const [mixConfirmed, setMixConfirmed] = useState(false);
  const [portraitConsent, setPortraitConsent] = useState(false);
  const submission = useSubmission();
  const { submitting } = submission;
  const [error, setError] = useState("");
  const [createdTeamId, setCreatedTeamId] = useState("");

  useEffect(() => {
    if (!player) return;
    setCaptainName((current) => current || player.name || "");
    setCaptainPhone((current) => current || player.phone || "");
  }, [player]);

  const draft = useFormDraft(user && !createdTeamId ? `mixed-team:${user.uid}` : null,
    { teamName, captainName, captainPhone, mixConfirmed, portraitConsent }, (d) => {
      setTeamName(d.teamName); setCaptainName(d.captainName); setCaptainPhone(d.captainPhone);
      setMixConfirmed(d.mixConfirmed); setPortraitConsent(d.portraitConsent);
    });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!user || !player) {
      setError("로그인 후 선수카드를 먼저 등록해야 참가 신청을 제출할 수 있습니다.");
      return;
    }

    if (player.teamId) {
      setError("이미 소속 팀이 있습니다. 기존 팀 정보는 마이페이지의 팀 관리에서 확인해주세요.");
      return;
    }

    const trimmedTeamName = teamName.trim();
    const trimmedCaptainName = captainName.trim();
    const trimmedCaptainPhone = captainPhone.trim();

    if (!trimmedTeamName || !trimmedCaptainName || !trimmedCaptainPhone) {
      setError("팀명, 대표자명, 대표 연락처를 모두 입력해주세요.");
      return;
    }

    if (!mixConfirmed) {
      setError(`혼성 구성 요건(${MIXED_FUTSAL_GENDER_RULE_LABEL})을 확인하고 체크해주세요.`);
      return;
    }

    if (!portraitConsent) {
      setError("현장 촬영물의 홍보 활용 동의에 체크해야 참가 신청을 제출할 수 있습니다.");
      return;
    }

    if (!draft.ready || !submission.begin()) return;
    try {
      // Save contact corrections first. Team creation below commits membership
      // atomically, so no fallible follow-up can mislabel a created team as failed.
      await updatePlayer({ name: trimmedCaptainName, phone: trimmedCaptainPhone });
      const createdId = await createTeam({
        name: trimmedTeamName,
        logo: "",
        isApproved: false,
        captainId: player.id,
        memberCount: 1,
        seasonStats: DEFAULT_SEASON_STATS,
        createdAt: Date.now(),
        // 한 줄 소개(introSubtitle)·팀 소개(description)는 팀이 직접 쓰는 자리다.
        // 예전에는 신청 내용을 여기에 덤프해서, 팀 정보 편집 화면을 열면 대회
        // 안내문이 이미 채워져 있었다. 신청 정보는 아래 applicationNote 로
        // 운영진에게 전달하고, 이 두 필드는 빈 값으로 만든다.
        description: "",
        introSubtitle: "",
        teamType: "community",
        leagueTier: "bronze",
        participationStreak: 0,
        // 체크박스는 위 검증을 통과해야만 여기 도달하므로, 제출 시각을 그대로
        // 동의 시각으로 남긴다. 분쟁 시 "언제 동의했는가"의 근거가 된다.
        portraitConsentAt: Date.now(),
      });

      draft.clear();
      setCreatedTeamId(createdId);
      try { localStorage.setItem(`fg_registered_team_id:${user.uid}`, createdId); } catch { /* DB saved. */ }
    } catch (err) {
      setError(registrationError(err, "참가 신청을 완료하지 못했습니다. 입력은 유지됩니다."));
    } finally {
      submission.end();
    }
  };

  return (
    <div
      className="min-h-screen bg-white text-[#0D1B2A]"
      style={{ wordBreak: "keep-all", overflowWrap: "break-word" }}
    >
      <section className="border-b border-[#D0D8E8] bg-[#0D1B2A] px-5 py-10 text-white sm:px-8 md:px-10 md:py-14">
        <div className="mx-auto max-w-[1120px]">
          <div>
            <Link
              href={MIXED_FUTSAL_EVENT_PATH}
              className="inline-flex min-h-11 items-center gap-2 text-[13px] font-bold text-white/72 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              혼성 풋살 대회 소개로 돌아가기
            </Link>
            <p className="fg-label mt-5 text-[11px] text-[#D6E4FF]">JOIN THE GROUND</p>
            <h1 className="mt-3 text-[34px] font-black leading-[1.08] text-white sm:text-[52px]">
              참가 신청
            </h1>
            <p className="mt-4 max-w-2xl text-[15px] leading-[1.78] text-white/74 sm:text-[16px]">
              {MIXED_FUTSAL_EVENT_NAME}는 {MIXED_FUTSAL_EVENT_DATE_FULL_LABEL}{" "}
              {MIXED_FUTSAL_EVENT_TIME_LABEL}, {MIXED_FUTSAL_EVENT_LOCATION_FULL_LABEL}에서
              열립니다. 팀 대표가 먼저 참가팀을 등록하면 운영진 확인 후 대회
              안내를 전달합니다.
            </p>
            <ul className="mt-6 grid gap-2 text-[14px] font-bold text-white/86 sm:grid-cols-2">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#D6E4FF]" aria-hidden />
                {MIXED_FUTSAL_TEAM_COUNT_LABEL} · {MIXED_FUTSAL_GROUP_LABEL}
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#D6E4FF]" aria-hidden />
                탈락 없음 · {MIXED_FUTSAL_GUARANTEE_LABEL}
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="px-5 py-10 sm:px-8 md:px-10 md:py-14">
        <div className="mx-auto grid max-w-[1120px] gap-8 lg:grid-cols-[0.92fr_1.08fr]">
          <aside className="space-y-4">
            <div className="border border-[#D0D8E8] bg-[#F5F7FF] p-5 sm:p-6">
              <div className="mb-4 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-[#0047AB]" aria-hidden />
                <h2 className="text-[20px] font-black">신청 전 확인</h2>
              </div>
              <ul className="space-y-3 text-[14px] leading-[1.72] text-[#526277]">
                <li>{MIXED_FUTSAL_GENDER_RULE_NOTE}</li>
                <li>{MIXED_FUTSAL_ELIGIBILITY_NOTE}</li>
                <li>교대 인원을 고려해 {MIXED_FUTSAL_ROSTER_LABEL}합니다.</li>
                <li>{MIXED_FUTSAL_WEATHER_NOTE} 우천에 대비한 준비물을 함께 챙겨주세요.</li>
                <li>{MIXED_FUTSAL_REFUND_NOTE}</li>
                <li>팀 대표는 선수카드 등록 후 참가 신청을 제출합니다.</li>
                <li>팀은 승인 대기 상태로 생성되며, 운영진 확인 후 참가 안내를 받습니다.</li>
                <li>팀원은 회원가입 후 해당 팀에 가입 신청하면 됩니다.</li>
              </ul>
              <Link
                href={`${MIXED_FUTSAL_EVENT_PATH}#mixed-futsal-rules`}
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[#0047AB] bg-white px-4 text-[14px] font-black text-[#0047AB] transition hover:bg-[#EEF3FF]"
              >
                <BookOpen className="h-4 w-4" aria-hidden />
                대회 규정 · 룰북 전문 보기
              </Link>
            </div>

            <div className="border border-[#D0D8E8] bg-[#F5F7FF] p-5 sm:p-6">
              <div className="mb-4 flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-[#0047AB]" aria-hidden />
                <h2 className="text-[20px] font-black">참가 자격 기준</h2>
              </div>
              <p className="mb-4 text-[14px] leading-[1.72] text-[#526277]">
                {MIXED_FUTSAL_ELIGIBILITY_NOTE}
              </p>
              <MixedFutsalEligibilityTable />
            </div>

            <div className="border border-[#D0D8E8] bg-white p-5 sm:p-6">
              <div className="mb-3 flex items-center gap-2">
                <Ticket className="h-5 w-5 text-[#0047AB]" aria-hidden />
                <h2 className="text-[18px] font-black">참가비</h2>
              </div>
              <ul className="grid gap-2 text-[14px] font-bold text-[#0D1B2A]">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#0047AB]" aria-hidden />
                  {MIXED_FUTSAL_ENTRY_FEE_EARLY_LABEL}
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#0047AB]" aria-hidden />
                  {MIXED_FUTSAL_ENTRY_FEE_REGULAR_LABEL}
                </li>
              </ul>
              <p className="mt-3 border-l-2 border-[#0047AB] bg-[#EEF3FF] px-3 py-2.5 text-[13px] leading-[1.7] text-[#526277]">
                이 화면에서는 결제하지 않습니다. 참가비 납부 방법과 기한은 신청
                접수 후 운영진이 별도로 안내합니다.
              </p>
            </div>

            <div className="flex gap-3 border border-[#D0D8E8] bg-white p-5 text-[14px] leading-[1.72] text-[#526277] sm:p-6">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[#0047AB]" aria-hidden />
              <span>
                <strong className="font-black text-[#0D1B2A]">{MIXED_FUTSAL_SAFETY_LABEL}.</strong>{" "}
                {MIXED_FUTSAL_SAFETY_NOTE}
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-3">
              {GUIDE_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="border border-[#D0D8E8] p-4">
                    <dt className="mb-2 flex items-center gap-2">
                      <Icon className="h-4 w-4 text-[#0047AB]" aria-hidden />
                      <span className="fg-label text-[10px] text-[#526277]">{item.label}</span>
                    </dt>
                    <dd className="text-[16px] font-black leading-tight">{item.value}</dd>
                  </div>
                );
              })}
            </dl>
          </aside>

          <section className="border border-[#D0D8E8] bg-white shadow-[0_18px_40px_rgba(13,27,42,0.08)]">
            {!initialized ? (
              <div className="p-6 text-[15px] font-bold text-[#526277] sm:p-8">
                계정 정보를 확인하고 있습니다.
              </div>
            ) : !user ? (
              <div className="p-6 sm:p-8">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#EEF3FF] text-[#0047AB]">
                  <LockKeyhole className="h-5 w-5" aria-hidden />
                </div>
                <h2 className="text-[24px] font-black leading-tight">
                  로그인 후 신청할 수 있습니다.
                </h2>
                <p className="mt-3 text-[15px] leading-[1.72] text-[#526277]">
                  기존 계정이 있으면 로그인하고, 처음이면 회원가입 후 이 화면으로
                  돌아와 신청을 이어가세요.
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Link
                    href="/login?returnTo=/mixed-futsal/apply"
                    className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[#0047AB] px-5 text-[15px] font-black text-white transition hover:bg-[#003080] sm:w-auto"
                  >
                    로그인하고 신청하기
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                  <Link
                    href="/register"
                    className="inline-flex min-h-12 w-full items-center justify-center rounded-[var(--radius-md)] border border-[#D0D8E8] px-5 text-[15px] font-bold text-[#0047AB] transition hover:bg-[#EEF3FF] sm:w-auto"
                  >
                    회원가입
                  </Link>
                </div>
              </div>
            ) : !player ? (
              <div className="p-6 sm:p-8">
                <h2 className="text-[24px] font-black leading-tight">선수카드 등록이 필요합니다.</h2>
                <p className="mt-3 text-[15px] leading-[1.72] text-[#526277]">
                  참가팀 대표자를 확인하기 위해 먼저 선수카드를 만들어주세요.
                  등록 후 이 신청 페이지로 돌아와 참가팀을 제출하면 됩니다.
                </p>
                <Link
                  href="/my/player-setup"
                  className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[#0047AB] px-5 text-[15px] font-black text-white transition hover:bg-[#003080] sm:w-auto"
                >
                  선수카드 등록하기
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            ) : createdTeamId ? (
              <div className="p-6 sm:p-8">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#EEF3FF] text-[#0047AB]">
                  <CheckCircle2 className="h-6 w-6" aria-hidden />
                </div>
                <h2 className="text-[24px] font-black leading-tight">
                  참가 신청이 접수되었습니다.
                </h2>
                <p className="mt-3 text-[15px] leading-[1.72] text-[#526277]">
                  팀은 승인 대기 상태로 등록되었습니다. 팀 관리 화면에서 로고,
                  소개, 팀원 가입 현황을 이어서 확인할 수 있습니다.
                </p>
                <p className="mt-4 border-l-2 border-[#0047AB] bg-[#EEF3FF] px-4 py-3 text-[14px] leading-[1.7] text-[#526277]">
                  {MIXED_FUTSAL_ENTRY_FEE_NOTE}
                </p>

                {/* 참가 확정 직후가 알림 수락률이 가장 높은 순간이다.
                    승인 결과·대회 안내를 놓치지 않으려면 여기서 켜는 게 맞다. */}
                <div className="mt-5">
                  <PushEnableCard />
                </div>
                <button
                  type="button"
                  onClick={() => router.push(`/my/team?teamId=${createdTeamId}&source=mixed-futsal`)}
                  className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[#0047AB] px-5 text-[15px] font-black text-white transition hover:bg-[#003080] sm:w-auto"
                >
                  팀 관리로 이동
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ) : player.teamId ? (
              <div className="p-6 sm:p-8">
                <h2 className="text-[24px] font-black leading-tight">이미 소속 팀이 있습니다.</h2>
                <p className="mt-3 text-[15px] leading-[1.72] text-[#526277]">
                  기존 팀으로 참가를 진행하려면 팀 관리 화면에서 팀 정보를
                  확인하고 운영진 안내에 따라 신청을 이어가세요.
                </p>
                <Link
                  href="/my/team?source=mixed-futsal"
                  className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[#0047AB] px-5 text-[15px] font-black text-white transition hover:bg-[#003080] sm:w-auto"
                >
                  내 팀 확인하기
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-6 sm:p-8">
                {draft.message && <p role="status" className="text-sm">{draft.message}</p>}
                <fieldset disabled={submitting || !draft.ready} className="contents">

                <p className="fg-label text-[11px] text-[#0047AB]">TEAM APPLICATION</p>
                <h2 className="mt-2 text-[24px] font-black leading-tight">참가팀 정보 입력</h2>
                <div className="mt-6 grid gap-5">
                  <div className="rounded-[var(--radius-md)] border border-[#D0D8E8] bg-[#F5F7FF] px-4 py-4">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 shrink-0 text-[#0047AB]" aria-hidden />
                      <span className="fg-label text-[10px] text-[#526277]">
                        혼성 구성 (코트 위 5명, GK 포함)
                      </span>
                    </div>
                    <p className="mt-2 text-[17px] font-black leading-[1.3] text-[#0D1B2A]">
                      {MIXED_FUTSAL_GENDER_RULE_LABEL}
                    </p>
                    <p className="mt-2 text-[13px] leading-[1.7] text-[#526277]">
                      모든 참가팀에 동일하게 적용되는 대회 규정입니다. 경기 중 이
                      구성은 항시 유지되며, 매 경기 여자 선수 2명이 코트 위에
                      섭니다.
                    </p>
                  </div>

                  <label className="grid gap-2">
                    <span className="text-[13px] font-bold text-[#526277]">팀명</span>
                    <input
                      value={teamName}
                      onChange={(event) => setTeamName(event.target.value)}
                      placeholder="예: 은평 믹스 FC"
                      className="min-h-12 rounded-[var(--radius-md)] border border-[#D0D8E8] px-4 text-[15px] outline-none transition focus:border-[#0047AB]"
                      required
                    />
                  </label>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="text-[13px] font-bold text-[#526277]">대표자명</span>
                      <input
                        value={captainName}
                        onChange={(event) => setCaptainName(event.target.value)}
                        className="min-h-12 rounded-[var(--radius-md)] border border-[#D0D8E8] px-4 text-[15px] outline-none transition focus:border-[#0047AB]"
                        required
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-[13px] font-bold text-[#526277]">대표 연락처</span>
                      <input
                        type="tel"
                        inputMode="tel"
                        value={captainPhone}
                        onChange={(event) => setCaptainPhone(event.target.value)}
                        placeholder="010-0000-0000"
                        className="min-h-12 rounded-[var(--radius-md)] border border-[#D0D8E8] px-4 text-[15px] outline-none transition focus:border-[#0047AB]"
                        required
                      />
                    </label>
                  </div>

                  <label className="flex min-h-12 items-start gap-3 rounded-[var(--radius-md)] border border-[#D0D8E8] bg-[#F5F7FF] px-4 py-3.5">
                    <input
                      type="checkbox"
                      checked={mixConfirmed}
                      onChange={(event) => setMixConfirmed(event.target.checked)}
                      className="mt-0.5 h-5 w-5 shrink-0 accent-[#0047AB]"
                      required
                    />
                    <span className="text-[14px] leading-[1.7] text-[#526277]">
                      코트 위 5명을{" "}
                      <strong className="font-black text-[#0D1B2A]">
                        {MIXED_FUTSAL_GENDER_RULE_LABEL}
                      </strong>
                      으로 운영하는 대회 규정을 확인했습니다. 우리 팀은 경기
                      중에도 이 구성을 유지할 수 있고, 팀원 모두가{" "}
                      <strong className="font-black text-[#0D1B2A]">{MIXED_FUTSAL_ELIGIBILITY_LABEL}</strong>{" "}
                      참가 자격을 충족합니다.
                    </span>
                  </label>

                  <label className="flex min-h-12 items-start gap-3 rounded-[var(--radius-md)] border border-[#D0D8E8] bg-[#F5F7FF] px-4 py-3.5">
                    <input
                      type="checkbox"
                      checked={portraitConsent}
                      onChange={(event) => setPortraitConsent(event.target.checked)}
                      className="mt-0.5 h-5 w-5 shrink-0 accent-[#0047AB]"
                      required
                    />
                    <span className="text-[14px] leading-[1.7] text-[#526277]">
                      대회 현장에서 촬영되는 사진·영상이{" "}
                      <strong className="font-black text-[#0D1B2A]">
                        FairGround의 홍보·마케팅 목적(온라인 채널·광고·인쇄물 등 상업적 이용 포함)
                      </strong>
                      으로 기간과 횟수의 제한 없이 사용되는 것에 동의하며, 이에
                      대해 별도의 대가나 초상권을 주장하지 않습니다. 팀 대표로서
                      팀원 전원에게 이 내용을 고지하고 동의를 받았습니다.
                    </span>
                  </label>

                  <p className="text-[13px] leading-[1.7] text-[#526277]">
                    경기 방식 · 팀 구성 · 안전 규정 · 우천 운영 등 전체 내용은{" "}
                    <Link
                      href={`${MIXED_FUTSAL_EVENT_PATH}#mixed-futsal-rules`}
                      className="font-black text-[#0047AB] underline underline-offset-2"
                    >
                      대회 규정 · 룰북 전문
                    </Link>
                    에서 확인할 수 있습니다.
                  </p>
                </div>

                {error && (
                  <p
                    role="alert"
                    className="mt-5 rounded-[var(--radius-md)] border border-[#FF3B30]/25 bg-[#FF3B30]/8 px-4 py-3 text-[14px] font-bold text-[#D92D20]"
                  >
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[#0047AB] px-5 text-[15px] font-black text-white transition hover:bg-[#003080] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {submitting ? "신청 제출 중..." : "참가 신청 제출"}
                  {!submitting && <ArrowRight className="h-4 w-4" aria-hidden />}
                </button>

                <p className="mt-4 text-[13px] leading-[1.7] text-[#526277]">
                  제출하면 팀이 승인 대기 상태로 등록됩니다. 참가비 납부 방법과
                  기한은 신청 접수 후 운영진이 별도로 안내합니다.
                </p>
              </fieldset>
              </form>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
