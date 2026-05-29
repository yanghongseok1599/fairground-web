"use client";

import { useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useMatchControl } from "@/hooks/useMatchControl";
import { useDataStore } from "@/stores/dataStore";
import { AdminHeader } from "@/components/admin-header";
import { AdminLoading } from "@/components/admin-loading";
import { AdminGuard } from "@/components/admin-guard";
import { CourtBackdrop } from "@/components/court-backdrop";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { formatTime } from "@/utils/formatters";
import { halfControlButtons, canStartSecondHalf } from "@/lib/match-half-control";
import type { HalfAction } from "@/lib/match-half-control";
import { useAuth } from "@/hooks/useAuth";
import { resolveMatchTrack } from "@/lib/match-operation-access";
import {
  Play,
  Pause,
  Square,
  Plus,
  Trophy,
  Undo2,
  Circle,
  Loader2,
  WifiOff,
  AlertTriangle,
  Star,
  Users,
  RotateCw,
  Maximize2,
  X,
} from "lucide-react";
import type { MatchEventType, MatchLineupEntry, Player } from "@/types";

const EVENT_TYPES: { value: MatchEventType; label: string; emoji: string }[] = [
  { value: "goal", label: "골", emoji: "⚽" },
  { value: "foul", label: "반칙", emoji: "🚫" },
  { value: "yellow_card", label: "경고", emoji: "🟨" },
  { value: "red_card", label: "퇴장", emoji: "🟥" },
];

export default function AdminMatchControlPage() {
  return (
    <AdminGuard>
      <AdminMatchControl />
    </AdminGuard>
  );
}

