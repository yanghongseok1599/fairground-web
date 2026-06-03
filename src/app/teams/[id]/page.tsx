"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useDataStore } from "@/stores/dataStore";
import { useAuth } from "@/hooks/useAuth";
import { PlayerCard } from "@/components/player-card";
import { getClubLogoPreset } from "@/components/club-emblem";
import { createTeamCardCanvas } from "@/lib/team-card-canvas";
import type { Team, Player, Notice, BoardPost, TeamPhoto } from "@/types";
import { buildRosterInsights } from "@/lib/team-finance";
import { canManageTeam as canManageTeamHelper } from "@/lib/team-permissions";
import { buildTeamRecordLine, getRosterFilterCount, leagueTierCardIndex, LEAGUE_TIER_LABEL, nextLeagueTier, type RosterFilter } from "@/lib/team-home";
import {
  ArrowLeft,
  ArrowRight,
  ClipboardList,
  CreditCard,
  Image as ImageIcon,
  MessageSquare,
  Pencil,
  Share2,
  Shield,
  Trophy,
  UserPlus,
} from "lucide-react";

const POSITION_LABELS: Record<RosterFilter, string> = {
  ALL: "전체",
  GK: "GK",
  FIXO: "FIXO",
  ALA: "ALA",
  PIVO: "PIVO",
};

const defaultTeamIntro = "선수카드, 경기 기록, 공지, 회비 장부를 한 곳에서 관리하는 FairGround 팀 홈페이지입니다.";

const TEAM_CARD_VARIANTS = [
  "/images/team-cards/team-card-bronze.png?v=17",
  "/images/team-cards/team-card-silver.png?v=17",
  "/images/team-cards/team-card-gold.png?v=18",
  "/images/team-cards/team-card-emerald.png?v=25",
];

// 카드 인덱스 결정은 lib/team-home.ts의 stableTeamCardIndex로 통일했다 —
// 랜딩 캐러셀과 동일한 매핑을 써 같은 팀이 두 surface에서 동일 프레임으로 보임.

function StatBlock({ index, label, value }: { index: string; label: string; value: string | number }) {
  return (
    <div className="border p-3 md:p-4" style={{ background: "rgba(255,255,255,0.84)", borderColor: "rgba(0,71,171,0.14)", boxShadow: "var(--shadow-sm)" }}>
      <div className="fg-mono text-[9px] md:text-[10px]" style={{ color: "var(--primary)" }}>{index}</div>
      <div className="mt-2 fg-display text-2xl font-black leading-none tabular-nums md:mt-3 md:text-3xl" style={{ color: "var(--color-fg-ink)" }}>{value}</div>
      <div className="mt-1 fg-label text-[9px] md:text-[10px]" style={{ color: "var(--color-fg-ink-muted)" }}>{label}</div>
    </div>
  );
}

