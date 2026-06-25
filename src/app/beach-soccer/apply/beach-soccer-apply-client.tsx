"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Layers,
  ListChecks,
  LockKeyhole,
  MapPinned,
  Medal,
  ShieldCheck,
  Ticket,
  Trophy,
  Users,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useDataStore } from "@/stores/dataStore";
import {
  BEACH_SOCCER_AWARD_SHORT_LABEL,
  BEACH_SOCCER_AWARD_BENEFIT,
  BEACH_SOCCER_DIVISIONS,
  BEACH_SOCCER_DIVISIONS_LABEL,
  BEACH_SOCCER_ENTRY_FEE_LABEL,
  BEACH_SOCCER_EVENT_NAME,
  BEACH_SOCCER_EVENT_DATE_LABEL,
  BEACH_SOCCER_EVENT_LOCATION_LABEL,
  BEACH_SOCCER_EVENT_PATH,
  BEACH_SOCCER_MATCH_FORMAT_LABEL,
  BEACH_SOCCER_PRIZE_LABEL,
  BEACH_SOCCER_TEAM_LIMIT_LABEL,
  type BeachSoccerDivision,
} from "@/lib/beach-soccer-event";

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
  { icon: CalendarDays, label: "일정", value: BEACH_SOCCER_EVENT_DATE_LABEL },
  { icon: MapPinned, label: "장소", value: BEACH_SOCCER_EVENT_LOCATION_LABEL },
  { icon: Layers, label: "부문", value: BEACH_SOCCER_DIVISIONS_LABEL },
  { icon: ListChecks, label: "경기 방식", value: BEACH_SOCCER_MATCH_FORMAT_LABEL },
  { icon: Users, label: "팀 인원", value: BEACH_SOCCER_TEAM_LIMIT_LABEL },
  { icon: Trophy, label: "총상금", value: BEACH_SOCCER_PRIZE_LABEL },
  { icon: Ticket, label: "참가비", value: BEACH_SOCCER_ENTRY_FEE_LABEL },
  { icon: Medal, label: "입상 혜택", value: BEACH_SOCCER_AWARD_SHORT_LABEL },
] as const;