function AdminMatchControl() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const matchId = params.matchId as string;
  const tournamentId = searchParams.get("tournament") || "";

  const mc = useMatchControl({ tournamentId, matchId });
  const store = useDataStore();
  const { player } = useAuth();

  // 심판 전체화면 경기장 모드 토글 — 심판 트랙 + 진행중일 때 기본 진입,
  // 직접 닫고 일반 카드 레이아웃으로 되돌릴 수 있다(트랩 방지).
  const [refereeFullscreen, setRefereeFullscreen] = useState(true);

  // Lineup state (readonly view + 이벤트 선수 드롭다운 필터링)
  const [lineup, setLineup] = useState<MatchLineupEntry[]>([]);
  const [lineupLoading, setLineupLoading] = useState(true);

  useEffect(() => {
    if (!matchId) return;
    let alive = true;
    setLineupLoading(true);
    store
      .fetchMatchLineup(matchId)
      .then((rows) => {
        if (alive) setLineup(rows);
      })
      .finally(() => {
        if (alive) setLineupLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [matchId, store]);

  // Event input state
  const [eventType, setEventType] = useState<MatchEventType | "">("");
  // 가로 분할 tap-to-record 의 마지막 시도 — 실패 시 재시도 재실행용.
  const lastEventAttempt = useRef<{ type: MatchEventType; playerId: string; playerName: string; teamId: string } | null>(null);

  // MOM state
  const [momPlayerId, setMomPlayerId] = useState("");

  // End match dialog
  const [endDialogOpen, setEndDialogOpen] = useState(false);

  // Q5 — 종료 성공(경기 finished) 시에만 다이얼로그 닫음. 실패 시 유지.
  const matchFinished =
    (mc.liveMatch?.status ?? mc.match?.status) === "finished";
  useEffect(() => {
    if (matchFinished && endDialogOpen) {
      queueMicrotask(() => setEndDialogOpen(false));
    }
  }, [matchFinished, endDialogOpen]);

  if (!tournamentId) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-4">
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          대회 정보가 없습니다. 경기 목록에서 접근해주세요.
        </p>
        <Button
          className="mt-4 min-h-[44px]"
          onClick={() => router.push("/admin/matches")}
        >
          경기 목록으로
        </Button>
      </div>
    );
  }

  if (mc.loading) {
    return (
      <div
        className="min-h-screen"
        style={{ background: "var(--background)" }}
      >
        <AdminHeader title="경기 운영" />
        <AdminLoading />
      </div>
    );
  }

  if (mc.actionError && !mc.match) {
    return (
      <div
        className="min-h-screen"
        style={{ background: "var(--background)" }}
      >
        <AdminHeader title="경기 운영" />
        <div
          className="py-12 text-center text-sm"
          style={{ color: "var(--muted-foreground)" }}
          role="alert"
        >
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-red-500" />
          <p>{mc.actionError.message}</p>
          <div className="mt-4 flex justify-center gap-2">
            <Button
              variant="outline"
              className="min-h-[44px]"
              onClick={() => mc.reload()}
              disabled={mc.pendingAction === "load"}
            >
              {mc.pendingAction === "load" ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  다시 시도 중…
                </>
              ) : (
                "다시 시도"
              )}
            </Button>
            <Button
              className="min-h-[44px]"
              onClick={() => router.push("/admin/matches")}
            >
              경기 목록으로
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const matchData = mc.liveMatch || mc.match;
  if (!matchData) return null;

  const isScheduled = matchData.status === "scheduled";
  const isLive = matchData.status === "live";
  const isFinished = matchData.status === "finished";

  // 경기운영 진입 트랙 — AdminGuard 통과이므로 "admin" 또는 "referee".
  // 심판은 진행중 경기를 전체화면 경기장 한 화면에서 운영한다.
  const track = resolveMatchTrack(player, matchData);
  const isRefereeFullscreen = track === "referee" && isLive && refereeFullscreen;

  const homeScore = mc.liveMatch?.homeScore ?? matchData.homeScore;
  const awayScore = mc.liveMatch?.awayScore ?? matchData.awayScore;

  // Lineup-by-team 분리 (메모)
  const homeLineup = lineup.filter((e) => e.teamId === matchData.homeTeamId);
  const awayLineup = lineup.filter((e) => e.teamId === matchData.awayTeamId);

  // 가로 분할용 — 양 팀 각각의 출전 가능 선수 목록(라인업 우선, 없으면 전체).
  const homeLineupIds = new Set(homeLineup.map((e) => e.playerId));
  const awayLineupIds = new Set(awayLineup.map((e) => e.playerId));
  const homeActivePlayers: Player[] =
    homeLineup.length > 0
      ? mc.homePlayers.filter((p) => homeLineupIds.has(p.id))
      : mc.homePlayers;
  const awayActivePlayers: Player[] =
    awayLineup.length > 0
      ? mc.awayPlayers.filter((p) => awayLineupIds.has(p.id))
      : mc.awayPlayers;

  // All players for MOM selection (라인업 있으면 양 팀 라인업 합집합)
  const allLineupIds = new Set(lineup.map((e) => e.playerId));
  const allTeamMembers = [...mc.homePlayers, ...mc.awayPlayers];
  const allPlayers: Player[] =
    lineup.length > 0
      ? allTeamMembers.filter((p) => allLineupIds.has(p.id))
      : allTeamMembers;

  // ── 경기 대시보드 집계 ──────────────────────────────────────────
  // 취소되지 않은 이벤트만 집계.
  const liveEvents = mc.events.filter((e) => !e.isCancelled);
  const teamTally = (teamId: string) => ({
    goals: liveEvents.filter((e) => e.teamId === teamId && e.type === "goal").length,
    assists: liveEvents.filter((e) => e.teamId === teamId && e.type === "assist").length,
    fouls: liveEvents.filter((e) => e.teamId === teamId && e.type === "foul").length,
    yellow: liveEvents.filter((e) => e.teamId === teamId && e.type === "yellow_card").length,
    red: liveEvents.filter((e) => e.teamId === teamId && e.type === "red_card").length,
  });
  const homeTally = teamTally(matchData.homeTeamId);
  const awayTally = teamTally(matchData.awayTeamId);
  const playerStat = (pid: string, type: MatchEventType) =>
    liveEvents.filter((e) => e.playerId === pid && e.type === type).length;

  // 출전(코트)·대기(벤치) 선수 분리 — 라인업 제출 시 선발/교체, 아니면 전원 출전.
  const toPlayers = (entries: MatchLineupEntry[], pool: Player[]): Player[] =>
    entries
      .map((e) => pool.find((p) => p.id === e.playerId))
      .filter((p): p is Player => Boolean(p));
  const homeOnCourt =
    homeLineup.length > 0
      ? toPlayers(homeLineup.filter((e) => e.isStarter), mc.homePlayers)
      : homeActivePlayers;
  const homeBench =
    homeLineup.length > 0 ? toPlayers(homeLineup.filter((e) => !e.isStarter), mc.homePlayers) : [];
  const awayOnCourt =
    awayLineup.length > 0
      ? toPlayers(awayLineup.filter((e) => e.isStarter), mc.awayPlayers)
      : awayActivePlayers;
  const awayBench =
    awayLineup.length > 0 ? toPlayers(awayLineup.filter((e) => !e.isStarter), mc.awayPlayers) : [];

  const homeSide = {
    side: "home" as const,
    name: matchData.homeTeamName,
    id: matchData.homeTeamId,
    score: homeScore,
    tally: homeTally,
    onCourt: homeOnCourt,
    bench: homeBench,
  };
  const awaySide = {
    side: "away" as const,
    name: matchData.awayTeamName,
    id: matchData.awayTeamId,
    score: awayScore,
    tally: awayTally,
    onCourt: awayOnCourt,
    bench: awayBench,
  };

  // 가로 분할 모델 — 선택된 이벤트 유형으로 특정 선수+팀에 즉시 기록.
  // 유형은 유지(연속 동일 이벤트 빠른 기록). 유형 미선택 시 무시.
  const recordPlayerEvent = async (player: Player, teamId: string) => {
    if (!eventType || mc.pendingAction !== null) return;
    const payload = { type: eventType, playerId: player.id, playerName: player.name, teamId };
    lastEventAttempt.current = payload; // 실패 시 재시도용
    await mc.addEvent(payload);
  };

  // 이벤트 기록 실패 시 재시도 — 마지막 시도 payload 재실행.
  const retryLastEvent = async () => {
    const last = lastEventAttempt.current;
    if (!last) return;
    await mc.addEvent(last);
  };

  const handleSetMom = async () => {
    if (!momPlayerId) return;
    const ok = await mc.setMom(momPlayerId);
    if (ok) setMomPlayerId("");
  };

  const handleEndMatch = async () => {
    // Q5 — endMatch 는 runAction 가드로 재진입 차단됨. 성공 시에만 다이얼로그 닫고,
    // 실패 시 다이얼로그 유지 + 위치별 에러를 다이얼로그 내에서 노출(재시도 가능).
    await mc.endMatch();
  };

  const endPending = mc.pendingAction === "end";

  // A10 — 실패 위치 라벨 (이벤트/MOM/종료 구분된 메시지)
  const scopeLabel = (scope: string): string => {
    switch (scope) {
      case "load":
        return "데이터 불러오기";
      case "start":
        return "경기 시작";
      case "pause":
        return "일시정지";
      case "resume":
        return "재개";
      case "secondHalf":
        return "후반 시작";
      case "end":
        return "경기 종료";
      case "event":
        return "이벤트 기록";
      case "cancelEvent":
        return "이벤트 취소";
      case "mom":
        return "MOM 선정";
      default:
        return "작업";
    }
  };

  // 위치별 재시도 핸들러 (재시도 의미 없는 스코프는 null)
  const retryForScope = (scope: string): (() => void) | null => {
    switch (scope) {
      case "load":
        return () => mc.reload();
      case "start":
        return () => mc.startMatch();
      case "pause":
        return () => mc.pauseMatch();
      case "resume":
        return () => mc.resumeMatch();
      case "secondHalf":
        return () => mc.startSecondHalf();
      case "event":
        return () => retryLastEvent();
      case "mom":
        return () => handleSetMom();
      default:
        return null;
    }
  };

  const eventEmoji = (type: string) => {
    switch (type) {
      case "goal":
        return "⚽";
      case "assist":
        return "🅰️";
      case "foul":
        return "🚫";
      case "yellow_card":
        return "🟨";
      case "red_card":
        return "🟥";
      case "mom":
        return "⭐";
      default:
        return "📝";
    }
  };

  const eventLabel = (type: string) => {
    switch (type) {
      case "goal":
        return "골";
      case "assist":
        return "어시스트";
      case "foul":
        return "반칙";
      case "yellow_card":
        return "경고";
      case "red_card":
        return "퇴장";
      case "mom":
        return "MOM";
      default:
        return type;
    }
  };

  // ── 타이머 중심 전광판 (7a) ─────────────────────────────────────
  // [HOME 이름+점수] [중앙: 시간·전후반·라이브닷·상태] [AWAY 점수+이름]
  // dark=전체화면 코트 위 오버레이용(어두운 배경/흰 글자).
  const renderScoreboardRow = (dark: boolean) => {
    const nameColor = dark
      ? { color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.7)" }
      : undefined;
    const dimColor = dark
      ? { color: "rgba(255,255,255,0.7)" }
      : { color: "var(--muted-foreground)" };
    return (
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        {/* HOME 이름 + 점수 (왼쪽) */}
        <div className="flex min-w-0 items-center justify-end gap-2 text-right">
          <span className="truncate text-sm font-bold" style={nameColor}>
            {matchData.homeTeamName}
          </span>
          <span
            className="text-3xl font-black leading-none tabular-nums"
            style={nameColor}
          >
            {homeScore}
          </span>
        </div>
        {/* CENTER: 라이브닷 + 시간 + 전후반 + 상태 */}
        <div className="flex flex-col items-center px-2">
          <div className="flex items-center gap-1.5">
            {isLive && (
              <Circle
                className={`h-2 w-2 fill-current ${mc.isRunning ? "animate-pulse text-red-500" : "text-amber-500"}`}
              />
            )}
            <span
              className="text-lg font-black tabular-nums"
              style={nameColor}
            >
              {formatTime(mc.elapsedSeconds)}
            </span>
          </div>
          <span
            className="text-[11px] font-semibold tabular-nums"
            style={dimColor}
          >
            {mc.currentHalf === 1 ? "전반" : "후반"}
          </span>
          <Badge
            className={`mt-1 ${
              isLive
                ? "bg-red-100 text-red-700"
                : isFinished
                  ? "bg-gray-100 text-gray-700"
                  : "bg-blue-100 text-blue-700"
            }`}
          >
            {isScheduled ? "예정" : isLive ? "진행중" : "종료"}
          </Badge>
        </div>
        {/* AWAY 점수 + 이름 (오른쪽) */}
        <div className="flex min-w-0 items-center justify-start gap-2 text-left">
          <span
            className="text-3xl font-black leading-none tabular-nums"
            style={nameColor}
          >
            {awayScore}
          </span>
          <span className="truncate text-sm font-bold" style={nameColor}>
            {matchData.awayTeamName}
          </span>
        </div>
      </div>
    );
  };

  // 4단계 진행버튼(전반 시작/종료 · 후반 시작/종료) — 일반·전체화면 공용.
  const renderProgressButtons = () => {
    const progress = {
      status: matchData.status,
      currentHalf: mc.currentHalf,
      isRunning: mc.isRunning,
    };
    const runHalf = (a: HalfAction) => {
      if (a === "startFirst") return mc.startMatch();
      if (a === "pause") return mc.pauseMatch();
      if (a === "resume") return mc.resumeMatch();
      if (a === "startSecond") return mc.startSecondHalf();
      if (a === "endMatch") return setEndDialogOpen(true);
    };
    const buttons = halfControlButtons(progress);
    if (buttons.length === 0 && !canStartSecondHalf(progress)) return null;
    return (
      <div className="flex flex-wrap items-center justify-center gap-2">
        {buttons.map((b) => (
          <Button
            key={b.id}
            onClick={() => runHalf(b.action)}
            disabled={mc.pendingAction !== null}
            className="min-h-[44px] px-5"
            variant={
              b.variant === "danger"
                ? "destructive"
                : b.variant === "secondary"
                  ? "secondary"
                  : "default"
            }
          >
            {mc.pendingAction !== null ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : null}
            {b.label}
          </Button>
        ))}
        {canStartSecondHalf(progress) && (
          <Button
            onClick={() => mc.startSecondHalf()}
            variant="outline"
            className="min-h-[44px] px-5"
            disabled={mc.pendingAction !== null}
          >
            {mc.pendingAction !== null && (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            )}
            후반 시작
          </Button>
        )}
      </div>
    );
  };

  // 이벤트 유형 4종 그리드 — 일반·전체화면 공용. dark=어두운 배경용.
  const renderEventTypeGrid = (dark: boolean) => (
    <div className="grid grid-cols-4 gap-1.5">
      {EVENT_TYPES.map((et) => (
        <button
          key={et.value}
          className={`min-h-[44px] rounded-lg border py-2 text-center text-xs transition-all ${
            dark ? "border-white/25 text-white" : ""
          }`}
          style={
            eventType === et.value
              ? dark
                ? {
                    borderColor: "var(--accent-gold)",
                    background: "rgba(212,160,23,0.25)",
                    fontWeight: 600,
                  }
                : {
                    borderColor: "var(--accent-gold)",
                    background: "var(--secondary)",
                    fontWeight: 600,
                  }
              : undefined
          }
          onClick={() => setEventType(eventType === et.value ? "" : et.value)}
          aria-pressed={eventType === et.value}
        >
          <div className="text-base">{et.emoji}</div>
          <div className="mt-0.5">{et.label}</div>
        </button>
      ))}
    </div>
  );

  // 코트 대시보드(녹색 코트 + 양팀 포메이션 + 시계 오버레이) — 일반·전체화면 공용.
  // overlay: 코트 상단 중앙에 띄울 노드(전체화면에선 전광판).
  // homeOnGrass: true 면 홈 포메이션도 코트 홈 칸에 직접 띄운다(전체화면 전용).
  //   일반 레이아웃에선 홈 포메이션을 코트 위(별도 FormationControls 스트립)에 두므로 false.
  const renderCourt = (opts?: { overlay?: ReactNode; homeOnGrass?: boolean }) => (
    <div className="relative h-full w-full overflow-hidden rounded-xl">
      <CourtBackdrop />
      {opts?.overlay ?? (
        <div className="pointer-events-none absolute left-1/2 top-2 z-20 -translate-x-1/2">
          <div
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-black tabular-nums shadow-lg"
            style={{ background: "rgba(8,20,12,0.78)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)" }}
          >
            {isLive && (
              <Circle
                className={`h-2 w-2 fill-current ${mc.isRunning ? "animate-pulse text-red-400" : "text-amber-400"}`}
              />
            )}
            <span>{formatTime(mc.elapsedSeconds)}</span>
            <span className="text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.75)" }}>
              {mc.currentHalf === 1 ? "전반" : "후반"}
            </span>
          </div>
        </div>
      )}
      <div className="absolute inset-0 z-10 grid grid-cols-1 grid-rows-2 landscape:grid-cols-2 landscape:grid-rows-1 md:grid-cols-2 md:grid-rows-1">
        {/* 홈 칸 — 전체화면(homeOnGrass)에선 잔디 위 홈 포메이션, 아니면 정보 스트립만 */}
        {opts?.homeOnGrass ? (
          <div className="relative h-full w-full">
            {/* 홈 누적 스탯 — 좌상단 코너(팀명·점수는 상단 전광판 오버레이가 표시) */}
            <div className="absolute left-2 top-1 z-20 flex flex-wrap gap-1">
              {[
                { e: "⚽", n: homeSide.tally.goals },
                { e: "🅰️", n: homeSide.tally.assists },
                { e: "🚫", n: homeSide.tally.fouls },
                { e: "🟨", n: homeSide.tally.yellow },
                { e: "🟥", n: homeSide.tally.red },
              ].map((it, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums"
                  style={{ background: "rgba(8,20,12,0.6)", color: "#fff" }}
                >
                  <span aria-hidden>{it.e}</span>
                  <span>{it.n}</span>
                </span>
              ))}
            </div>
            <FormationControls
              team={homeSide}
              isAway={false}
              eventType={eventType}
              pending={mc.pendingAction !== null}
              onRecord={recordPlayerEvent}
              playerStat={playerStat}
              onGrass
            />
          </div>
        ) : (
          <PitchFormation
            team={homeSide}
            eventType={eventType}
            pending={mc.pendingAction !== null}
            onRecord={recordPlayerEvent}
            playerStat={playerStat}
          />
        )}
        {/* 어웨이 칸 — 항상 잔디 위 포메이션(PitchFormation 내부에서 처리) */}
        <PitchFormation
          team={awaySide}
          eventType={eventType}
          pending={mc.pendingAction !== null}
          onRecord={recordPlayerEvent}
          playerStat={playerStat}
        />
      </div>
    </div>
  );

  const renderBench = () => (
    <div className="grid grid-cols-2 gap-2">
      {[homeSide, awaySide].map((team) => (
        <BenchStrip
          key={team.side}
          team={team}
          eventType={eventType}
          pending={mc.pendingAction !== null}
          onRecord={recordPlayerEvent}
          playerStat={playerStat}
        />
      ))}
    </div>
  );

  // ── 심판 전체화면 경기장 모드 (7b) ───────────────────────────────
  // 진행중 경기를 한 화면에서: 상단 전광판 오버레이가 떠 있는 코트(flex-1) +
  // 하단 컨트롤바(이벤트 유형 4종 · 4단계 진행버튼) + 벤치. 좌상단 닫기 버튼.
  if (isRefereeFullscreen) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col bg-black text-white">
        {!mc.isOnline && (
          <div
            role="status"
            className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-1.5 text-sm font-semibold text-white"
          >
            <WifiOff className="h-4 w-4" />
            오프라인 — 네트워크 복구 시 기록을 다시 시도하세요
          </div>
        )}

        {/* 코트 영역 — 남는 공간 전부. 상단 중앙에 타이머 중심 전광판 오버레이.
            홈·어웨이 모두 잔디 위에 배치(homeOnGrass)해 심판이 한 화면에서 양팀을 탭. */}
        <div className="relative min-h-0 flex-1">
          {renderCourt({
            homeOnGrass: true,
            overlay: (
              <div className="absolute left-1/2 top-2 z-20 w-[min(92%,640px)] -translate-x-1/2">
                <div
                  className="rounded-2xl px-3 py-2 shadow-lg"
                  style={{
                    background: "rgba(8,20,12,0.82)",
                    border: "1px solid rgba(255,255,255,0.22)",
                  }}
                >
                  {renderScoreboardRow(true)}
                </div>
              </div>
            ),
          })}

          {/* 닫기 — 전체화면 종료(트랩 방지) */}
          <button
            type="button"
            onClick={() => setRefereeFullscreen(false)}
            className="absolute right-2 top-2 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white shadow-lg"
            aria-label="전체화면 종료"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 하단 컨트롤바 — 이벤트 유형 + 안내 + 4단계 진행버튼 + 벤치 */}
        <div className="max-h-[46vh] shrink-0 space-y-2 overflow-y-auto border-t border-white/15 bg-neutral-950/95 px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2">
          {renderEventTypeGrid(true)}
          <p className="text-center text-[11px] text-white/70">
            {eventType ? "선수를 탭하면 즉시 기록됩니다" : "이벤트 유형을 먼저 선택하세요"}
          </p>
          {mc.pendingAction === "event" && (
            <p className="flex items-center justify-center gap-1.5 text-xs text-white/70">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> 기록 처리중…
            </p>
          )}
          {renderBench()}
          <div className="border-t border-white/15 pt-2">{renderProgressButtons()}</div>

          {/* 위치별 에러(종료 제외) — 전체화면 안에서도 재시도 가능 */}
          {mc.actionError && mc.actionError.scope !== "end" && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-red-400/50 bg-red-500/15 p-2.5 text-sm"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <div className="flex-1">
                <p className="font-semibold text-red-300">
                  {scopeLabel(mc.actionError.scope)} 실패
                </p>
                <p className="mt-0.5 text-red-200">{mc.actionError.message}</p>
                <div className="mt-1.5 flex gap-2">
                  {retryForScope(mc.actionError.scope) && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-[40px] border-red-400/50 text-red-100"
                      onClick={retryForScope(mc.actionError.scope)!}
                      disabled={mc.pendingAction !== null}
                    >
                      다시 시도
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="min-h-[40px] text-white/80"
                    onClick={mc.clearError}
                  >
                    닫기
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 경기 종료 확인 — 전체화면에서도 동일 다이얼로그 사용 */}
        <Dialog
          open={endDialogOpen}
          onOpenChange={(open) => {
            if (endPending) return;
            setEndDialogOpen(open);
          }}
        >
          <DialogContent
            onEscapeKeyDown={(e) => {
              if (endPending) e.preventDefault();
            }}
            onInteractOutside={(e) => {
              if (endPending) e.preventDefault();
            }}
          >
            <DialogHeader>
              <DialogTitle>경기를 종료하시겠습니까?</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="rounded-lg border p-4 text-center">
                <div className="mb-2 text-sm" style={{ color: "var(--muted-foreground)" }}>
                  최종 스코어
                </div>
                <div className="flex items-center justify-center gap-3">
                  <div>
                    <div className="text-sm font-medium">{matchData.homeTeamName}</div>
                    <div className="text-3xl font-black">{homeScore}</div>
                  </div>
                  <span className="text-xl" style={{ color: "var(--muted-foreground)" }}>
                    :
                  </span>
                  <div>
                    <div className="text-sm font-medium">{matchData.awayTeamName}</div>
                    <div className="text-3xl font-black">{awayScore}</div>
                  </div>
                </div>
              </div>
              {mc.actionError && mc.actionError.scope === "end" && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  <span className="text-red-700">
                    {mc.actionError.message} 다시 시도해주세요.
                  </span>
                </div>
              )}
              <Separator />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="min-h-[44px] flex-1"
                  onClick={() => setEndDialogOpen(false)}
                  disabled={endPending}
                >
                  취소
                </Button>
                <Button
                  variant="destructive"
                  className="min-h-[44px] flex-1"
                  onClick={handleEndMatch}
                  disabled={mc.pendingAction !== null}
                  aria-busy={endPending}
                >
                  {endPending ? (
                    <>
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      종료 처리중…
                    </>
                  ) : (
                    "경기 종료"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-8" style={{ background: "var(--background)" }}>
      <AdminHeader title="경기 운영" />

      {/* 오프라인 인지 배너 — 고정, role=status */}
      {!mc.isOnline && (
        <div
          role="status"
          className="sticky top-14 z-20 flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-sm font-semibold text-white"
        >
          <WifiOff className="h-4 w-4" />
          오프라인 — 네트워크 복구 시 기록을 다시 시도하세요
        </div>
      )}

      {/* 가로 모드 권장 안내 — 모바일 세로(portrait)에서만 노출. 가로로 돌리면
          타이머·점수·이벤트 기록이 한 화면에 넓게 들어와 경기 운영이 편하다. */}
      <div className="portrait:flex landscape:hidden md:hidden items-center justify-center gap-2 bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">
        <RotateCw className="h-4 w-4" />
        가로로 돌리면 더 편하게 경기를 운영할 수 있어요
      </div>

      {/* 홈 팀 출전 선수 — 코트 카드 밖 전체 너비(브라우저 프리뷰 DOM 순서 반영) */}
      {isLive && (
        <FormationControls
          team={homeSide}
          isAway={false}
          eventType={eventType}
          pending={mc.pendingAction !== null}
          onRecord={recordPlayerEvent}
          playerStat={playerStat}
        />
      )}

      {/* 경기 운영 컨테이너 — 세로는 max-w-md, 가로(landscape)·데스크탑은
          더 넓게 펼쳐 타이머/스코어/이벤트 영역을 여유 있게 배치. */}
      <div className="mx-auto max-w-md landscape:max-w-5xl md:max-w-3xl space-y-4 p-4">
        {/* 스코어보드 — 점수·경기시간·전후반·팀별 골/어시/반칙/경고/퇴장을 한눈에.
            아래 컨트롤 행으로 시작/일시정지/재개/후반/종료까지 한 카드에서 운영. */}
        <Card style={{ borderColor: "var(--accent-gold)" }}>
          <CardContent className="py-3">
            {/* 타이머 중심 전광판 (7a) — 시간이 가운데, 양옆에 팀 이름+점수 */}
            {renderScoreboardRow(false)}

            {/* 팀별 누적 스탯(골/어시/반칙/경고/퇴장) */}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="min-w-0">
                <StatPills tally={homeTally} />
              </div>
              <div className="flex min-w-0 justify-end">
                <StatPills tally={awayTally} />
              </div>
            </div>

            {/* 심판이 전체화면을 닫았을 때 다시 진입 */}
            {track === "referee" && isLive && (
              <div className="mt-3 flex justify-center border-t pt-3">
                <Button
                  variant="secondary"
                  className="min-h-[44px] px-5"
                  onClick={() => setRefereeFullscreen(true)}
                >
                  <Maximize2 className="mr-1.5 h-4 w-4" />
                  전체화면 경기장 모드
                </Button>
              </div>
            )}

            {/* 컨트롤 행 — 4단계 진행버튼(전반 시작/종료 · 후반 시작/종료). */}
            {(() => {
              const progress = {
                status: matchData.status,
                currentHalf: mc.currentHalf,
                isRunning: mc.isRunning,
              };
              const hasButtons =
                halfControlButtons(progress).length > 0 || canStartSecondHalf(progress);
              if (!hasButtons) return null;
              return (
                <div className="mt-3 border-t pt-3">{renderProgressButtons()}</div>
              );
            })()}
          </CardContent>
        </Card>

        {/* 위치별 에러 — role=alert, 색+아이콘+텍스트, 재시도 (A10) */}
        {mc.actionError && mc.actionError.scope !== "end" && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-3"
          >
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-red-700">
                {scopeLabel(mc.actionError.scope)} 실패
              </p>
              <p className="mt-0.5 text-red-600">{mc.actionError.message}</p>
              <div className="mt-2 flex gap-2">
                {retryForScope(mc.actionError.scope) && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-[44px] border-red-300"
                    onClick={retryForScope(mc.actionError.scope)!}
                    disabled={mc.pendingAction !== null}
                  >
                    {mc.pendingAction !== null ? (
                      <>
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        재시도 중…
                      </>
                    ) : (
                      "다시 시도"
                    )}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="min-h-[44px]"
                  onClick={mc.clearError}
                >
                  닫기
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 출전 명단 (readonly) — 경기 전(예정)에만. 진행 중엔 아래 코트 대시보드에서 번호 확인 */}
        {isScheduled && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4" />
                출전 명단
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {lineupLoading ? (
                <div
                  className="flex items-center justify-center py-4 text-xs"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  명단 로드 중…
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <LineupReadonlyCard
                    teamName={matchData.homeTeamName}
                    entries={homeLineup}
                  />
                  <LineupReadonlyCard
                    teamName={matchData.awayTeamName}
                    entries={awayLineup}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Event Input - only during live */}
        {isLive && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Plus className="h-4 w-4" />
                이벤트 입력
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* 이벤트 유형 선택 (공유) — 선택 후 아래 양팀 선수 칩을 탭하면 즉시
                  기록. 유형은 유지돼 연속 기록(여러 반칙 등)이 빠르다. */}
              <div className="space-y-1">
                <label
                  className="text-xs font-medium"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  ① 이벤트 유형 선택
                </label>
                {renderEventTypeGrid(false)}
              </div>

              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                ② {eventType ? "선수를 탭하면 즉시 기록됩니다" : "먼저 이벤트 유형을 선택하세요"}
              </p>

              {/* 실제 구장 비율(2:1) 녹색 코트 위 양팀 출전/대기 번호 대시보드.
                  유형 선택 후 선수 칩을 탭하면 즉시 기록. 칩에는 골/어시/경고/퇴장 배지 표시. */}
              <div className="relative mx-auto aspect-[3/4] max-h-[62vh] w-full rounded-xl landscape:aspect-[2/1] md:aspect-[2/1]">
                {renderCourt()}
              </div>

              {/* 대기선수 — 경기장 밖, 팀별 원형 번호 토큰 */}
              {renderBench()}

              {mc.pendingAction === "event" && (
                <p className="flex items-center justify-center gap-1.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> 기록 처리중…
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Event Timeline */}
        {mc.events.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">이벤트 타임라인</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {mc.events.map((event) => (
                  <div
                    key={event.id}
                    className={`flex items-center gap-3 rounded-lg border p-2.5 ${
                      event.isCancelled ? "opacity-50" : ""
                    }`}
                  >
                    <div className="text-lg">{eventEmoji(event.type)}</div>
                    <div className="flex-1">
                      <div
                        className={`text-sm font-medium ${
                          event.isCancelled ? "line-through" : ""
                        }`}
                      >
                        {event.playerName}
                      </div>
                      <div
                        className="flex items-center gap-1.5 text-[10px]"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        <span>{eventLabel(event.type)}</span>
                        <span>·</span>
                        <span>
                          {event.half === 1 ? "전반" : "후반"} {event.minute}분
                        </span>
                        {event.isCancelled && (
                          <>
                            <span>·</span>
                            <span className="text-red-500">취소됨</span>
                          </>
                        )}
                      </div>
                    </div>
                    {isLive && !event.isCancelled && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-11 w-11 shrink-0 hover:text-red-500"
                        style={{ color: "var(--muted-foreground)" }}
                        onClick={() => mc.cancelEvent(event.id)}
                        disabled={mc.pendingAction !== null}
                        aria-busy={mc.pendingAction === "cancelEvent"}
                        aria-label={`${event.playerName} ${eventLabel(event.type)} 기록 취소`}
                      >
                        {mc.pendingAction === "cancelEvent" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Undo2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* MOM Selection - during or after match */}
        {(isLive || isFinished) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy
                  className="h-4 w-4"
                  style={{ color: "var(--accent-gold)" }}
                />
                MOM 선정
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {matchData.momPlayerId && (
                <p className="text-sm">
                  현재 MOM:{" "}
                  <span className="font-bold">
                    {allPlayers.find((p) => p.id === matchData.momPlayerId)
                      ?.name || matchData.momPlayerId}
                  </span>
                </p>
              )}
              <div className="flex gap-2">
                <Select
                  value={momPlayerId}
                  onValueChange={setMomPlayerId}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="MOM 선수 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {allPlayers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        #{p.number} {p.name} ({p.position}) -{" "}
                        {p.teamId === matchData.homeTeamId
                          ? matchData.homeTeamName
                          : matchData.awayTeamName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleSetMom}
                  disabled={!momPlayerId || mc.pendingAction !== null}
                  aria-busy={mc.pendingAction === "mom"}
                  variant="outline"
                  className="min-h-[44px] px-5"
                >
                  {mc.pendingAction === "mom" ? (
                    <>
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      처리중…
                    </>
                  ) : (
                    "선정"
                  )}
                </Button>
              </div>
              <p
                className="text-xs"
                style={{ color: "var(--muted-foreground)" }}
              >
                MOM은 프리미엄 카드 레이팅에 반영됩니다 (MOM x 3점)
              </p>
            </CardContent>
          </Card>
        )}

        {/* 경기 종료 확인 — 포커스 트랩 모달(Radix, ESC 취소 내장).
            종료 처리 중에는 외부클릭/ESC 로 닫히지 않도록 가드(더블집계 방지). */}
        <Dialog
          open={endDialogOpen}
          onOpenChange={(open) => {
            if (endPending) return; // 처리 중 닫기 차단
            setEndDialogOpen(open);
          }}
        >
          <DialogContent
            onEscapeKeyDown={(e) => {
              if (endPending) e.preventDefault();
            }}
            onInteractOutside={(e) => {
              if (endPending) e.preventDefault();
            }}
          >
            <DialogHeader>
              <DialogTitle>경기를 종료하시겠습니까?</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="rounded-lg border p-4 text-center">
                <div
                  className="mb-2 text-sm"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  최종 스코어
                </div>
                <div className="flex items-center justify-center gap-3">
                  <div>
                    <div className="text-sm font-medium">
                      {matchData.homeTeamName}
                    </div>
                    <div className="text-3xl font-black">{homeScore}</div>
                  </div>
                  <span
                    className="text-xl"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    :
                  </span>
                  <div>
                    <div className="text-sm font-medium">
                      {matchData.awayTeamName}
                    </div>
                    <div className="text-3xl font-black">{awayScore}</div>
                  </div>
                </div>
              </div>
              <p
                className="text-center text-xs"
                style={{ color: "var(--muted-foreground)" }}
              >
                경기 종료 시 모든 선수의 스탯(경기수, 골, 어시스트, MOM,
                경고)이 자동으로 업데이트됩니다. 프리미엄 카드 선수의 레이팅이
                재계산됩니다.
              </p>
              {/* 종료 실패 시 다이얼로그 내 위치별 에러 — 닫히지 않고 재시도 */}
              {mc.actionError && mc.actionError.scope === "end" && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  <span className="text-red-700">
                    {mc.actionError.message} 다시 시도해주세요.
                  </span>
                </div>
              )}

              <Separator />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="min-h-[44px] flex-1"
                  onClick={() => setEndDialogOpen(false)}
                  disabled={endPending}
                >
                  취소
                </Button>
                <Button
                  variant="destructive"
                  className="min-h-[44px] flex-1"
                  onClick={handleEndMatch}
                  disabled={mc.pendingAction !== null}
                  aria-busy={endPending}
                >
                  {endPending ? (
                    <>
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      종료 처리중…
                    </>
                  ) : (
                    "경기 종료"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

type Tally = { goals: number; assists: number; fouls: number; yellow: number; red: number };

type TeamSide = {
  side: "home" | "away";
  name: string;
  id: string;
  score: number;
  tally: Tally;
  onCourt: Player[];
  bench: Player[];
};

/** 스코어보드용 팀 누적 스탯 알약 — 골/어시/반칙/경고/퇴장. */
function StatPills({ tally }: { tally: Tally }) {
  const items: { e: string; n: number; label: string }[] = [
    { e: "⚽", n: tally.goals, label: "골" },
    { e: "🅰️", n: tally.assists, label: "어시스트" },
    { e: "🚫", n: tally.fouls, label: "반칙" },
    { e: "🟨", n: tally.yellow, label: "경고" },
    { e: "🟥", n: tally.red, label: "퇴장" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-1">
      {items.map((it) => (
        <span
          key={it.label}
          className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums"
          style={{ background: "var(--secondary)", color: "var(--foreground)" }}
          title={`${it.label} ${it.n}`}
        >
          <span aria-hidden>{it.e}</span>
          <span>{it.n}</span>
        </span>
      ))}
    </div>
  );
}

type Accent = { bg: string; fg: string; ring: string };
const teamAccent = (side: "home" | "away"): Accent =>
  side === "away"
    ? { bg: "#b91c1c", fg: "#fff", ring: "rgba(255,255,255,0.92)" }
    : { bg: "#1d4ed8", fg: "#fff", ring: "rgba(255,255,255,0.92)" };

/** 선수 원형 번호 토큰 — 번호를 큰 원으로, 아래 이름. 탭하면 선택 이벤트 기록.
    골(⚽n)·경고(🟨)·퇴장(🟥)을 토큰 위 배지로 표시. onGrass=잔디 위(흰 이름). */
function PlayerToken({
  player,
  teamId,
  eventType,
  pending,
  onRecord,
  playerStat,
  accent,
  onGrass,
}: {
  player: Player;
  teamId: string;
  eventType: MatchEventType | "";
  pending: boolean;
  onRecord: (player: Player, teamId: string) => void | Promise<void>;
  playerStat: (pid: string, type: MatchEventType) => number;
  accent: Accent;
  onGrass: boolean;
}) {
  const g = playerStat(player.id, "goal");
  const y = playerStat(player.id, "yellow_card");
  const r = playerStat(player.id, "red_card");
  return (
    <button
      type="button"
      onClick={() => void onRecord(player, teamId)}
      disabled={!eventType || pending}
      className="flex flex-col items-center gap-0.5 transition disabled:opacity-50"
      title={eventType ? `#${player.number} ${player.name} 기록` : `#${player.number} ${player.name}`}
    >
      <span
        className={`relative flex items-center justify-center rounded-full border-2 font-black tabular-nums shadow-md ${
          onGrass ? "h-11 w-11 text-base" : "h-9 w-9 text-sm"
        }`}
        style={{ background: accent.bg, color: accent.fg, borderColor: accent.ring }}
      >
        {player.number}
        {r > 0 ? (
          <span
            className="absolute -right-1 -top-1 h-3.5 w-2.5 rounded-[2px]"
            style={{ background: "#dc2626", border: "1px solid #fff" }}
          />
        ) : y > 0 ? (
          <span
            className="absolute -right-1 -top-1 h-3.5 w-2.5 rounded-[2px]"
            style={{ background: "#facc15", border: "1px solid #fff" }}
          />
        ) : null}
        {g > 0 && (
          <span
            className="absolute -bottom-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-[9px] font-bold"
            style={{ background: "#fff", color: "#0d1b2a", border: "1px solid rgba(0,0,0,0.2)" }}
          >
            ⚽{g > 1 ? g : ""}
          </span>
        )}
      </span>
      <span
        className="max-w-[72px] truncate text-[10px] font-semibold"
        style={
          onGrass
            ? { color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,0.85)" }
            : { color: "var(--foreground)" }
        }
      >
        {player.name}
      </span>
    </button>
  );
}

/** 출전 선수 포메이션 — GK·수비·공격 라인. 홈은 페이지 상단, 원정은 코트 안. */
function FormationControls({
  team,
  isAway,
  eventType,
  pending,
  onRecord,
  playerStat,
  onGrass,
}: {
  team: TeamSide;
  isAway: boolean;
  eventType: MatchEventType | "";
  pending: boolean;
  onRecord: (player: Player, teamId: string) => void | Promise<void>;
  playerStat: (pid: string, type: MatchEventType) => number;
  // 잔디 위 흰 텍스트 토큰 여부 — 미지정 시 isAway(원정만 잔디) 기준.
  // 전체화면 모드에선 홈도 코트 잔디 위에 배치하므로 true 로 강제.
  onGrass?: boolean;
}) {
  const accent = teamAccent(team.side);
  const grass = onGrass ?? isAway;
  const five = [...team.onCourt]
    .sort((a, b) => (a.position === "GK" ? -1 : 0) - (b.position === "GK" ? -1 : 0))
    .slice(0, 5);
  const lines = [five.slice(0, 1), five.slice(1, 3), five.slice(3, 5)].filter((l) => l.length > 0);

  if (five.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center px-4 py-3">
        <span className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
          {team.name} — 출전 선수 없음
        </span>
      </div>
    );
  }

  return (
    <div
      className={`flex h-full w-full items-center justify-around gap-1 px-1 pb-2 pt-14 ${
        isAway
          ? "flex-col-reverse landscape:flex-row-reverse md:flex-row-reverse"
          : "flex-col landscape:flex-row md:flex-row"
      }`}
    >
      {lines.map((line, i) => (
        <div
          key={i}
          className="flex flex-row items-center justify-around gap-3 landscape:flex-col md:flex-col"
        >
          {line.map((p) => (
            <PlayerToken
              key={p.id}
              player={p}
              teamId={team.id}
              eventType={eventType}
              pending={pending}
              onRecord={onRecord}
              playerStat={playerStat}
              accent={accent}
              onGrass={grass}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** 코트 절반(한 팀) — 잔디 위 포메이션. 최대 5명을 GK·수비·공격 라인으로 배치.
    좌상단(home)·우상단(away) 코너에 팀명/점수/누적 스탯 스트립. */
function PitchFormation({
  team,
  eventType,
  pending,
  onRecord,
  playerStat,
}: {
  team: TeamSide;
  eventType: MatchEventType | "";
  pending: boolean;
  onRecord: (player: Player, teamId: string) => void | Promise<void>;
  playerStat: (pid: string, type: MatchEventType) => number;
}) {
  const isAway = team.side === "away";

  return (
    <div className="relative h-full w-full">
      {/* 정보 스트립 — 코너 */}
      <div
        className={`absolute top-1 z-20 flex flex-col gap-0.5 ${
          isAway ? "right-2 items-end text-right" : "left-2 items-start text-left"
        }`}
      >
        <div className="flex items-center gap-1.5">
          <span
            className="max-w-[130px] truncate text-sm font-bold"
            style={{ color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.7)" }}
          >
            {team.name}
          </span>
          <span
            className="text-xl font-black tabular-nums"
            style={{ color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.7)" }}
          >
            {team.score}
          </span>
        </div>
        <div className={`flex flex-wrap gap-1 ${isAway ? "justify-end" : ""}`}>
          {[
            { e: "⚽", n: team.tally.goals },
            { e: "🅰️", n: team.tally.assists },
            { e: "🚫", n: team.tally.fouls },
            { e: "🟨", n: team.tally.yellow },
            { e: "🟥", n: team.tally.red },
          ].map((it, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums"
              style={{ background: "rgba(8,20,12,0.6)", color: "#fff" }}
            >
              <span aria-hidden>{it.e}</span>
              <span>{it.n}</span>
            </span>
          ))}
        </div>
      </div>

      {/* 포메이션 — 원정만 코트 위. 홈은 페이지 상단 FormationControls */}
      {isAway ? (
        <FormationControls
          team={team}
          isAway
          eventType={eventType}
          pending={pending}
          onRecord={onRecord}
          playerStat={playerStat}
        />
      ) : null}
    </div>
  );
}

/** 경기장 밖 대기선수 — 팀별 원형 번호 토큰 행. */
function BenchStrip({
  team,
  eventType,
  pending,
  onRecord,
  playerStat,
}: {
  team: TeamSide;
  eventType: MatchEventType | "";
  pending: boolean;
  onRecord: (player: Player, teamId: string) => void | Promise<void>;
  playerStat: (pid: string, type: MatchEventType) => number;
}) {
  const accent = teamAccent(team.side);
  return (
    <div
      className="rounded-lg border p-2"
      style={{ borderColor: "var(--border)", background: "var(--background)" }}
    >
      <div
        className="mb-2 flex items-center gap-1.5 text-xs font-semibold"
        style={{ color: "var(--muted-foreground)" }}
      >
        <span className="truncate">{team.name}</span>
        <span>· 대기 {team.bench.length}</span>
      </div>
      {team.bench.length === 0 ? (
        <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
          대기 선수 없음
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {team.bench.map((p) => (
            <PlayerToken
              key={p.id}
              player={p}
              teamId={team.id}
              eventType={eventType}
              pending={pending}
              onRecord={onRecord}
              playerStat={playerStat}
              accent={accent}
              onGrass={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** 심판 콘솔용 출전 명단 readonly 카드. 선발/교체 분리 표시. */
function LineupReadonlyCard({
  teamName,
  entries,
}: {
  teamName: string;
  entries: MatchLineupEntry[];
}) {
  const starters = entries.filter((e) => e.isStarter);
  const subs = entries.filter((e) => !e.isStarter);

  return (
    <div
      className="rounded-lg border p-2.5"
      style={{
        borderColor: "var(--color-fg-line-soft, var(--muted))",
        background: "var(--background)",
      }}
    >
      <div className="mb-1.5 flex items-center justify-between">
        <div className="truncate text-xs font-semibold">{teamName}</div>
        <span
          className="text-[10px] tabular-nums"
          style={{ color: "var(--muted-foreground)" }}
        >
          {entries.length}
        </span>
      </div>
      {entries.length === 0 ? (
        <div
          className="rounded border border-dashed py-3 text-center text-[10px]"
          style={{
            borderColor: "var(--muted)",
            color: "var(--muted-foreground)",
          }}
        >
          (라인업 미제출)
        </div>
      ) : (
        <div className="space-y-1.5">
          {starters.length > 0 && (
            <ul className="space-y-1">
              {starters.map((e) => (
                <li
                  key={e.playerId}
                  className="flex items-center gap-1.5 rounded px-1.5 py-1 text-[11px]"
                  style={{
                    background:
                      "color-mix(in srgb, var(--accent-gold, #d4a017) 8%, transparent)",
                  }}
                >
                  <Star
                    className="h-3 w-3 shrink-0"
                    style={{
                      color: "var(--accent-gold, var(--primary))",
                      fill: "currentColor",
                    }}
                    aria-hidden
                  />
                  {e.jerseyNumber != null && (
                    <span className="font-bold tabular-nums">
                      #{e.jerseyNumber}
                    </span>
                  )}
                  <span className="flex-1 truncate">
                    {e.playerName ?? e.playerId.slice(0, 8)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {subs.length > 0 && (
            <>
              <div
                className="border-t pt-1 text-[9px] uppercase tracking-wide"
                style={{ color: "var(--muted-foreground)" }}
              >
                교체
              </div>
              <ul className="space-y-1">
                {subs.map((e) => (
                  <li
                    key={e.playerId}
                    className="flex items-center gap-1.5 px-1.5 py-0.5 text-[11px]"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {e.jerseyNumber != null && (
                      <span className="font-bold tabular-nums">
                        #{e.jerseyNumber}
                      </span>
                    )}
                    <span className="flex-1 truncate">
                      {e.playerName ?? e.playerId.slice(0, 8)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