function TeamEmblem({ team }: { team: Team }) {
  // 카드 프레임 = 리그 등급(브론즈/실버/골드/프리미엄). 등급이 곧 카드 비주얼.
  const cardIndex = leagueTierCardIndex(team.leagueTier);
  const [src, setSrc] = useState<string | null>(null);

  // 랜딩 캐러셀과 동일한 createTeamCardCanvas 함수로 카드 텍스처를 만들어
  // dataURL 로 변환. HTML 오버레이 방식은 폰트 자동축소가 안 돼 긴 팀명이
  // 잘리거나 위치가 어긋났는데, 캔버스 1장으로 통일하면 두 surface 가 100%
  // 동일하게 보인다. ClubEmblem 의 logo 폴백 규칙(getClubLogoPreset)도 그대로
  // 적용해 업로드 로고가 없을 때의 fallback 까지 일치시킨다.
  useEffect(() => {
    let cancelled = false;
    const trimmed = team.logo?.trim() ?? "";
    const hasCustom =
      trimmed.length > 0 &&
      !trimmed.includes("/images/default-team.png") &&
      (trimmed.startsWith("data:image/") ||
        trimmed.startsWith("http://") ||
        trimmed.startsWith("https://") ||
        !trimmed.startsWith("/images/team-logos/"));
    const resolvedLogo = hasCustom
      ? trimmed
      : getClubLogoPreset(team.name, cardIndex).asset;

    void createTeamCardCanvas({
      name: team.name,
      logo: resolvedLogo,
      frame: TEAM_CARD_VARIANTS[cardIndex],
      colorIndex: cardIndex,
    })
      .then((canvas) => {
        if (cancelled) return;
        setSrc(canvas.toDataURL("image/png"));
      })
      .catch((err) => {
        console.error("[TeamEmblem] canvas failed:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [team.id, team.name, team.logo, cardIndex]);

  return (
    <div
      className="relative aspect-[1080/1240] w-full max-w-[240px] sm:max-w-[300px] lg:max-w-[360px] mx-auto"
      style={{
        filter: "drop-shadow(0 34px 70px rgba(0,0,0,0.24))",
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`${team.name} 카드`}
          className="absolute inset-0 h-full w-full select-none object-contain"
          draggable={false}
        />
      ) : (
        // 캔버스 준비 전 placeholder — 프레임만 우선 노출해 layout shift 방지.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={TEAM_CARD_VARIANTS[cardIndex]}
          alt=""
          className="absolute inset-0 h-full w-full select-none object-contain opacity-70"
          draggable={false}
        />
      )}
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
  // 가입 신청 상태 — 로그인 + 무소속 + 승인팀일 때 노출.
  const [joinRequesting, setJoinRequesting] = useState(false);
  const [joinDone, setJoinDone] = useState<"ok" | "err" | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [boardPosts, setBoardPosts] = useState<BoardPost[]>([]);
  const [photos, setPhotos] = useState<TeamPhoto[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [resolvedTeam, resolvedPlayers, resolvedNotices, resolvedPosts, resolvedPhotos] =
        await Promise.all([
          store.fetchTeam(id),
          store.fetchTeamPlayers(id),
          store.fetchNotices({ teamId: id }).catch(() => [] as Notice[]),
          store.fetchBoardPosts({ teamId: id }).catch(() => [] as BoardPost[]),
          store.fetchTeamPhotos(id, 8).catch(() => [] as TeamPhoto[]),
        ]);
      setTeam(resolvedTeam ?? null);
      setPlayers(
        resolvedPlayers
          .filter((player) => player.isApproved)
          .sort((a, b) => b.cardRating - a.cardRating)
      );
      setNotices(resolvedNotices);
      setBoardPosts(resolvedPosts);
      setPhotos(resolvedPhotos);
      setLoading(false);
    };
    void load();
    // currentSeason은 standings 액션을 통해 store에 캐시된다. 팀 홈 처음
    // 진입이면 비어있을 수 있으니 한 번 트리거.
    void store.fetchStandings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const currentSeason = useDataStore((s) => s.currentSeason);

  const rosterInsights = useMemo(() => buildRosterInsights(players), [players]);
  const filteredPlayers = useMemo(
    () => players.filter((player) => position === "ALL" || player.position === position),
    [players, position]
  );
  const topScorer = players.find((player) => player.id === rosterInsights.topScorerId);
  // Director gates come from lib/team-permissions. isTeamStaff is a
  // narrower variant used only for the inline "본인 운영자임" badge — it
  // does NOT include admin/captainId so the chip says what role the user
  // actually has on this team.
  const isTeamStaff = Boolean(
    currentPlayer &&
      team &&
      currentPlayer.teamId === team.id &&
      (currentPlayer.teamRole === "captain" ||
        currentPlayer.teamRole === "manager" ||
        currentPlayer.teamRole === "coach"),
  );
  const canManageTeam = canManageTeamHelper(currentPlayer, team);
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

  const handleJoinRequest = async () => {
    if (!team || joinRequesting || joinDone === "ok") return;
    setJoinRequesting(true);
    setJoinError(null);
    try {
      await store.requestJoinTeam(team.id);
      setJoinDone("ok");
    } catch (err) {
      setJoinDone("err");
      setJoinError(err instanceof Error ? err.message : "신청에 실패했습니다.");
    } finally {
      setJoinRequesting(false);
    }
  };

  // 가입 신청 자격: 로그인 + 무소속 + 승인된 팀(운영자가 아닌 경우).
  const canRequestJoin = Boolean(
    currentPlayer && !currentPlayer.teamId && team?.isApproved && !canManageTeam,
  );

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
                {/* 리그 단계 배지 — 4단계 메탈 등급 */}
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded"
                  style={{
                    background: "color-mix(in srgb, var(--primary) 12%, transparent)",
                    color: "var(--primary)",
                    border: "1px solid rgba(0,71,171,0.28)",
                  }}
                  aria-label={`현재 리그: ${LEAGUE_TIER_LABEL[team.leagueTier]}`}
                >
                  {LEAGUE_TIER_LABEL[team.leagueTier]}
                </span>
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

              {/* 연속 참여 보상 — 연속 대회 참여(최대 4회) 시 다음 대진에서
                  휴식이 많은 시드를 우선 배정받는 "휴식 시드 우선권". 승급은
                  시즌 성적 상위 2팀으로 결정된다(승점 가산 없음). */}
              <div className="mt-6 max-w-[420px]">
                <div className="mb-1.5 flex items-center justify-between text-[12px]">
                  <span className="font-bold" style={{ color: "var(--color-fg-ink)" }}>
                    연속 참여 보상
                  </span>
                  <span className="fg-mono" style={{ color: "var(--primary)" }}>
                    {team.participationStreak}연속 · {team.participationStreak >= 2 ? "휴식 시드 우선권" : "—"}
                  </span>
                </div>
                <div className="flex gap-1.5" aria-label={`연속 참여 ${team.participationStreak}/4`}>
                  {[1, 2, 3, 4].map((n) => (
                    <div
                      key={n}
                      className="h-2 flex-1 rounded-full transition-all"
                      style={{
                        background:
                          n <= team.participationStreak
                            ? "var(--primary)"
                            : "var(--color-fg-paper-3)",
                      }}
                    />
                  ))}
                </div>
                <p className="mt-1.5 text-[11px]" style={{ color: "var(--color-fg-ink-muted)" }}>
                  연속 참여가 길수록 다음 대진에서 휴식이 많은 시드를 우선 배정받습니다(2연속부터). 시즌 성적 상위 2팀이 {nextLeagueTier(team.leagueTier) ? `${LEAGUE_TIER_LABEL[nextLeagueTier(team.leagueTier)!]}로 승급` : "유지"}합니다.
                </p>
              </div>
              {canManageTeam ? (
                // 팀 소개(소제목 + 본문) 편집 어포던스. 본문 끝에 묻히지 않도록
                // 라벨이 붙은 독립 pill로 띄워 admin 식별성을 높인다.
                <div className="mt-3">
                  <Link
                    href="/my/team"
                    aria-label="팀 소개 수정"
                    title="팀 소개 수정"
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors hover:bg-[rgba(0,71,171,0.08)]"
                    style={{
                      borderColor: "rgba(0,71,171,0.20)",
                      color: "var(--primary)",
                      background: "var(--color-fg-paper)",
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    팀 소개 편집
                  </Link>
                </div>
              ) : (
                currentPlayer &&
                !team.captainId &&
                currentPlayer.teamId === team.id && (
                  // Orphan-team 회수 경로: 본인이 멤버인데 캡틴이 비어있는 경우,
                  // /my/team 의 "이 팀의 캡틴으로 등록" 흐름으로 한 번에 안내해
                  // 권한이 없어 편집 어포던스가 보이지 않는 막힘을 풀어준다.
                  <div className="mt-3">
                    <Link
                      href="/my/team"
                      aria-label="이 팀 운영자로 등록"
                      title="이 팀 운영자로 등록"
                      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors hover:bg-[rgba(0,71,171,0.08)]"
                      style={{
                        borderColor: "rgba(0,71,171,0.20)",
                        color: "var(--primary)",
                        background: "var(--color-fg-paper)",
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      이 팀 운영자로 등록하고 편집
                    </Link>
                  </div>
                )
              )}
              {/* Public team home is for fans + roster members. Director-only
                  entry points (팀 관리 / 팀 운영) moved out — admins reach the
                  ops surface through /my/team or /teams/[id]/admin. */}
              <div className="mt-8 flex flex-wrap gap-3">
                {canRequestJoin && (
                  <button
                    onClick={handleJoinRequest}
                    disabled={joinRequesting || joinDone === "ok"}
                    className="inline-flex min-h-[50px] items-center gap-3 px-8 fg-display text-sm transition-transform hover:-translate-y-0.5 disabled:opacity-70"
                    style={{
                      background: "var(--primary)",
                      color: "var(--primary-foreground)",
                      boxShadow: "0 14px 30px rgba(0,71,171,0.22)",
                    }}
                  >
                    <UserPlus className="h-4 w-4" />
                    {joinDone === "ok" ? "가입 신청 완료" : joinRequesting ? "신청 중…" : "가입 신청"}
                  </button>
                )}
                <button onClick={handleShare} className="inline-flex min-h-[50px] items-center gap-3 border px-7 fg-display text-sm transition-transform hover:-translate-y-0.5" style={{ background: "rgba(255,255,255,0.72)", borderColor: "rgba(0,71,171,0.22)", color: "var(--primary)" }}>
                  <Share2 className="h-4 w-4" /> {copied ? "링크 복사됨" : "팀 홈 공유"}
                </button>
              </div>
              {joinDone === "err" && joinError && (
                <p className="mt-2 text-[13px]" style={{ color: "var(--destructive)" }}>
                  {joinError}
                </p>
              )}
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
                <button key={value} onClick={() => setPosition(value)} className="min-h-[44px] whitespace-nowrap border px-4 text-xs font-black transition-colors" style={{ background: position === value ? "var(--primary)" : "rgba(255,255,255,0.78)", borderColor: "rgba(0,71,171,0.18)", color: position === value ? "#fff" : "var(--primary)" }}>
                  {POSITION_LABELS[value]} {getRosterFilterCount(players, value)}
                </button>
              ))}
            </div>
          </div>

          {filteredPlayers.length === 0 ? (
            <div
              className="flex flex-col items-center gap-4 border-2 border-dashed py-16 text-center"
              style={{
                borderColor: "rgba(0,71,171,0.20)",
                background: "rgba(0,71,171,0.02)",
              }}
            >
              <p className="fg-display text-lg font-black" style={{ color: "var(--color-fg-ink)" }}>
                {players.length === 0
                  ? "팀 로스터를 꾸려보세요"
                  : "해당 포지션의 선수가 없습니다"}
              </p>
              <p className="max-w-md text-sm" style={{ color: "var(--color-fg-ink-muted)" }}>
                {players.length === 0
                  ? "선수가 등록되면 카드 로스터로 한눈에 노출됩니다."
                  : "다른 포지션 필터를 눌러보세요."}
              </p>
              {players.length === 0 && canManageTeam && (
                <Link
                  href={`/teams/${team.id}/members`}
                  className="inline-flex min-h-[44px] items-center gap-2 px-5 text-sm font-black"
                  style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
                >
                  멤버 관리로 이동 <ArrowRight className="h-4 w-4" />
                </Link>
              )}
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




      <section className="relative px-5 py-12 md:px-10">
        <div className="mx-auto max-w-[1320px] border p-5 md:p-7" style={{ background: "rgba(255,255,255,0.86)", borderColor: "rgba(0,71,171,0.14)", boxShadow: "var(--shadow-md)" }}>
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="fg-label mb-2" style={{ color: "var(--primary)" }}>TEAM SNAPSHOT</div>
              <h2 className="fg-display text-2xl font-black md:text-4xl" style={{ color: "var(--color-fg-ink)" }}>팀 기록 요약</h2>
            </div>
            <Trophy className="h-8 w-8" style={{ color: "var(--primary)" }} />
          </div>

          {/* Three scopes — season → tournament → lifetime. Only the season
              row is wired to real data right now; the others are explicit
              "준비중" rows so the structure is honest about what's coming. */}
          <div className="space-y-6">
            {/* 시즌 기록 — 실 데이터. 대회 row와 같은 패턴(좌측 시즌명 + 우측 stat). */}
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="fg-display text-base font-black md:text-lg" style={{ color: "var(--color-fg-ink)" }}>시즌 기록</h3>
                <span className="fg-mono text-[10px]" style={{ color: "var(--primary)" }}>CURRENT SEASON</span>
              </div>
              <div className="border" style={{ borderColor: "rgba(0,71,171,0.14)", background: "rgba(0,71,171,0.04)" }}>
                <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
                  <div className="md:w-48 md:shrink-0">
                    <p className="fg-label text-[10px]" style={{ color: "var(--primary)" }}>SEASON</p>
                    <p className="mt-1 fg-display text-sm font-black" style={{ color: "var(--color-fg-ink)" }}>
                      {currentSeason?.name ?? (currentSeason?.year ? `${currentSeason.year} 시즌` : "현재 시즌")}
                    </p>
                    {currentSeason?.startDate && currentSeason?.endDate && (
                      <p className="mt-0.5 text-[11px]" style={{ color: "var(--color-fg-ink-muted)" }}>
                        {currentSeason.startDate.slice(0, 10)} ~ {currentSeason.endDate.slice(0, 10)}
                      </p>
                    )}
                  </div>
                  <div className="grid flex-1 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    <StatBlock index="G" label="경기" value={team.seasonStats.gamesPlayed} />
                    <StatBlock index="R" label="승/무/패" value={`${team.seasonStats.wins}/${team.seasonStats.draws}/${team.seasonStats.losses}`} />
                    <StatBlock index="GF" label="득점" value={team.seasonStats.goalsFor || rosterInsights.totalGoals} />
                    <StatBlock index="A" label="도움" value={rosterInsights.totalAssists} />
                    <StatBlock index="ST" label="득점 리더" value={topScorer?.name ?? "-"} />
                    <StatBlock index="AS" label="도움 리더" value={topAssist?.name ?? "-"} />
                  </div>
                </div>
              </div>
            </div>

            {/* 전 대회 기록 — 대회별 row 슬롯. fetchTeamTournamentStats가 연결되면
                아래 빈 row 자리에 대회명 + 그 대회의 6 stat 가 한 줄씩 쌓인다. */}
            <div className="opacity-70">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="fg-display text-base font-black md:text-lg" style={{ color: "var(--color-fg-ink)" }}>전 대회 기록</h3>
                <span className="fg-mono text-[10px]" style={{ color: "var(--color-fg-ink-muted)" }}>준비중</span>
              </div>
              <div className="border" style={{ borderColor: "rgba(0,71,171,0.10)", background: "rgba(0,71,171,0.02)" }}>
                <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
                  <div className="md:w-48 md:shrink-0">
                    <p className="fg-label text-[10px]" style={{ color: "var(--primary)" }}>TOURNAMENT</p>
                    <p className="mt-1 fg-display text-sm font-black" style={{ color: "var(--color-fg-ink)" }}>—</p>
                    <p className="mt-0.5 text-[11px]" style={{ color: "var(--color-fg-ink-muted)" }}>참가한 대회가 있으면 여기에 대회별로 표시됩니다.</p>
                  </div>
                  <div className="grid flex-1 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    <StatBlock index="G" label="경기" value="-" />
                    <StatBlock index="R" label="승/무/패" value="-" />
                    <StatBlock index="GF" label="득점" value="-" />
                    <StatBlock index="A" label="도움" value="-" />
                    <StatBlock index="ST" label="득점 리더" value="-" />
                    <StatBlock index="AS" label="도움 리더" value="-" />
                  </div>
                </div>
              </div>
            </div>

            {/* 전체 기록 — 데이터 슬롯, 추후 fetchTeamLifetimeStats 연결 */}
            <div className="opacity-70">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="fg-display text-base font-black md:text-lg" style={{ color: "var(--color-fg-ink)" }}>전체 기록</h3>
                <span className="fg-mono text-[10px]" style={{ color: "var(--color-fg-ink-muted)" }}>준비중</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                <StatBlock index="G" label="경기" value="-" />
                <StatBlock index="R" label="승/무/패" value="-" />
                <StatBlock index="GF" label="득점" value="-" />
                <StatBlock index="A" label="도움" value="-" />
                <StatBlock index="ST" label="득점 리더" value="-" />
                <StatBlock index="AS" label="도움 리더" value="-" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Team-space: inline previews of the boards a roster member visits
          day-to-day. Same routes power editing for staff (handled inside
          each board), so this section is intentionally the same for everyone. */}
      <section className="relative px-5 py-12 md:px-10">
        <div className="mx-auto max-w-[1320px]">
          <div className="mb-8 flex items-start gap-4 md:gap-6">
            <span className="fg-mono mt-2 text-[11px]" style={{ color: "var(--primary)" }}>03</span>
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="h-2 w-2" style={{ background: "var(--primary)" }} />
                <span className="fg-label" style={{ color: "var(--primary)" }}>TEAM SPACE</span>
              </div>
              <h2 className="fg-display text-2xl font-black md:text-4xl" style={{ color: "var(--color-fg-ink)" }}>팀 공간</h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed" style={{ color: "var(--color-fg-ink-muted)" }}>
                공지를 확인하고, 자유롭게 글을 남기고, 함께 찍은 사진을 모아두세요.
              </p>
            </div>
          </div>

          {/* Notices + Board side-by-side on lg, stacked on mobile */}
          <div className="grid gap-5 lg:grid-cols-2">
            {/* 공지 게시판 */}
            <div className="border p-5 md:p-6" style={{ background: "rgba(255,255,255,0.86)", borderColor: "rgba(0,71,171,0.14)", boxShadow: "var(--shadow-sm)" }}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" style={{ color: "var(--primary)" }} />
                  <h3 className="fg-display text-lg font-black" style={{ color: "var(--color-fg-ink)" }}>공지 게시판</h3>
                </div>
                <Link href={`/teams/${team.id}/notices`} className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: "var(--primary)" }}>
                  전체 보기 <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              {notices.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm" style={{ color: "var(--color-fg-ink-muted)" }}>아직 공지가 없습니다.</p>
                  {canManageTeam && (
                    <Link href={`/teams/${team.id}/notices`} className="mt-3 inline-flex items-center gap-1 text-xs font-bold" style={{ color: "var(--primary)" }}>
                      첫 공지 작성하기 <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              ) : (
                <ul className="divide-y" style={{ borderColor: "rgba(0,71,171,0.10)" }}>
                  {notices.slice(0, 5).map((n) => (
                    <li key={n.id}>
                      <Link href={`/teams/${team.id}/notices`} className="flex items-start gap-3 py-3 transition-colors hover:bg-[rgba(0,71,171,0.04)]">
                        <span className="mt-0.5 inline-flex shrink-0 items-center px-2 py-0.5 text-[10px] font-black" style={{ background: n.isPinned ? "rgba(255,59,48,0.10)" : "rgba(0,71,171,0.08)", color: n.isPinned ? "var(--destructive)" : "var(--primary)" }}>
                          {n.isPinned ? "고정" : n.category || "공지"}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold" style={{ color: "var(--color-fg-ink)" }}>{n.title}</span>
                          <span className="mt-0.5 block text-[11px]" style={{ color: "var(--color-fg-ink-muted)" }}>
                            {n.authorName ? `${n.authorName} · ` : ""}{new Date(n.publishedAt || n.createdAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* 자유 게시판 */}
            <div className="border p-5 md:p-6" style={{ background: "rgba(255,255,255,0.86)", borderColor: "rgba(0,71,171,0.14)", boxShadow: "var(--shadow-sm)" }}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" style={{ color: "var(--primary)" }} />
                  <h3 className="fg-display text-lg font-black" style={{ color: "var(--color-fg-ink)" }}>자유 게시판</h3>
                </div>
                <Link href={`/teams/${team.id}/chat`} className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: "var(--primary)" }}>
                  전체 보기 <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              {boardPosts.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm" style={{ color: "var(--color-fg-ink-muted)" }}>아직 게시글이 없습니다.</p>
                  {currentPlayer?.teamId === team.id && (
                    <Link href={`/teams/${team.id}/chat`} className="mt-3 inline-flex items-center gap-1 text-xs font-bold" style={{ color: "var(--primary)" }}>
                      첫 글 쓰기 <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              ) : (
                <ul className="divide-y" style={{ borderColor: "rgba(0,71,171,0.10)" }}>
                  {boardPosts.slice(0, 5).map((p) => (
                    <li key={p.id}>
                      <Link href={`/teams/${team.id}/chat`} className="flex items-start gap-3 py-3 transition-colors hover:bg-[rgba(0,71,171,0.04)]">
                        <span className="mt-0.5 inline-flex shrink-0 items-center px-2 py-0.5 text-[10px] font-black" style={{ background: "rgba(0,71,171,0.08)", color: "var(--primary)" }}>
                          {p.category}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold" style={{ color: "var(--color-fg-ink)" }}>{p.title}</span>
                          <span className="mt-0.5 block text-[11px]" style={{ color: "var(--color-fg-ink-muted)" }}>
                            {p.authorName ? `${p.authorName} · ` : ""}댓글 {p.commentCount} · {new Date(p.createdAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* 갤러리 — full width */}
          <div className="mt-5 border p-5 md:p-6" style={{ background: "rgba(255,255,255,0.86)", borderColor: "rgba(0,71,171,0.14)", boxShadow: "var(--shadow-sm)" }}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" style={{ color: "var(--primary)" }} />
                <h3 className="fg-display text-lg font-black" style={{ color: "var(--color-fg-ink)" }}>갤러리</h3>
              </div>
              <Link href={`/teams/${team.id}/gallery`} className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: "var(--primary)" }}>
                전체 보기 <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {photos.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm" style={{ color: "var(--color-fg-ink-muted)" }}>아직 사진이 없습니다.</p>
                {currentPlayer?.teamId === team.id && (
                  <Link href={`/teams/${team.id}/gallery`} className="mt-3 inline-flex items-center gap-1 text-xs font-bold" style={{ color: "var(--primary)" }}>
                    첫 사진 올리기 <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
                {photos.slice(0, 8).map((photo) => (
                  <Link key={photo.id} href={`/teams/${team.id}/gallery`} className="group relative aspect-square overflow-hidden border" style={{ borderColor: "rgba(0,71,171,0.14)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.publicUrl} alt={photo.caption ?? "팀 사진"} className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-105" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* 회비 — small banner */}
          <Link href={`/teams/${team.id}/dues`} className="mt-5 flex items-center justify-between gap-3 border p-4 transition-colors hover:bg-[rgba(0,71,171,0.04)]" style={{ background: "rgba(255,255,255,0.86)", borderColor: "rgba(0,71,171,0.14)" }}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center border" style={{ background: "rgba(0,71,171,0.08)", borderColor: "rgba(0,71,171,0.18)", color: "var(--primary)" }}>
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <p className="fg-display text-sm font-black" style={{ color: "var(--color-fg-ink)" }}>
                  회비 장부
                </p>
                <p className="text-xs" style={{ color: "var(--color-fg-ink-muted)" }}>월별 회비, 미납 현황, 지출과 잔액을 한곳에서 확인합니다.</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0" style={{ color: "var(--primary)" }} />
          </Link>
        </div>
      </section>

    </main>
  );
}