export function BeachSoccerApplyClient() {
  const router = useRouter();
  const { user, player, initialized, updatePlayer } = useAuth();
  const createTeam = useDataStore((state) => state.createTeam);
  const claimTeamCoach = useDataStore((state) => state.claimTeamCoach);

  const [division, setDivision] = useState<BeachSoccerDivision>(BEACH_SOCCER_DIVISIONS[0]);
  const [teamName, setTeamName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const requiresSchool = division === "대학부";
  const [captainName, setCaptainName] = useState("");
  const [captainPhone, setCaptainPhone] = useState("");
  const [expectedPlayers, setExpectedPlayers] = useState("10");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [createdTeamId, setCreatedTeamId] = useState("");

  useEffect(() => {
    if (!player) return;
    setCaptainName((current) => current || player.name || "");
    setCaptainPhone((current) => current || player.phone || "");
  }, [player]);

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
    const trimmedSchoolName = schoolName.trim();
    const trimmedCaptainName = captainName.trim();
    const trimmedCaptainPhone = captainPhone.trim();

    if (!trimmedTeamName || !trimmedCaptainName || !trimmedCaptainPhone) {
      setError("팀명, 대표자명, 대표 연락처를 모두 입력해주세요.");
      return;
    }

    if (requiresSchool && !trimmedSchoolName) {
      setError("대학부는 학교명을 입력해주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const createdId = await createTeam({
        name: trimmedTeamName,
        logo: "",
        isApproved: false,
        captainId: player.id,
        memberCount: 1,
        seasonStats: DEFAULT_SEASON_STATS,
        createdAt: Date.now(),
        description: [
          "[비치사커 참가 신청]",
          `대회: ${BEACH_SOCCER_EVENT_NAME}`,
          `참가 부문: ${division}`,
          trimmedSchoolName ? `학교: ${trimmedSchoolName}` : "",
          `대표자: ${trimmedCaptainName}`,
          `대표 연락처: ${trimmedCaptainPhone}`,
          `예상 참가 인원: ${expectedPlayers || "미정"}명`,
          message.trim() ? `요청사항: ${message.trim()}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        introSubtitle: `${requiresSchool && trimmedSchoolName ? trimmedSchoolName : division} · 비치사커 참가 신청`,
        teamType: "community",
        leagueTier: "bronze",
        participationStreak: 0,
      });

      await claimTeamCoach(createdId);
      await updatePlayer({ teamId: createdId, teamRole: "coach" });
      localStorage.setItem("fg_registered_team_id", createdId);
      setCreatedTeamId(createdId);
    } catch (err) {
      console.error("[BeachSoccerApply] submit failed:", err);
      const messageText = err instanceof Error ? err.message : "";
      setError(
        messageText.includes("row-level security")
          ? "팀 등록 권한 설정이 필요합니다. 관리자에게 문의해주세요."
          : "참가 신청 제출에 실패했습니다. 잠시 후 다시 시도해주세요.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main
      className="min-h-screen bg-white pt-[60px] text-[#0D1B2A]"
      style={{ wordBreak: "keep-all", overflowWrap: "break-word" }}
    >
      <section className="border-b border-[#D0D8E8] bg-[#06162a] px-5 py-10 text-white sm:px-8 md:px-10 md:py-14">
        <div className="mx-auto max-w-[1120px]">
          <Link
            href={BEACH_SOCCER_EVENT_PATH}
            className="inline-flex items-center gap-2 text-[13px] font-bold text-white/70 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            비치사커대회 소개로 돌아가기
          </Link>
          <p className="fg-label mt-7 text-[11px] text-[#f3d38a]">BEACH SOCCER ENTRY</p>
          <h1 className="mt-3 text-[34px] font-black leading-[1.08] sm:text-[52px]">
            참가 신청
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-[1.78] text-white/72 sm:text-[16px]">
            팀 대표가 먼저 참가팀을 등록하면 운영진 확인 후 대회 안내를
            전달합니다. 계정이 없어도 이 화면에서 절차를 확인할 수 있고,
            로그인 후 신청서를 제출할 수 있습니다.
          </p>
        </div>
      </section>

      <section className="px-5 py-10 sm:px-8 md:px-10 md:py-14">
        <div className="mx-auto grid max-w-[1120px] gap-8 lg:grid-cols-[0.92fr_1.08fr]">
          <aside className="space-y-4">
            <div className="border border-[#C7D3E8] bg-[#F7FAFF] p-5 sm:p-6">
              <div className="mb-4 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-[#0047AB]" />
                <h2 className="text-[20px] font-black">신청 전 확인</h2>
              </div>
              <ul className="space-y-3 text-[14px] leading-[1.72] text-[#526277]">
                <li>대학부·남자부·여자부 중 한 부문으로 신청하며, 4팀 미만 부문은 진행되지 않습니다.</li>
                <li>팀 대표는 선수카드 등록 후 참가 신청을 제출합니다.</li>
                <li>팀은 승인 대기 상태로 생성되며, 운영진 확인 후 참가 안내를 받습니다.</li>
                <li>팀원은 회원가입 후 해당 팀에 가입 신청하면 됩니다.</li>
                <li>{BEACH_SOCCER_AWARD_BENEFIT}</li>
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {GUIDE_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="border border-[#D0D8E8] p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <Icon className="h-4 w-4 text-[#0047AB]" />
                      <span className="fg-label text-[10px] text-[#6B7A90]">{item.label}</span>
                    </div>
                    <div className="text-[16px] font-black leading-tight">{item.value}</div>
                  </div>
                );
              })}
            </div>
          </aside>

          <section className="border border-[#C7D3E8] bg-white shadow-[0_18px_40px_rgba(13,27,42,0.08)]">
            {!initialized ? (
              <div className="p-6 text-[15px] font-bold text-[#526277] sm:p-8">
                계정 정보를 확인하고 있습니다.
              </div>
            ) : !user ? (
              <div className="p-6 sm:p-8">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#EEF3FF] text-[#0047AB]">
                  <LockKeyhole className="h-5 w-5" />
                </div>
                <h2 className="text-[24px] font-black leading-tight">로그인 후 신청할 수 있습니다.</h2>
                <p className="mt-3 text-[15px] leading-[1.72] text-[#526277]">
                  자동으로 회원가입 화면으로 보내지지 않도록 신청 페이지를
                  분리했습니다. 기존 계정이 있으면 로그인하고, 처음이면 회원가입 후
                  다시 신청을 이어가세요.
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Link
                    href="/login?returnTo=/beach-soccer/apply"
                    className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[#0047AB] px-5 text-[15px] font-black text-white transition hover:bg-[#003080] sm:w-auto"
                  >
                    로그인하고 신청하기
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/register"
                    className="inline-flex min-h-12 w-full items-center justify-center rounded-[var(--radius-md)] border border-[#C7D3E8] px-5 text-[15px] font-bold text-[#0047AB] transition hover:bg-[#F7FAFF] sm:w-auto"
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
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : createdTeamId ? (
              <div className="p-6 sm:p-8">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#ECFDF3] text-[#067647]">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h2 className="text-[24px] font-black leading-tight">참가 신청이 접수되었습니다.</h2>
                <p className="mt-3 text-[15px] leading-[1.72] text-[#526277]">
                  팀은 승인 대기 상태로 등록되었습니다. 팀 관리 화면에서 로고,
                  소개, 팀원 가입 현황을 이어서 확인할 수 있습니다.
                </p>
                <button
                  type="button"
                  onClick={() => router.push(`/my/team?teamId=${createdTeamId}&source=beach-soccer`)}
                  className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[#0047AB] px-5 text-[15px] font-black text-white transition hover:bg-[#003080] sm:w-auto"
                >
                  팀 관리로 이동
                  <ArrowRight className="h-4 w-4" />
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
                  href="/my/team?source=beach-soccer"
                  className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[#0047AB] px-5 text-[15px] font-black text-white transition hover:bg-[#003080] sm:w-auto"
                >
                  내 팀 확인하기
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-6 sm:p-8">
                <p className="fg-label text-[11px] text-[#0047AB]">TEAM APPLICATION</p>
                <h2 className="mt-2 text-[24px] font-black leading-tight">참가팀 정보 입력</h2>
                <div className="mt-6 grid gap-5">
                  <div className="grid gap-2">
                    <span className="text-[13px] font-bold text-[#526277]">참가 부문</span>
                    <div className="grid grid-cols-3 gap-2">
                      {BEACH_SOCCER_DIVISIONS.map((option) => {
                        const active = division === option;
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setDivision(option)}
                            aria-pressed={active}
                            className={`min-h-12 rounded-[var(--radius-md)] border text-[15px] font-bold transition ${
                              active
                                ? "border-[#0047AB] bg-[#0047AB] text-white"
                                : "border-[#C7D3E8] bg-white text-[#526277] hover:border-[#0047AB]"
                            }`}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <label className="grid gap-2">
                    <span className="text-[13px] font-bold text-[#526277]">팀명</span>
                    <input
                      value={teamName}
                      onChange={(event) => setTeamName(event.target.value)}
                      placeholder="예: 망상 비치 FC"
                      className="min-h-12 rounded-[var(--radius-md)] border border-[#C7D3E8] px-4 text-[15px] outline-none transition focus:border-[#0047AB]"
                      required
                    />
                  </label>
                  {requiresSchool && (
                    <label className="grid gap-2">
                      <span className="text-[13px] font-bold text-[#526277]">학교명</span>
                      <input
                        value={schoolName}
                        onChange={(event) => setSchoolName(event.target.value)}
                        placeholder="예: 동해대학교"
                        className="min-h-12 rounded-[var(--radius-md)] border border-[#C7D3E8] px-4 text-[15px] outline-none transition focus:border-[#0047AB]"
                        required
                      />
                    </label>
                  )}
                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="text-[13px] font-bold text-[#526277]">대표자명</span>
                      <input
                        value={captainName}
                        onChange={(event) => setCaptainName(event.target.value)}
                        className="min-h-12 rounded-[var(--radius-md)] border border-[#C7D3E8] px-4 text-[15px] outline-none transition focus:border-[#0047AB]"
                        required
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-[13px] font-bold text-[#526277]">대표 연락처</span>
                      <input
                        value={captainPhone}
                        onChange={(event) => setCaptainPhone(event.target.value)}
                        placeholder="010-0000-0000"
                        className="min-h-12 rounded-[var(--radius-md)] border border-[#C7D3E8] px-4 text-[15px] outline-none transition focus:border-[#0047AB]"
                        required
                      />
                    </label>
                  </div>
                  <label className="grid gap-2">
                    <span className="text-[13px] font-bold text-[#526277]">예상 참가 인원</span>
                    <input
                      type="number"
                      min="6"
                      max="20"
                      value={expectedPlayers}
                      onChange={(event) => setExpectedPlayers(event.target.value)}
                      className="min-h-12 rounded-[var(--radius-md)] border border-[#C7D3E8] px-4 text-[15px] outline-none transition focus:border-[#0047AB]"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-[13px] font-bold text-[#526277]">요청사항</span>
                    <textarea
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      placeholder="운영진에게 전달할 내용이 있으면 입력해주세요."
                      rows={4}
                      className="rounded-[var(--radius-md)] border border-[#C7D3E8] px-4 py-3 text-[15px] leading-relaxed outline-none transition focus:border-[#0047AB]"
                    />
                  </label>
                </div>

                {error && (
                  <p className="mt-5 rounded-[var(--radius-md)] border border-[#FF3B30]/25 bg-[#FF3B30]/8 px-4 py-3 text-[14px] font-bold text-[#D92D20]">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[#0047AB] px-5 text-[15px] font-black text-white transition hover:bg-[#003080] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {submitting ? "신청 제출 중..." : "참가 신청 제출"}
                  {!submitting && <ArrowRight className="h-4 w-4" />}
                </button>
              </form>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
