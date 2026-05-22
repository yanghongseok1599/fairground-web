"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useDataStore } from "@/stores/dataStore";
import { useAuth } from "@/hooks/useAuth";
import { PlayerCard } from "@/components/player-card";
import { ClubEmblem } from "@/components/club-emblem";
import type { Team, Player } from "@/types";
import { buildRosterInsights } from "@/lib/team-finance";
import { buildTeamClubhouseAnchor, buildTeamRecordLine, getRosterFilterCount, type RosterFilter } from "@/lib/team-home";
import {
  ArrowLeft,
  ArrowRight,
  ClipboardList,
  CreditCard,
  Image as ImageIcon,
  MessageSquare,
  Share2,
  Shield,
  Trophy,
  Users,
} from "lucide-react";

const POSITION_LABELS: Record<RosterFilter, string> = {
  ALL: "전체",
  GK: "GK",
  FIXO: "FIXO",
  ALA: "ALA",
  PIVO: "PIVO",
};

const defaultTeamIntro = "선수카드, 경기 기록, 공지, 회비 장부를 한 곳에서 관리하는 FairGround 팀 홈페이지입니다.";

function StatBlock({ index, label, value }: { index: string; label: string; value: string | number }) {
  return (
    <div className="border p-4" style={{ background: "rgba(255,255,255,0.84)", borderColor: "rgba(0,71,171,0.14)", boxShadow: "var(--shadow-sm)" }}>
      <div className="fg-mono text-[10px]" style={{ color: "var(--primary)" }}>{index}</div>
      <div className="mt-3 fg-display text-3xl font-black tabular-nums" style={{ color: "var(--color-fg-ink)" }}>{value}</div>
      <div className="mt-1 fg-label text-[10px]" style={{ color: "var(--color-fg-ink-muted)" }}>{label}</div>
    </div>
  );
}

function ModuleCard({ href, icon, index, title, desc }: { href: string; icon: React.ReactNode; index: string; title: string; desc: string }) {
  return (
    <Link href={href} className="group relative overflow-hidden border p-5 transition-transform hover:-translate-y-1" style={{ background: "rgba(255,255,255,0.86)", borderColor: "rgba(0,71,171,0.14)", boxShadow: "var(--shadow-md)" }}>
      <div className="absolute inset-0 fg-scanlines opacity-50 pointer-events-none" />
      <div className="relative">
        <div className="mb-7 flex items-start justify-between">
          <span className="fg-mono text-[11px]" style={{ color: "var(--primary)" }}>{index}</span>
          <div className="flex h-11 w-11 items-center justify-center border" style={{ background: "var(--color-fg-paper-3)", borderColor: "rgba(0,71,171,0.20)", color: "var(--primary)" }}>{icon}</div>
        </div>
        <h3 className="fg-display text-xl font-black" style={{ color: "var(--color-fg-ink)" }}>{title}</h3>
        <p className="mt-2 min-h-[44px] text-sm leading-relaxed" style={{ color: "var(--color-fg-ink-muted)" }}>{desc}</p>
        <div className="mt-6 flex items-center justify-between border-t pt-4" style={{ borderColor: "rgba(0,71,171,0.12)" }}>
          <span className="fg-label text-[10px]" style={{ color: "var(--primary)" }}>OPEN</span>
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" style={{ color: "var(--primary)" }} />
        </div>
      </div>
    </Link>
  );
}

function TeamEmblem({ team }: { team: Team }) {
  return (
    <div className="relative flex aspect-square w-full max-w-[260px] items-center justify-center border p-6" style={{ background: "linear-gradient(145deg, #ffffff, #EEF3FF)", borderColor: "rgba(0,71,171,0.18)", boxShadow: "0 30px 80px rgba(0,71,171,0.14)" }}>
      <div className="absolute inset-3 border" style={{ borderColor: "rgba(0,71,171,0.10)" }} />
      <ClubEmblem name={team.name} logoSrc={team.logo} className="relative h-full w-full" />
    </div>
  );
}

export default function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const store = useDataStore();
  const { player: currentPlayer } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [position, setPosition] = useState<RosterFilter>("ALL");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [resolvedTeam, resolvedPlayers] = await Promise.all([
        store.fetchTeam(id),
        store.fetchTeamPlayers(id),
      ]);
      setTeam(resolvedTeam ?? null);
      setPlayers(
        resolvedPlayers
          .filter((player) => player.isApproved)
          .sort((a, b) => b.cardRating - a.cardRating)
      );
      setLoading(false);
    };
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const rosterInsights = useMemo(() => buildRosterInsights(players), [players]);
  const filteredPlayers = useMemo(
    () => players.filter((player) => position === "ALL" || player.position === position),
    [players, position]
  );
  const topScorer = players.find((player) => player.id === rosterInsights.topScorerId);
  // 팀 관리 권한 UX 가드:
  //  - admin
  //  - 본인이 팀 captain 컬럼에 지정된 사람
  //  - 본인이 이 팀의 captain/manager/coach (team_role)
  // 최종 강제는 RLS+트리거.
  const isTeamStaff = Boolean(
    currentPlayer &&
      team &&
      currentPlayer.teamId === team.id &&
      (currentPlayer.teamRole === "captain" ||
        currentPlayer.teamRole === "manager" ||
        currentPlayer.teamRole === "coach")
  );
  const canManageTeam = Boolean(
    currentPlayer &&
      team &&
      (currentPlayer.id === team.captainId ||
        currentPlayer.role === "admin" ||
        isTeamStaff)
  );
  const topAssist = players.find((player) => player.id === rosterInsights.topAssistId);
  const recordLine = team ? buildTeamRecordLine(team.seasonStats) : "0W 0D 0L";

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share && team) {
        await navigator.share({ title: `${team.name} - FairGround`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // 공유 취소는 무시.
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-[60px]" style={{ background: "var(--color-fg-paper)" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2" style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-[60px]" style={{ background: "var(--color-fg-paper)", color: "var(--color-fg-ink-muted)" }}>
        팀을 찾을 수 없습니다
      </div>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden pt-[60px]" style={{ background: "var(--color-fg-paper)" }}>
      <div className="absolute inset-0 fg-grid opacity-50 pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-[640px] pointer-events-none" style={{ background: "radial-gradient(circle at 12% 8%, rgba(0,71,171,0.16), transparent 30%), radial-gradient(circle at 88% 10%, rgba(0,71,171,0.10), transparent 34%), linear-gradient(180deg, rgba(245,247,255,0.95), rgba(255,255,255,0))" }} />

      <section className="relative px-5 py-10 md:px-10 md:py-16">
        <div className="mx-auto max-w-[1320px]">
          <Link href="/teams" className="mb-10 inline-flex min-h-[44px] items-center gap-2 border px-4 text-sm font-bold transition-transform hover:-translate-y-0.5" style={{ background: "rgba(255,255,255,0.78)", borderColor: "rgba(0,71,171,0.18)", color: "var(--primary)", boxShadow: "var(--shadow-sm)" }}>
            <ArrowLeft className="h-4 w-4" /> 팀 목록
          </Link>

          {team.bannerUrl && (
            <div
              role="img"
              aria-label={`${team.name} 배너`}
              className="mb-10 w-full overflow-hidden rounded-md"
              style={{
                height: "clamp(120px, 18vw, 220px)",
                backgroundImage: `url(${team.bannerUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                borderColor: "rgba(0,71,171,0.14)",
                boxShadow: "var(--shadow-sm)",
              }}
            />
          )}

          <div className="grid gap-10 lg:grid-cols-[1fr_340px] lg:items-end">
            <div>
              <div className="mb-5 flex items-center gap-3 flex-wrap">
                <span className="fg-mono text-[11px]" style={{ color: "var(--primary)" }}>CLUB</span>
                <span className="h-2 w-2" style={{ background: "var(--primary)" }} />
                <span className="fg-label" style={{ color: "var(--color-fg-blue)" }}>{team.isApproved ? "OFFICIAL TEAM HOME" : "PENDING TEAM HOME"}</span>
                {isTeamStaff && currentPlayer?.teamRole && (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded"
                    style={{ background: "var(--primary)", color: "#fff" }}
                    aria-label={`내 팀 역할: ${
                      currentPlayer.teamRole === "coach"
                        ? "감독"
                        : currentPlayer.teamRole === "manager"
                          ? "운영자"
                          : "주장"
                    }`}
                  >
                    <Shield className="h-3 w-3" />
                    {currentPlayer.teamRole === "coach"
                      ? "감독"
                      : currentPlayer.teamRole === "manager"
                        ? "운영자"
                        : "주장"}
                  </span>
                )}
              </div>
              <h1 className="fg-display font-black" style={{ fontSize: "clamp(56px, 10vw, 132px)", lineHeight: 0.86, letterSpacing: "-0.045em", color: "var(--color-fg-blue-deep)", textShadow: "0 8px 22px rgba(0,71,171,0.10)" }}>
                {team.name}
              </h1>
              {team.introSubtitle && (
                <p className="mt-4 max-w-[680px] fg-display text-xl md:text-2xl font-bold" style={{ color: "var(--primary)" }}>
                  {team.introSubtitle}
                </p>
              )}
              <p className="mt-7 max-w-[680px] text-[15px] leading-relaxed md:text-[18px] whitespace-pre-line" style={{ color: "var(--color-fg-ink-muted)", fontFamily: "var(--font-body)" }}>
                {team.description?.trim() || defaultTeamIntro}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href={buildTeamClubhouseAnchor()} className="inline-flex min-h-[50px] items-center gap-3 px-7 fg-display text-sm transition-transform hover:-translate-y-0.5" style={{ background: "var(--primary)", color: "var(--primary-foreground)", boxShadow: "0 14px 30px rgba(0,71,171,0.20)" }}>
                  팀 운영 보기 <ArrowRight className="h-4 w-4" />
                </a>
                {canManageTeam && (
                  <Link href="/my/team" className="inline-flex min-h-[50px] items-center gap-3 border px-7 fg-display text-sm transition-transform hover:-translate-y-0.5" style={{ background: "var(--primary)", borderColor: "var(--primary)", color: "var(--primary-foreground)", boxShadow: "0 14px 30px rgba(0,71,171,0.20)" }}>
                    <Shield className="h-4 w-4" /> 팀 관리
                  </Link>
                )}
                <button onClick={handleShare} className="inline-flex min-h-[50px] items-center gap-3 border px-7 fg-display text-sm transition-transform hover:-translate-y-0.5" style={{ background: "rgba(255,255,255,0.72)", borderColor: "rgba(0,71,171,0.22)", color: "var(--primary)" }}>
                  <Share2 className="h-4 w-4" /> {copied ? "링크 복사됨" : "팀홈 공유"}
                </button>
              </div>
            </div>

            <div className="flex justify-center lg:justify-end">
              <TeamEmblem team={team} />
            </div>
          </div>

          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatBlock index="01" label="선수" value={players.length || team.memberCount} />
            <StatBlock index="02" label="평균 평점" value={rosterInsights.averageRating || "-"} />
            <StatBlock index="03" label="승점" value={team.seasonStats.points} />
            <StatBlock index="04" label="전적" value={recordLine} />
            <StatBlock index="05" label="창단" value={team.foundedYear ? `${team.foundedYear}` : "FG"} />
          </div>
        </div>
      </section>

      <section className="relative px-5 py-12 md:px-10">
        <div className="mx-auto max-w-[1320px]">
          <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="flex items-start gap-4 md:gap-6">
              <span className="fg-mono mt-2 text-[11px]" style={{ color: "var(--primary)" }}>01</span>
              <div>
                <div className="mb-2 flex items-center gap-2"><span className="h-2 w-2" style={{ background: "var(--primary)" }} /><span className="fg-label" style={{ color: "var(--primary)" }}>PLAYER CARD ROSTER</span></div>
                <h2 className="fg-display text-2xl font-black md:text-4xl" style={{ color: "var(--color-fg-ink)" }}>선수카드 로스터</h2>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(POSITION_LABELS) as RosterFilter[]).map((value) => (
                <button key={value} onClick={() => setPosition(value)} className="min-h-[40px] border px-4 text-xs font-black transition-colors" style={{ background: position === value ? "var(--primary)" : "rgba(255,255,255,0.78)", borderColor: "rgba(0,71,171,0.18)", color: position === value ? "#fff" : "var(--primary)" }}>
                  {POSITION_LABELS[value]} {getRosterFilterCount(players, value)}
                </button>
              ))}
            </div>
          </div>

          {filteredPlayers.length === 0 ? (
            <div className="border py-16 text-center" style={{ background: "rgba(255,255,255,0.72)", borderColor: "rgba(0,71,171,0.14)", color: "var(--color-fg-ink-muted)" }}>
              등록된 선수가 없습니다
            </div>
          ) : (
            <div className="flex flex-wrap justify-center gap-5">
              {filteredPlayers.map((player) => (
                <Link key={player.id} href={`/players/${player.id}`} className="transition-transform hover:scale-105">
                  <PlayerCard player={player} size="sm" teamLogo={team.logo} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>


      <section id="team-operations" className="relative scroll-mt-24 px-5 py-10 md:px-10">
        <div className="mx-auto max-w-[1320px]">
          <div className="mb-8 flex items-start gap-4 md:gap-6">
            <span className="fg-mono mt-2 text-[11px]" style={{ color: "var(--primary)" }}>02</span>
            <div>
              <div className="mb-2 flex items-center gap-2"><span className="h-2 w-2" style={{ background: "var(--primary)" }} /><span className="fg-label" style={{ color: "var(--primary)" }}>TEAM OPERATIONS</span></div>
              <h2 className="fg-display text-2xl font-black md:text-4xl" style={{ color: "var(--color-fg-ink)" }}>팀 운영 모듈</h2>
            </div>
          </div>
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <div className="border p-5" style={{ background: "linear-gradient(135deg, rgba(0,71,171,0.10), rgba(255,255,255,0.88))", borderColor: "rgba(0,71,171,0.14)", boxShadow: "var(--shadow-sm)" }}>
              <div className="fg-label text-[10px]" style={{ color: "var(--primary)" }}>승인 선수</div>
              <div className="mt-2 fg-display text-4xl font-black" style={{ color: "var(--color-fg-ink)" }}>{players.length}</div>
              <p className="mt-2 text-xs" style={{ color: "var(--color-fg-ink-muted)" }}>현재 팀홈에 노출되는 로스터입니다.</p>
            </div>
            <div className="border p-5" style={{ background: "rgba(255,255,255,0.86)", borderColor: "rgba(0,71,171,0.14)", boxShadow: "var(--shadow-sm)" }}>
              <div className="fg-label text-[10px]" style={{ color: "var(--primary)" }}>읽지 않은 공지</div>
              <div className="mt-2 fg-display text-4xl font-black" style={{ color: "var(--color-fg-ink)" }}>0</div>
              <p className="mt-2 text-xs" style={{ color: "var(--color-fg-ink-muted)" }}>공지 모듈과 연결 예정입니다.</p>
            </div>
            <div className="border p-5" style={{ background: "rgba(255,255,255,0.86)", borderColor: "rgba(0,71,171,0.14)", boxShadow: "var(--shadow-sm)" }}>
              <div className="fg-label text-[10px]" style={{ color: "var(--primary)" }}>운영 모드</div>
              <div className="mt-2 fg-display text-4xl font-black" style={{ color: "var(--color-fg-ink)" }}>MVP</div>
              <p className="mt-2 text-xs" style={{ color: "var(--color-fg-ink-muted)" }}>팀 공지·회비·게시판·멤버 관리를 아래에서 바로 확인합니다.</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            <ModuleCard href={`/teams/${team.id}/notices`} icon={<ClipboardList className="h-5 w-5" />} index="01" title="공지사항" desc="팀 공지, 읽음 체크, 댓글을 관리합니다." />
            <ModuleCard href={`/teams/${team.id}/dues`} icon={<CreditCard className="h-5 w-5" />} index="02" title="회비 장부" desc="월별 회비, 미납자, 지출과 잔액을 확인합니다." />
            <ModuleCard href={`/teams/${team.id}/chat`} icon={<MessageSquare className="h-5 w-5" />} index="03" title="팀 게시판" desc="경기 후기, 자유글, 공지 관련 대화를 게시판으로 모읍니다." />
            <ModuleCard href={`/teams/${team.id}/members`} icon={<Users className="h-5 w-5" />} index="04" title="멤버 관리" desc="초대 링크와 선수 승인 흐름을 관리합니다." />
            <ModuleCard href={`/teams/${team.id}/gallery`} icon={<ImageIcon className="h-5 w-5" />} index="05" title="갤러리" desc="경기·훈련 사진을 팀과 함께 남깁니다." />
          </div>
        </div>
      </section>


      <section className="relative px-5 py-12 md:px-10">
        <div className="mx-auto max-w-[1320px] border p-5 md:p-7" style={{ background: "rgba(255,255,255,0.86)", borderColor: "rgba(0,71,171,0.14)", boxShadow: "var(--shadow-md)" }}>
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="fg-label mb-2" style={{ color: "var(--primary)" }}>TEAM SNAPSHOT</div>
              <h2 className="fg-display text-3xl font-black md:text-5xl" style={{ color: "var(--color-fg-ink)" }}>팀 기록 요약</h2>
            </div>
            <Trophy className="h-8 w-8" style={{ color: "var(--primary)" }} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <StatBlock index="G" label="경기" value={team.seasonStats.gamesPlayed} />
            <StatBlock index="R" label="승/무/패" value={`${team.seasonStats.wins}/${team.seasonStats.draws}/${team.seasonStats.losses}`} />
            <StatBlock index="GF" label="득점" value={team.seasonStats.goalsFor || rosterInsights.totalGoals} />
            <StatBlock index="A" label="도움" value={rosterInsights.totalAssists} />
            <StatBlock index="ST" label="득점 리더" value={topScorer?.name ?? "-"} />
            <StatBlock index="AS" label="도움 리더" value={topAssist?.name ?? "-"} />
          </div>
        </div>
      </section>

    </main>
  );
}
