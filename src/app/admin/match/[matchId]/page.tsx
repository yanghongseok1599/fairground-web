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
import { halfControlButtons } from "@/lib/match-half-control";
import type { HalfAction, HalfButton } from "@/lib/match-half-control";
import {
  MATCH_DURATION_LABEL,
  MATCH_DURATION_MINUTES,
  MATCH_DURATION_SECONDS,
  matchMinuteFromElapsed,
} from "@/lib/match-config";
import { useAuth } from "@/hooks/useAuth";
import { EventTimeline } from "@/components/match/event-timeline";
import {
  Plus,
  Trophy,
  Circle,
  Loader2,
  WifiOff,
  AlertTriangle,
  Star,
  Users,
  RotateCw,
  Maximize2,
  Minimize2,
  X,
} from "lucide-react";
import type { MatchEvent, MatchEventType, MatchLineupEntry, Player } from "@/types";

const EVENT_TYPES: { value: MatchEventType; label: string; emoji: string }[] = [
  { value: "goal", label: "골", emoji: "⚽" },
  { value: "assist", label: "어시스트", emoji: "🅰️" },
  { value: "foul", label: "반칙", emoji: "🚫" },
  { value: "yellow_card", label: "경고", emoji: "🟨" },
  { value: "red_card", label: "퇴장", emoji: "🟥" },
];
const COURT_PLAYER_LIMIT = 5;
const NO_MOM_VALUE = "__no_mom__";

type AssistTarget = Pick<
  MatchEvent,
  "id" | "playerId" | "playerName" | "teamId" | "minute" | "half"
> & {
  source: "goal-record" | "timeline-review";
};

type ScreenOrientationWithLock = ScreenOrientation & {
  lock?: (orientation: "landscape") => Promise<void>;
  unlock?: () => void;
};

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

  // 전체화면 경기장 모드 토글 — 관리자·심판 모두 진행중 경기에서 코트를
  // 탭해 전체화면으로 운영한다. 기본은 클릭 진입(자동 진입 안 함), 닫으면 일반 카드로.
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [forceLandscapeStage, setForceLandscapeStage] = useState(false);
  const requestedBrowserFullscreen = useRef(false);

  const lockLandscapeMode = async () => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(max-width: 767px)").matches) return;

    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        requestedBrowserFullscreen.current = true;
      }
    } catch {
      // iOS/Safari 등은 API를 거부할 수 있다. CSS 가로 스테이지가 fallback.
    }

    try {
      const orientation = screen.orientation as ScreenOrientationWithLock | undefined;
      await orientation?.lock?.("landscape");
    } catch {
      // Orientation Lock 미지원 브라우저도 CSS fallback으로 계속 운영한다.
    }
  };

  const releaseLandscapeMode = () => {
    if (typeof document === "undefined") return;
    try {
      const orientation = screen.orientation as ScreenOrientationWithLock | undefined;
      orientation?.unlock?.();
    } catch {
      // 지원하지 않으면 무시.
    }
    if (
      requestedBrowserFullscreen.current &&
      document.fullscreenElement &&
      document.exitFullscreen
    ) {
      void document.exitFullscreen().catch(() => undefined);
    }
    requestedBrowserFullscreen.current = false;
  };

  const openFullscreenMode = () => {
    setFullscreenOpen(true);
    void lockLandscapeMode();
  };

  const closeFullscreenMode = () => {
    setFullscreenOpen(false);
    releaseLandscapeMode();
  };

  useEffect(() => {
    return () => releaseLandscapeMode();
  }, []);

  useEffect(() => {
    if (!fullscreenOpen || typeof window === "undefined") {
      setForceLandscapeStage(false);
      return;
    }

    const sync = () => {
      setForceLandscapeStage(
        window.matchMedia("(max-width: 767px) and (orientation: portrait)").matches,
      );
    };
    sync();
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, [fullscreenOpen]);

  // 전체화면 코트에서 선수 탭 → 액션 팝업(이벤트 기록 / 교체) 상태.
  const [actionTarget, setActionTarget] = useState<{ player: Player; teamId: string } | null>(null);
  const [subPicking, setSubPicking] = useState(false); // true=교체 선수 선택 모드
  const [subError, setSubError] = useState<string | null>(null);
  const [subBusy, setSubBusy] = useState(false);
  const [lastActionNotice, setLastActionNotice] = useState("");
  const openActionMenu = (player: Player, teamId: string) => {
    setActionTarget({ player, teamId });
    setSubPicking(false);
    setSubError(null);
  };
  const closeActionMenu = () => {
    setActionTarget(null);
    setSubPicking(false);
    setSubError(null);
  };

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

  // 어시스트 체크 — 득점 직후 심판·부심이 바로 기록하거나, 놓친 골을 관리자가 보강.
  const [assistGoal, setAssistGoal] = useState<AssistTarget | null>(null);

  // End match dialog
  const [endDialogOpen, setEndDialogOpen] = useState(false);
  const [endMomChoice, setEndMomChoice] = useState("");

  useEffect(() => {
    if (!lastActionNotice) return;
    const timer = window.setTimeout(() => setLastActionNotice(""), 3200);
    return () => window.clearTimeout(timer);
  }, [lastActionNotice]);

  // 몰수패 처리(관리자) — 지목 팀 0, 상대 3 으로 종료. 규정 제13조/대회규정 제9조.
  const [forfeitOpen, setForfeitOpen] = useState(false);
  const [forfeiting, setForfeiting] = useState(false);
  const [forfeitErr, setForfeitErr] = useState("");

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
  const isRegulationComplete = isLive && mc.elapsedSeconds >= MATCH_DURATION_SECONDS;

  // 경기운영 진입 트랙 — AdminGuard 통과이므로 "admin" 또는 "referee".
  // 관리자·심판 모두 진행중 경기를 전체화면 경기장 한 화면에서 운영할 수 있다.
  const isFullscreen = isLive && fullscreenOpen;

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
  const goalEvents = liveEvents
    .filter((e) => e.type === "goal")
    .sort((a, b) => a.timestamp - b.timestamp);
  const assistEvents = liveEvents.filter((e) => e.type === "assist");
  const goalEventCount = goalEvents.length;
  const assistEventCount = assistEvents.length;
  const assistCountByTeam = new Map<string, number>();
  for (const event of assistEvents) {
    assistCountByTeam.set(event.teamId, (assistCountByTeam.get(event.teamId) ?? 0) + 1);
  }
  const goalsByTeam = new Map<string, MatchEvent[]>();
  for (const goal of goalEvents) {
    goalsByTeam.set(goal.teamId, [...(goalsByTeam.get(goal.teamId) ?? []), goal]);
  }
  const uncheckedAssistGoalIds = new Set<string>();
  for (const [teamId, goals] of goalsByTeam) {
    const confirmedAssists = assistCountByTeam.get(teamId) ?? 0;
    for (const goal of goals.slice(confirmedAssists)) {
      uncheckedAssistGoalIds.add(goal.id);
    }
  }
  const uncheckedAssistGoals = goalEvents.filter((goal) =>
    uncheckedAssistGoalIds.has(goal.id),
  );
  const missingAssistCount = uncheckedAssistGoals.length;
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

  // 제12조③ — 동일 경기 내 경고(옐로) 2회 누적 시 퇴장.
  // 퇴장은 useMatchControl.addEvent 가 두 번째 경고와 함께 자동 기록한다.
  // 아래 집계는 자동 기록이 실패했거나 이 기능 이전에 진행된 경기를 위한
  // 안전망 — 경고 2회인데 레드가 없는 선수가 남아 있으면 배너로 알린다.
  const ejectionDue = (() => {
    const acc = new Map<string, { name: string; y: number; r: number }>();
    for (const e of liveEvents) {
      if (e.type !== "yellow_card" && e.type !== "red_card") continue;
      const cur = acc.get(e.playerId) ?? { name: e.playerName || "선수", y: 0, r: 0 };
      if (e.type === "yellow_card") cur.y += 1;
      else cur.r += 1;
      if (e.playerName) cur.name = e.playerName;
      acc.set(e.playerId, cur);
    }
    return [...acc.values()].filter((v) => v.y >= 2 && v.r === 0);
  })();

  // 출전(코트)·대기(벤치) 선수 분리.
  // 경기 운영 화면은 실제 코트에 항상 최대 5명을 보여줘야 하므로, 선발이
  // 5명 미만이면 등록 명단/팀 멤버에서 부족분을 채워 코트에 먼저 배치한다.
  const toPlayers = (entries: MatchLineupEntry[], pool: Player[]): Player[] =>
    entries
      .map((e) => pool.find((p) => p.id === e.playerId))
      .filter((p): p is Player => Boolean(p));
  const byNumber = (a: Player, b: Player) => {
    const an = typeof a.number === "number" ? a.number : Number.MAX_SAFE_INTEGER;
    const bn = typeof b.number === "number" ? b.number : Number.MAX_SAFE_INTEGER;
    return an - bn || a.name.localeCompare(b.name, "ko");
  };
  const buildOnCourt = (
    entries: MatchLineupEntry[],
    pool: Player[],
    fallbackActive: Player[],
  ): Player[] => {
    if (entries.length === 0) {
      return [...fallbackActive].sort(byNumber).slice(0, COURT_PLAYER_LIMIT);
    }

    const starters = toPlayers(entries.filter((e) => e.isStarter), pool).sort(byNumber);
    if (starters.length >= COURT_PLAYER_LIMIT) return starters.slice(0, COURT_PLAYER_LIMIT);

    const pickedIds = new Set(starters.map((p) => p.id));
    const registeredFillers = toPlayers(entries.filter((e) => !e.isStarter), pool)
      .filter((p) => !pickedIds.has(p.id))
      .sort(byNumber);
    const registeredFillerIds = new Set(registeredFillers.map((p) => p.id));
    const rosterFillers = [...pool]
      .filter((p) => !pickedIds.has(p.id) && !registeredFillerIds.has(p.id))
      .sort(byNumber)
      .slice(0, COURT_PLAYER_LIMIT);
    const filler = [...registeredFillers, ...rosterFillers]
      .slice(0, COURT_PLAYER_LIMIT - starters.length);

    return [...starters, ...filler];
  };
  const buildBench = (
    entries: MatchLineupEntry[],
    pool: Player[],
    onCourt: Player[],
  ): Player[] => {
    if (entries.length === 0) return [];

    const onCourtIds = new Set(onCourt.map((p) => p.id));
    const explicitBench = toPlayers(entries.filter((e) => !e.isStarter), pool)
      .filter((p) => !onCourtIds.has(p.id));
    const explicitBenchIds = new Set(explicitBench.map((p) => p.id));
    const rosterBench = [...pool]
      .filter((p) => !onCourtIds.has(p.id) && !explicitBenchIds.has(p.id))
      .sort(byNumber);

    return [...explicitBench, ...rosterBench];
  };
  const homeOnCourt =
    buildOnCourt(homeLineup, mc.homePlayers, homeActivePlayers);
  const homeBench = buildBench(homeLineup, mc.homePlayers, homeOnCourt);
  const awayOnCourt =
    buildOnCourt(awayLineup, mc.awayPlayers, awayActivePlayers);
  const awayBench = buildBench(awayLineup, mc.awayPlayers, awayOnCourt);

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

  const createAssistTarget = (
    scorer: Pick<Player, "id" | "name">,
    teamId: string,
    source: AssistTarget["source"],
  ): AssistTarget => ({
    id: `pending-goal-${scorer.id}-${Date.now()}`,
    playerId: scorer.id,
    playerName: scorer.name,
    teamId,
    minute: matchMinuteFromElapsed(mc.elapsedSeconds),
    half: mc.currentHalf,
    source,
  });

  // 가로 분할 모델 — 선택된 이벤트 유형으로 특정 선수+팀에 즉시 기록.
  // 유형은 유지(연속 동일 이벤트 빠른 기록). 유형 미선택 시 무시.
  const recordPlayerEvent = async (player: Player, teamId: string) => {
    if (!eventType || mc.pendingAction !== null) return;
    const payload = { type: eventType, playerId: player.id, playerName: player.name, teamId };
    lastEventAttempt.current = payload; // 실패 시 재시도용
    const ok = await mc.addEvent(payload);
    if (ok) {
      setLastActionNotice(`${player.name} ${eventLabel(eventType)} 기록`);
      if (eventType === "goal") {
        setAssistGoal(createAssistTarget(player, teamId, "goal-record"));
      }
    }
  };

  // 이벤트 기록 실패 시 재시도 — 마지막 시도 payload 재실행.
  const retryLastEvent = async () => {
    const last = lastEventAttempt.current;
    if (!last) return;
    await mc.addEvent(last);
  };

  const handleSetMom = async () => {
    if (!momPlayerId || !isLive) return;
    const ok = await mc.setMom(momPlayerId);
    if (ok) {
      setLastActionNotice("MOM 선정 완료");
      setMomPlayerId("");
    }
  };

  // 어시스트 추가 — 골 이벤트 선택 시 해당 팀 선수 picker 오픈.
  const openAssistPicker = (goal: MatchEvent) =>
    setAssistGoal({
      id: goal.id,
      playerId: goal.playerId,
      playerName: goal.playerName,
      teamId: goal.teamId,
      minute: goal.minute,
      half: goal.half,
      source: "timeline-review",
    });

  // picker 에서 선수 선택 → 골과 동일 팀으로 어시스트 기록 후 닫기.
  const handleAddAssist = async (assistPlayer: Player) => {
    if (!assistGoal || mc.pendingAction !== null) return;
    const ok = await mc.addEvent({
      type: "assist",
      playerId: assistPlayer.id,
      playerName: assistPlayer.name,
      teamId: assistGoal.teamId,
    });
    if (ok) {
      setLastActionNotice(`${assistPlayer.name} 어시스트 기록`);
      setAssistGoal(null);
    }
  };

  // 골과 동일 팀의 출전+대기 선수 후보 — picker 목록.
  const assistCandidates: Player[] = assistGoal
    ? assistGoal.teamId === homeSide.id
      ? [...homeSide.onCourt, ...homeSide.bench].filter(
          (p) => p.id !== assistGoal.playerId,
        )
      : assistGoal.teamId === awaySide.id
        ? [...awaySide.onCourt, ...awaySide.bench].filter(
            (p) => p.id !== assistGoal.playerId,
          )
        : []
    : [];

  const assistGoalTeamName = assistGoal
    ? assistGoal.teamId === homeSide.id
      ? homeSide.name
      : assistGoal.teamId === awaySide.id
        ? awaySide.name
        : ""
    : "";

  const closeAssistPicker = () => {
    if (mc.pendingAction !== null) return;
    setAssistGoal(null);
  };

  const renderAssistDialog = () => (
    <Dialog
      open={assistGoal !== null}
      onOpenChange={(open) => {
        if (mc.pendingAction !== null) return;
        if (!open) setAssistGoal(null);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            어시스트 체크
            {assistGoal ? ` — ${assistGoal.playerName} 득점` : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div
            className="rounded-lg border px-3 py-2 text-xs leading-relaxed"
            style={{
              borderColor: "rgba(0,71,171,0.16)",
              background: "rgba(0,71,171,0.06)",
              color: "var(--muted-foreground)",
            }}
          >
            <b style={{ color: "var(--foreground)" }}>
              {assistGoalTeamName || "해당 팀"} · {assistGoal?.minute ?? 0}&apos;
            </b>{" "}
            득점입니다. 심판·부심이 확인한 어시스트 선수를 선택하세요. 놓쳤다면
            나중에 체크를 누르고, 관리자 화면의 누락 체크보드에서 바로 보강할 수 있습니다.
          </div>
          {assistCandidates.length === 0 ? (
            <p
              className="py-4 text-center text-sm"
              style={{ color: "var(--muted-foreground)" }}
            >
              선택할 수 있는 선수가 없습니다.
            </p>
          ) : (
            <div className="grid max-h-[50vh] grid-cols-2 gap-2 overflow-y-auto">
              {assistCandidates.map((p) => (
                <Button
                  key={p.id}
                  variant="outline"
                  className="min-h-[44px] justify-start"
                  onClick={() => handleAddAssist(p)}
                  disabled={mc.pendingAction !== null}
                >
                  <span className="font-bold tabular-nums">#{p.number}</span>
                  <span className="ml-1.5 truncate">{p.name}</span>
                </Button>
              ))}
            </div>
          )}
          {mc.pendingAction === "event" && (
            <p
              className="flex items-center justify-center gap-1.5 text-xs"
              style={{ color: "var(--muted-foreground)" }}
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> 기록 처리중…
            </p>
          )}
          <Button
            variant="ghost"
            className="min-h-[44px] w-full"
            onClick={closeAssistPicker}
            disabled={mc.pendingAction !== null}
          >
            나중에 체크
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  const handleEndMatch = async () => {
    const momChoice = endMomChoice || matchData.momPlayerId || "";
    if (!momChoice || mc.pendingAction !== null) return;

    if (
      momChoice !== NO_MOM_VALUE &&
      momChoice !== matchData.momPlayerId
    ) {
      const ok = await mc.setMom(momChoice);
      if (!ok) return;
    }

    // Q5 — endMatch 는 runAction 가드로 재진입 차단됨. 성공 시에만 다이얼로그 닫고,
    // 실패 시 다이얼로그 유지 + 위치별 에러를 다이얼로그 내에서 노출(재시도 가능).
    await mc.endMatch();
  };

  const endPending = mc.pendingAction === "end";
  const endMomValue = endMomChoice || matchData.momPlayerId || "";
  const endMomReady = endMomValue.length > 0;
  const selectedEndMom = allPlayers.find((p) => p.id === endMomValue);

  // 몰수패 처리(관리자 전용) — 지목 팀이 패(0), 상대 승(3). 성공 시 경기 종료·재로드.
  const isAdmin = player?.role === "admin";
  const handleForfeit = async (forfeitTeamId: string) => {
    setForfeiting(true);
    setForfeitErr("");
    try {
      await store.forfeitMatch(matchData.id, forfeitTeamId);
      setForfeitOpen(false);
      await mc.reload();
    } catch (err) {
      setForfeitErr(err instanceof Error ? err.message : "몰수패 처리에 실패했습니다");
    } finally {
      setForfeiting(false);
    }
  };

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

  const eventLabel = (type: MatchEventType) =>
    EVENT_TYPES.find((item) => item.value === type)?.label ??
    (type === "assist" ? "어시스트" : type);

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
      case "event":
        return () => retryLastEvent();
      case "mom":
        return () => handleSetMom();
      default:
        return null;
    }
  };

  // ── 타이머 중심 전광판 (7a) ─────────────────────────────────────
  // [HOME 이름+점수] [중앙: 시간·단일 12분·라이브닷·상태] [AWAY 점수+이름]
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
        {/* CENTER: 라이브닷 + 시간 + 경기 시간 모델 + 상태 */}
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
            {isRegulationComplete ? "12분 완료" : MATCH_DURATION_LABEL}
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
            {isScheduled ? "예정" : isLive ? (isRegulationComplete ? "종료 대기" : "진행중") : "종료"}
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

  // 진행버튼(단일 타이머: 경기 시작 · 일시정지/재개 · 경기 종료) — 일반·전체화면 공용.
  // 공식 규정 v2.4 제4조 — 전·후반 구분 없이 단일 경기 시간 12분.
  const renderProgressButtons = () => {
    const progress = {
      status: matchData.status,
      isRunning: mc.isRunning,
      isRegulationComplete,
    };
    const runHalf = (a: HalfAction) => {
      if (a === "start") return mc.startMatch();
      if (a === "pause") return mc.pauseMatch();
      if (a === "resume") return mc.resumeMatch();
      if (a === "endMatch") {
        setEndMomChoice(matchData.momPlayerId ?? "");
        return setEndDialogOpen(true);
      }
    };
    const buttons = halfControlButtons(progress);
    if (buttons.length === 0) return null;
    return (
      <div className="flex flex-wrap items-center justify-center gap-2">
        {buttons.map((b: HalfButton) => (
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
      </div>
    );
  };

  // 이벤트 유형 5종 그리드 — 일반·전체화면 공용. dark=어두운 배경용.
  const renderEventTypeGrid = (dark: boolean) => (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
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

  const renderGrassBenchTeam = (
    team: TeamSide,
    align: "left" | "right",
    onBenchTap?: (player: Player, teamId: string) => void | Promise<void>,
  ) => {
    const accent = teamAccent(team.side);
    const justify = align === "left" ? "justify-start" : "justify-end";
    const textAlign = align === "left" ? "items-start text-left" : "items-end text-right";
    const handleBenchTap = onBenchTap ?? recordPlayerEvent;

    return (
      <div className={`min-w-0 ${textAlign}`}>
        <div
          className="mb-1 max-w-[130px] truncate text-[10px] font-black sm:max-w-[180px] sm:text-xs"
          style={{ color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}
        >
          {team.name} · {team.bench.length > 0 ? `대기 ${team.bench.length}` : "대기 없음"}
        </div>
        {team.bench.length > 0 && (
          <div className={`pointer-events-auto flex flex-wrap gap-1.5 ${justify}`}>
            {team.bench.map((p) => (
              <PlayerToken
                key={p.id}
                player={p}
                teamId={team.id}
                eventType={eventType}
                pending={mc.pendingAction !== null}
                onRecord={handleBenchTap}
                playerStat={playerStat}
                accent={accent}
                onGrass
                forceTappable={!!onBenchTap}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderGrassBenchOverlay = (
    topClass: string,
    onBenchTap?: (player: Player, teamId: string) => void | Promise<void>,
  ) => (
    <div
      className={`pointer-events-none absolute left-3 right-3 z-30 grid grid-cols-2 gap-3 ${topClass}`}
      aria-label="잔디 코트 상단 예비선수단"
    >
      {renderGrassBenchTeam(homeSide, "left", onBenchTap)}
      {renderGrassBenchTeam(awaySide, "right", onBenchTap)}
    </div>
  );

  // 코트 대시보드(녹색 코트 + 양팀 포메이션 + 시계/예비선수 오버레이) — 일반·전체화면 공용.
  // overlay: 코트 상단 중앙에 띄울 노드(전체화면에선 전광판).
  // homeOnGrass: true 면 홈 포메이션도 코트 홈 칸에 직접 띄운다(전체화면 전용).
  //   일반 레이아웃에선 홈 포메이션을 코트 위(별도 FormationControls 스트립)에 두므로 false.
  const renderCourt = (opts?: {
    overlay?: ReactNode;
    homeOnGrass?: boolean;
    forceLandscape?: boolean;
    balancedFormation?: boolean;
    benchTopClass?: string;
    onPlayerTap?: (player: Player, teamId: string) => void;
  }) => (
    <div className="relative h-full w-full overflow-hidden rounded-xl">
      <CourtBackdrop forceLandscape={opts?.forceLandscape} />
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
              / {MATCH_DURATION_MINUTES}:00
            </span>
          </div>
        </div>
      )}
      {renderGrassBenchOverlay(opts?.benchTopClass ?? "top-12 sm:top-14", opts?.onPlayerTap)}
      <div
        className={`absolute inset-0 z-10 grid ${
          opts?.forceLandscape
            ? "grid-cols-2 grid-rows-1"
            : "grid-cols-1 grid-rows-2 landscape:grid-cols-2 landscape:grid-rows-1 md:grid-cols-2 md:grid-rows-1"
        }`}
      >
        {/* 홈 칸 — 전체화면(homeOnGrass)에선 잔디 위 홈 포메이션, 아니면 정보 스트립만 */}
        {opts?.homeOnGrass ? (
          <div className="relative h-full w-full">
            {/* 전체화면: 팀명·점수·집계는 상단 전광판이 표시 → 잔디엔 선수만 */}
            <FormationControls
              team={homeSide}
              isAway={false}
              eventType={eventType}
              pending={mc.pendingAction !== null}
              onRecord={opts?.onPlayerTap ?? recordPlayerEvent}
              playerStat={playerStat}
              onGrass
              forceTappable={!!opts?.onPlayerTap}
              balanced={opts?.balancedFormation}
            />
          </div>
        ) : (
          <PitchFormation
            team={homeSide}
            eventType={eventType}
            pending={mc.pendingAction !== null}
            onRecord={opts?.onPlayerTap ?? recordPlayerEvent}
            playerStat={playerStat}
            forceTappable={!!opts?.onPlayerTap}
          />
        )}
        {/* 어웨이 칸 — 항상 잔디 위 포메이션. 전체화면(homeOnGrass)에선
            코너 팀명/점수/집계 숨김(상단 전광판이 대신 표시). */}
        <PitchFormation
          team={awaySide}
          eventType={eventType}
          pending={mc.pendingAction !== null}
          onRecord={opts?.onPlayerTap ?? recordPlayerEvent}
          playerStat={playerStat}
          hideHeader={!!opts?.homeOnGrass}
          forceTappable={!!opts?.onPlayerTap}
          balanced={opts?.balancedFormation}
        />
      </div>
    </div>
  );

  // ── 심판 전체화면 경기장 모드 (7b) ───────────────────────────────
  // 진행중 경기를 한 화면에서: 상단 전광판 오버레이가 떠 있는 코트(flex-1) +
  // 하단 컨트롤바(이벤트 유형 5종 · 4단계 진행버튼) + 벤치. 좌상단 닫기 버튼.
  if (isFullscreen) {
    const benchForTarget = actionTarget
      ? (actionTarget.teamId === homeSide.id ? homeSide : awaySide).bench
      : [];
    const handleEventAction = async (type: MatchEventType) => {
      if (!actionTarget || mc.pendingAction !== null) return;
      const ok = await mc.addEvent({
        type,
        playerId: actionTarget.player.id,
        playerName: actionTarget.player.name,
        teamId: actionTarget.teamId,
      });
      if (ok) {
        setLastActionNotice(`${actionTarget.player.name} ${eventLabel(type)} 기록`);
        if (type === "goal") {
          setAssistGoal(
            createAssistTarget(actionTarget.player, actionTarget.teamId, "goal-record"),
          );
        }
        closeActionMenu();
      }
    };
    const handleSubstitute = async (inPlayer: Player) => {
      if (!actionTarget || subBusy) return;
      setSubBusy(true);
      setSubError(null);
      try {
        await store.substitutePlayer(
          matchId,
          actionTarget.teamId,
          actionTarget.player.id,
          inPlayer.id,
          inPlayer.name,
          matchMinuteFromElapsed(mc.elapsedSeconds),
          mc.currentHalf,
        );
        setLineup(await store.fetchMatchLineup(matchId));
        setLastActionNotice(`${actionTarget.player.name} ↔ ${inPlayer.name} 교체`);
        closeActionMenu();
      } catch (e) {
        setSubError(e instanceof Error ? e.message : "교체에 실패했습니다. 다시 시도해주세요.");
      } finally {
        setSubBusy(false);
      }
    };

    return (
      <div className="fixed inset-0 z-[100] overflow-hidden bg-black text-white">
        <div
          className="match-landscape-shell flex h-full w-full flex-col bg-black"
          style={
            forceLandscapeStage
              ? {
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: "100dvh",
                  height: "100dvw",
                  maxWidth: "none",
                  transform: "translate(-50%, -50%) rotate(90deg)",
                  transformOrigin: "center",
                }
              : undefined
          }
        >
        {!mc.isOnline && (
          <div
            role="status"
            className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-1.5 text-sm font-semibold text-white"
          >
            <WifiOff className="h-4 w-4" />
            오프라인 — 네트워크 복구 시 기록을 다시 시도하세요
          </div>
        )}

        {/* 상단 슬림 바 — 진행버튼(시작·일시정지·재개·종료) + 원래 화면 복귀 */}
        <div className="flex shrink-0 items-center gap-2 border-b border-white/15 bg-neutral-950/95 px-2 py-1.5">
          <div className="min-w-0 flex-1 overflow-x-auto">
            {renderProgressButtons()}
          </div>
          <button
            type="button"
            onClick={closeFullscreenMode}
            className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 text-sm font-black text-white"
            aria-label="상단 원래 화면으로 돌아가기"
          >
            <X className="h-4 w-4" />
            원래 화면
          </button>
        </div>

        {/* 코트 영역 — 남는 공간 전부. 전광판과 예비선수단 모두 잔디 위 오버레이로 표시.
            홈·어웨이 모두 잔디 위(homeOnGrass), 골 중심 대칭 배치(balancedFormation).
            선수 탭 → 액션 팝업(이벤트/교체). */}
        <div className="relative min-h-0 flex-1">
          {renderCourt({
            forceLandscape: true,
            homeOnGrass: true,
            balancedFormation: true,
            benchTopClass: "top-20 sm:top-20",
            onPlayerTap: openActionMenu,
            overlay: (
              <div
                className="pointer-events-none absolute left-1/2 top-2 z-30 -translate-x-1/2 rounded-2xl px-3 py-2 shadow-lg"
                style={{
                  background: "rgba(8,20,12,0.82)",
                  border: "1px solid rgba(255,255,255,0.22)",
                }}
              >
                {renderScoreboardRow(true)}
              </div>
            ),
          })}
          <button
            type="button"
            onClick={closeFullscreenMode}
            className="absolute right-3 top-3 z-40 flex min-h-[42px] items-center gap-1.5 rounded-full bg-white px-3 text-sm font-black text-neutral-950 shadow-lg"
            aria-label="코트 원래 화면으로 돌아가기"
          >
            <Minimize2 className="h-4 w-4" />
            원래 화면
          </button>

          {lastActionNotice && !mc.actionError && (
            <div
              role="status"
              className="absolute bottom-2 left-1/2 z-30 w-[min(92%,420px)] -translate-x-1/2 rounded-full border border-white/20 bg-neutral-950/88 px-4 py-2 text-center text-sm font-black text-white shadow-lg"
            >
              {lastActionNotice}
            </div>
          )}

          {/* 위치별 에러(종료 제외) — 코트 위 하단 토스트로 표시(재시도 가능) */}
          {mc.actionError && mc.actionError.scope !== "end" && (
            <div
              role="alert"
              className="absolute bottom-2 left-1/2 z-30 flex w-[min(92%,520px)] -translate-x-1/2 items-start gap-2 rounded-lg border border-red-400/50 bg-red-950/90 p-2.5 text-sm shadow-lg"
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

        {/* 선수 탭 액션 팝업 — 이벤트 기록 / 교체 */}
        <Dialog
          open={!!actionTarget}
          onOpenChange={(open) => {
            if (mc.pendingAction !== null || subBusy) return;
            if (!open) closeActionMenu();
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {subPicking
                  ? `교체 — ${actionTarget?.player.name} 대신 들어올 선수`
                  : actionTarget
                    ? `#${actionTarget.player.number} ${actionTarget.player.name}`
                    : ""}
              </DialogTitle>
            </DialogHeader>

            {!subPicking ? (
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-2">
                  {EVENT_TYPES.map((et) => (
                    <Button
                      key={et.value}
                      variant="outline"
                      className="min-h-[52px] justify-center text-base"
                      onClick={() => handleEventAction(et.value)}
                      disabled={mc.pendingAction !== null}
                    >
                      <span className="mr-1.5">{et.emoji}</span>
                      {et.label}
                    </Button>
                  ))}
                  <Button
                    variant="secondary"
                    className="col-span-2 min-h-[52px] justify-center text-base"
                    onClick={() => {
                      setSubError(null);
                      setSubPicking(true);
                    }}
                    disabled={mc.pendingAction !== null || benchForTarget.length === 0}
                  >
                    🔄 {benchForTarget.length === 0 ? "교체 후보 없음" : "교체"}
                  </Button>
                </div>
                {mc.pendingAction === "event" && (
                  <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> 기록 처리중…
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                {benchForTarget.length === 0 ? (
                  <p
                    className="py-4 text-center text-sm"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    교체 가능한 후보 선수가 없습니다.
                  </p>
                ) : (
                  <div className="grid max-h-[50vh] grid-cols-2 gap-2 overflow-y-auto">
                    {benchForTarget.map((p) => (
                      <Button
                        key={p.id}
                        variant="outline"
                        className="min-h-[44px] justify-start"
                        onClick={() => handleSubstitute(p)}
                        disabled={subBusy}
                      >
                        <span className="font-bold tabular-nums">#{p.number}</span>
                        <span className="ml-1.5 truncate">{p.name}</span>
                      </Button>
                    ))}
                  </div>
                )}
                {subError && (
                  <p role="alert" className="text-sm text-red-600">
                    {subError}
                  </p>
                )}
                {subBusy && (
                  <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> 교체 처리중…
                  </p>
                )}
                <Button
                  variant="ghost"
                  className="min-h-[44px] w-full"
                  onClick={() => {
                    setSubError(null);
                    setSubPicking(false);
                  }}
                  disabled={subBusy}
                >
                  뒤로
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {renderAssistDialog()}

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
              <div className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold">심판 MOM 선정</p>
                    <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                      경기 종료 전에 최종 MOM을 선택하세요.
                    </p>
                  </div>
                  {selectedEndMom && (
                    <Badge variant="secondary">현재 선택: {selectedEndMom.name}</Badge>
                  )}
                </div>
                <Select
                  value={endMomValue}
                  onValueChange={setEndMomChoice}
                  disabled={mc.pendingAction !== null}
                >
                  <SelectTrigger className="min-h-[44px] w-full">
                    <SelectValue placeholder="MOM 선수 또는 MOM 없음 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {!matchData.momPlayerId && (
                      <SelectItem value={NO_MOM_VALUE}>MOM 없음</SelectItem>
                    )}
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
              </div>
              {!endMomReady && (
                <div
                  role="status"
                  className="flex items-start gap-2 rounded-lg border p-3 text-sm"
                  style={{
                    borderColor: "rgba(245,158,11,0.38)",
                    background: "rgba(245,158,11,0.10)",
                    color: "rgb(146,64,14)",
                  }}
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>MOM 선수 또는 MOM 없음 중 하나를 선택해야 경기를 종료할 수 있습니다.</span>
                </div>
              )}
              {missingAssistCount > 0 && (
                <div
                  role="status"
                  className="flex items-start gap-2 rounded-lg border p-3 text-sm"
                  style={{
                    borderColor: "rgba(245,158,11,0.38)",
                    background: "rgba(245,158,11,0.10)",
                    color: "rgb(146,64,14)",
                  }}
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    골 {goalEventCount}개, 어시스트 {assistEventCount}개입니다. 어시스트 누락이 있으면 종료 전에 관리자 기록을 확인하세요.
                  </span>
                </div>
              )}
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
                  disabled={mc.pendingAction !== null || !endMomReady}
                  aria-busy={endPending}
                >
                  {mc.pendingAction === "mom" ? (
                    <>
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      MOM 저장중…
                    </>
                  ) : endPending ? (
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

      {/* 경기 운영 컨테이너 — 세로는 max-w-md, 가로(landscape)·데스크탑은
          더 넓게 펼쳐 타이머/스코어/이벤트 영역을 여유 있게 배치. */}
      <div className="mx-auto max-w-md landscape:max-w-5xl md:max-w-3xl space-y-4 p-4">
        {/* 스코어보드 — 점수·경기시간·팀별 골/어시/반칙/경고/퇴장을 한눈에.
            아래 컨트롤 행으로 시작/일시정지/재개/종료까지 한 카드에서 운영. */}
        <Card style={{ borderColor: "var(--accent-gold)" }}>
          <CardContent className="py-3">
            {/* 타이머 중심 전광판 (7a) — 시간이 가운데, 양옆에 팀 이름+점수 */}
            {renderScoreboardRow(false)}

            {/* 전체화면 경기장 모드 진입 — 관리자·심판 공용(진행중 경기). */}
            {isLive && (
              <div className="mt-3 flex justify-center border-t pt-3">
                <Button
                  variant="secondary"
                  className="min-h-[44px] px-5"
                  onClick={openFullscreenMode}
                >
                  <Maximize2 className="mr-1.5 h-4 w-4" />
                  전체화면 경기장 모드
                </Button>
              </div>
            )}

            {/* 컨트롤 행 — 단일 타이머 진행버튼(경기 시작 · 일시정지/재개 · 경기 종료). */}
            {(() => {
              const progress = {
                status: matchData.status,
                isRunning: mc.isRunning,
                isRegulationComplete,
              };
              if (halfControlButtons(progress).length === 0) return null;
              return (
                <div className="mt-3 border-t pt-3">{renderProgressButtons()}</div>
              );
            })()}

            {/* 몰수패 처리 — 관리자 전용. 미종료 경기에서만. 규정 제13조/대회규정 제9조. */}
            {isAdmin && !isFinished && (
              <div className="mt-3 flex justify-center border-t pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-red-600 hover:text-red-700"
                  onClick={() => { setForfeitErr(""); setForfeitOpen(true); }}
                >
                  몰수패 처리 (3:0)
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {isRegulationComplete && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-lg border p-3"
            style={{
              borderColor: "rgba(245,158,11,0.38)",
              background: "rgba(245,158,11,0.10)",
            }}
          >
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="text-sm text-amber-800">
              <p className="font-bold">규정 시간 {MATCH_DURATION_MINUTES}분을 모두 채웠습니다</p>
              <p className="mt-0.5">부상·중단 시간은 일시정지로 제외됩니다. 기록을 확인한 뒤 경기 종료를 눌러주세요.</p>
            </div>
          </div>
        )}

        {/* 자동 퇴장 확인 — 두 번째 경고와 함께 퇴장이 기록됐음을 심판에게 알린다. */}
        {mc.autoEjection && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-lg border p-3"
            style={{ borderColor: "rgba(255,59,48,0.4)", background: "rgba(255,59,48,0.08)" }}
          >
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-red-700">
                {mc.autoEjection.playerName} 퇴장 처리 (경고 2회 누적)
              </p>
              <p className="mt-0.5 text-red-700">
                규정 제12조③에 따라 🟥 퇴장을 함께 기록했습니다. 해당 선수는 남은
                경기에 출전할 수 없습니다.
              </p>
            </div>
            <button
              type="button"
              onClick={mc.clearAutoEjection}
              className="shrink-0 rounded-md px-2 py-1 text-xs font-bold text-red-700 hover:bg-red-100"
            >
              확인
            </button>
          </div>
        )}

        {/* 퇴장 기록 누락 안전망 — 자동 기록 실패/구경기 대비. */}
        {isLive && ejectionDue.length > 0 && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border p-3"
            style={{ borderColor: "rgba(255,59,48,0.4)", background: "rgba(255,59,48,0.08)" }}
          >
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-red-700">퇴장 기록 누락 (경고 2회 누적)</p>
              <p className="mt-0.5 text-red-700">
                {ejectionDue.map((v) => v.name).join(", ")} — 규정 제12조③에 따라 경고 2회
                누적 시 퇴장입니다. 자동 기록이 반영되지 않았으니 🟥 퇴장을 직접
                기록해 주세요.
              </p>
            </div>
          </div>
        )}

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
              {(eventType || lastActionNotice) && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {eventType && (
                    <div
                      className="rounded-lg border px-3 py-2 text-sm font-bold"
                      style={{
                        borderColor: "rgba(0,71,171,0.18)",
                        background: "rgba(0,71,171,0.06)",
                        color: "var(--primary)",
                      }}
                    >
                      선택됨: {eventLabel(eventType)}
                    </div>
                  )}
                  {lastActionNotice && (
                    <div
                      role="status"
                      className="rounded-lg border px-3 py-2 text-sm font-bold"
                      style={{
                        borderColor: "rgba(34,197,94,0.22)",
                        background: "rgba(34,197,94,0.08)",
                        color: "#166534",
                      }}
                    >
                      최근: {lastActionNotice}
                    </div>
                  )}
                </div>
              )}

              {/* 실제 구장 비율(2:1) 녹색 코트 위 양팀 출전/대기 번호 대시보드.
                  유형 선택 후 선수 칩을 탭하면 즉시 기록. 칩에는 골/어시/경고/퇴장 배지 표시. */}
              <div className="relative mx-auto aspect-[3/4] max-h-[62vh] w-full rounded-xl landscape:aspect-[2/1] md:aspect-[2/1]">
                {renderCourt({ homeOnGrass: true })}
                {/* 코트 코너 전체화면 진입 — 선수 칩 탭과 겹치지 않게 우상단 버튼만. */}
                {isLive && (
                  <button
                    type="button"
                    onClick={openFullscreenMode}
                    aria-label="전체화면으로 보기"
                    className="absolute right-2 top-2 z-30 flex min-h-[40px] items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-white shadow-lg"
                    style={{ background: "rgba(8,20,12,0.7)", border: "1px solid rgba(255,255,255,0.3)" }}
                  >
                    <Maximize2 className="h-4 w-4" />
                    전체화면
                  </button>
                )}
              </div>

              {mc.pendingAction === "event" && (
                <p className="flex items-center justify-center gap-1.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> 기록 처리중…
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {isLive && uncheckedAssistGoals.length > 0 && (
          <Card
            style={{
              borderColor: "rgba(245,158,11,0.42)",
              background: "rgba(245,158,11,0.04)",
            }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between gap-2 text-base">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  득점·어시 실시간 체크
                </span>
                <Badge className="bg-amber-100 text-amber-700">
                  {uncheckedAssistGoals.length}건
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                심판·부심이 어시스트를 놓친 골입니다. 관리자가 확인되는 즉시 선수 선택으로 보강할 수 있습니다.
              </p>
              <div className="space-y-2">
                {uncheckedAssistGoals.map((goal) => (
                  <div
                    key={goal.id}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-white px-3 py-2"
                    style={{ borderColor: "rgba(245,158,11,0.28)" }}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">
                        {goal.minute}&apos; {goal.playerName} 득점
                      </p>
                      <p className="truncate text-xs" style={{ color: "var(--muted-foreground)" }}>
                        {goal.teamId === homeSide.id ? homeSide.name : awaySide.name}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-[40px] shrink-0 border-amber-300 text-amber-700"
                      onClick={() => openAssistPicker(goal)}
                      disabled={mc.pendingAction !== null}
                    >
                      어시 체크
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 이벤트 타임라인 — 관리자 관리뷰. 골에 어시스트 추가 + 누락/실수 이벤트 취소.
            (심판은 코트 탭으로 골/반칙/카드 기록, 관리자는 여기서 어시스트 보강·정정) */}
        {(isLive || isFinished) && mc.events.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">이벤트 타임라인</CardTitle>
            </CardHeader>
            <CardContent>
              <EventTimeline
                events={mc.events}
                onCancel={(id) => mc.cancelEvent(id)}
                onAddAssist={openAssistPicker}
                canEdit={isLive}
                uncheckedGoalIds={uncheckedAssistGoalIds}
              />
              {mc.pendingAction === "cancelEvent" && (
                <p
                  className="mt-2 flex items-center justify-center gap-1.5 text-xs"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> 취소 처리중…
                </p>
              )}
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
              {/* 혼성 풋살 리그 MOM 선정 기준 안내 — 매너플레이 우선. */}
              <div
                className="flex items-start gap-2 rounded-lg p-2.5 text-[12px] leading-relaxed"
                style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}
              >
                <Trophy className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--accent-gold)" }} />
                <span>
                  <b style={{ color: "var(--foreground)" }}>매너플레이가 MOM 선정의 핵심 기준</b>입니다.
                  배려·존중, 과열 진정, 성별·체격 차 배려를 우선하세요. 골·어시는 보조이며,
                  기록이 좋아도 매너에 어긋나면 선정 대상이 아닙니다.
                </span>
              </div>
              {matchData.momPlayerId && (
                <p className="text-sm">
                  현재 MOM:{" "}
                  <span className="font-bold">
                    {allPlayers.find((p) => p.id === matchData.momPlayerId)
                      ?.name || matchData.momPlayerId}
                  </span>
                </p>
              )}
              {isLive ? (
                <>
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
                    MOM은 경기 종료 전에 선정해야 선수 통계에 반영됩니다.
                  </p>
                </>
              ) : (
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  종료된 경기는 MOM을 변경할 수 없습니다. 정정이 필요하면 관리자 기록 보정 절차로 처리하세요.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {renderAssistDialog()}

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
                경고)이 자동으로 업데이트됩니다. 플래티넘 카드 선수의 레이팅이
                재계산됩니다.
              </p>
              <div className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold">심판 MOM 선정</p>
                    <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                      경기 종료 전에 최종 MOM을 선택하세요.
                    </p>
                  </div>
                  {selectedEndMom && (
                    <Badge variant="secondary">현재 선택: {selectedEndMom.name}</Badge>
                  )}
                </div>
                <Select
                  value={endMomValue}
                  onValueChange={setEndMomChoice}
                  disabled={mc.pendingAction !== null}
                >
                  <SelectTrigger className="min-h-[44px] w-full">
                    <SelectValue placeholder="MOM 선수 또는 MOM 없음 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {!matchData.momPlayerId && (
                      <SelectItem value={NO_MOM_VALUE}>MOM 없음</SelectItem>
                    )}
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
              </div>
              {!endMomReady && (
                <div
                  role="status"
                  className="flex items-start gap-2 rounded-lg border p-3 text-sm"
                  style={{
                    borderColor: "rgba(245,158,11,0.38)",
                    background: "rgba(245,158,11,0.10)",
                    color: "rgb(146,64,14)",
                  }}
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>MOM 선수 또는 MOM 없음 중 하나를 선택해야 경기를 종료할 수 있습니다.</span>
                </div>
              )}
              {missingAssistCount > 0 && (
                <div
                  role="status"
                  className="flex items-start gap-2 rounded-lg border p-3 text-sm"
                  style={{
                    borderColor: "rgba(245,158,11,0.38)",
                    background: "rgba(245,158,11,0.10)",
                    color: "rgb(146,64,14)",
                  }}
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    골 {goalEventCount}개, 어시스트 {assistEventCount}개입니다. 어시스트 누락이 있으면 종료 전에 관리자 기록을 확인하세요.
                  </span>
                </div>
              )}
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
                  disabled={mc.pendingAction !== null || !endMomReady}
                  aria-busy={endPending}
                >
                  {mc.pendingAction === "mom" ? (
                    <>
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      MOM 저장중…
                    </>
                  ) : endPending ? (
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

        {/* 몰수패 처리 다이얼로그(관리자) — 지목 팀 0, 상대 3. 규정 제13조/대회규정 제9조. */}
        <Dialog open={forfeitOpen} onOpenChange={(open) => { if (!forfeiting) setForfeitOpen(open); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>몰수패 처리</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                몰수패할 팀을 선택하세요. 공식 기록은 <b>3:0</b>으로 확정되며(상대 승), 개인 통계는
                누적되지 않습니다. 무단 불참·자격 위반·팀 차원 위반 시 적용합니다.
              </p>
              {forfeitErr && (
                <p role="alert" className="text-sm text-red-600">{forfeitErr}</p>
              )}
              <div className="grid grid-cols-1 gap-2">
                <Button
                  variant="destructive"
                  className="min-h-[44px]"
                  disabled={forfeiting}
                  onClick={() => handleForfeit(matchData.homeTeamId)}
                >
                  {matchData.homeTeamName} 몰수패 → {matchData.awayTeamName} 3:0 승
                </Button>
                <Button
                  variant="destructive"
                  className="min-h-[44px]"
                  disabled={forfeiting}
                  onClick={() => handleForfeit(matchData.awayTeamId)}
                >
                  {matchData.awayTeamName} 몰수패 → {matchData.homeTeamName} 3:0 승
                </Button>
                <Button
                  variant="ghost"
                  className="min-h-[44px]"
                  disabled={forfeiting}
                  onClick={() => setForfeitOpen(false)}
                >
                  취소
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
  forceTappable,
  visualOnly,
}: {
  player: Player;
  teamId: string;
  eventType: MatchEventType | "";
  pending: boolean;
  onRecord: (player: Player, teamId: string) => void | Promise<void>;
  playerStat: (pid: string, type: MatchEventType) => number;
  accent: Accent;
  onGrass: boolean;
  // true=이벤트 유형 선택과 무관하게 탭 가능(전체화면 액션 팝업 진입용).
  forceTappable?: boolean;
  // true=표시 전용. 클릭은 하지 않지만 disabled opacity를 적용하지 않는다.
  visualOnly?: boolean;
}) {
  const g = playerStat(player.id, "goal");
  const a = playerStat(player.id, "assist");
  const y = playerStat(player.id, "yellow_card");
  const r = playerStat(player.id, "red_card");
  const tappable = forceTappable || !!eventType;
  return (
    <button
      type="button"
      onClick={() => {
        if (visualOnly) return;
        void onRecord(player, teamId);
      }}
      disabled={pending || (!tappable && !visualOnly)}
      aria-disabled={visualOnly || !tappable || pending}
      tabIndex={visualOnly ? -1 : undefined}
      className="flex min-w-0 flex-col items-center gap-0.5 transition disabled:cursor-default"
      title={tappable ? `#${player.number} ${player.name}` : `#${player.number} ${player.name}`}
    >
      <span
        className={`relative flex items-center justify-center rounded-full border-2 font-black tabular-nums shadow-md ${
          onGrass ? "h-9 w-9 text-sm sm:h-11 sm:w-11 sm:text-base" : "h-8 w-8 text-xs sm:h-9 sm:w-9 sm:text-sm"
        }`}
        style={{ background: accent.bg, color: accent.fg, borderColor: accent.ring }}
      >
        {player.number}
        {r > 0 ? (
          <span
            className="absolute right-0 top-0 h-3 w-2 rounded-[2px]"
            style={{ background: "#dc2626", border: "1px solid #fff" }}
          />
        ) : y > 0 ? (
          <span
            className="absolute right-0 top-0 h-3 w-2 rounded-[2px]"
            style={{ background: "#facc15", border: "1px solid #fff" }}
          />
        ) : null}
        {g > 0 && (
          <span
            className="absolute -bottom-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-[9px] font-bold"
            style={{ background: "#fff", color: "#0d1b2a", border: "1px solid rgba(0,0,0,0.2)" }}
          >
            ⚽{g > 1 ? g : ""}
          </span>
        )}
        {a > 0 && (
          <span
            className="absolute -bottom-0.5 -left-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-[9px] font-bold"
            style={{ background: "#0047ab", color: "#fff", border: "1px solid #fff" }}
          >
            A{a > 1 ? a : ""}
          </span>
        )}
      </span>
      <span
        className="max-w-[56px] truncate text-[10px] font-semibold sm:max-w-[72px]"
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

function EmptyPlayerSlot({
  teamName,
  index,
  accent,
  onGrass,
}: {
  teamName: string;
  index: number;
  accent: Accent;
  onGrass: boolean;
}) {
  return (
    <div
      className="flex min-w-0 flex-col items-center gap-0.5"
      role="img"
      aria-label={`${teamName} ${index + 1}번 코트 슬롯 미등록`}
      title={`${teamName} 코트 슬롯 미등록`}
    >
      <span
        className={`flex items-center justify-center rounded-full border-2 font-black shadow-md ${
          onGrass ? "h-9 w-9 text-[10px] sm:h-11 sm:w-11 sm:text-xs" : "h-8 w-8 text-[10px] sm:h-9 sm:w-9 sm:text-xs"
        }`}
        style={{ background: "#f8fafc", color: accent.bg, borderColor: accent.bg }}
      >
        빈
      </span>
      <span
        className="max-w-[56px] truncate text-[10px] font-semibold sm:max-w-[72px]"
        style={
          onGrass
            ? { color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,0.85)" }
            : { color: "var(--muted-foreground)" }
        }
      >
        미등록
      </span>
    </div>
  );
}

/** 출전 선수 포메이션 — 코트는 항상 5 슬롯(GK·수비·공격 라인)으로 표시. */
function FormationControls({
  team,
  isAway,
  eventType,
  pending,
  onRecord,
  playerStat,
  onGrass,
  forceTappable,
  balanced,
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
  // true=이벤트 유형 미선택이어도 탭 가능(전체화면 액션 팝업).
  forceTappable?: boolean;
  // true=상단 헤더가 없을 때 골 중심으로 상하 대칭 배치(전체화면). 기본은 pt-14 로 헤더 회피.
  balanced?: boolean;
}) {
  const accent = teamAccent(team.side);
  const grass = onGrass ?? isAway;
  const five = [...team.onCourt]
    .sort((a, b) => (a.position === "GK" ? -1 : 0) - (b.position === "GK" ? -1 : 0))
    .slice(0, 5);
  const lines = [[0], [1, 2], [3, 4]];

  return (
    <div
      className={`flex h-full w-full items-stretch justify-evenly gap-1 px-2 ${
        balanced ? "py-4" : "pb-3 pt-14"
      } ${
        isAway
          ? "flex-col-reverse landscape:flex-row-reverse md:flex-row-reverse"
          : "flex-col landscape:flex-row md:flex-row"
      }`}
    >
      {lines.map((line, i) => (
        <div
          key={i}
          className="flex flex-1 flex-row items-center justify-evenly gap-1.5 landscape:flex-col md:flex-col md:gap-3"
        >
          {line.map((slotIndex) => {
            const p = five[slotIndex];
            return p ? (
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
                forceTappable={forceTappable}
              />
            ) : (
              <EmptyPlayerSlot
                key={`${team.id}-empty-${slotIndex}`}
                teamName={team.name}
                index={slotIndex}
                accent={accent}
                onGrass={grass}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** 코트 절반(한 팀) — 잔디 위 포메이션. 5 슬롯을 GK·수비·공격 라인으로 배치.
    좌상단(home)·우상단(away) 코너에 팀명/점수/누적 스탯 스트립. */
function PitchFormation({
  team,
  eventType,
  pending,
  onRecord,
  playerStat,
  hideHeader,
  forceTappable,
  balanced,
}: {
  team: TeamSide;
  eventType: MatchEventType | "";
  pending: boolean;
  onRecord: (player: Player, teamId: string) => void | Promise<void>;
  playerStat: (pid: string, type: MatchEventType) => number;
  /** true 면 코너의 팀명·점수·집계 스트립을 숨긴다(전체화면: 상단 전광판이 대신 표시). */
  hideHeader?: boolean;
  /** true=이벤트 유형 미선택이어도 탭 가능(전체화면 액션 팝업). */
  forceTappable?: boolean;
  /** true=골 중심 상하 대칭 배치(전체화면). */
  balanced?: boolean;
}) {
  const isAway = team.side === "away";

  return (
    <div className="relative h-full w-full">
      {/* 정보 스트립 — 코너 (전체화면에선 숨김) */}
      {!hideHeader && (
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
      )}

      {/* 포메이션 — 원정만 코트 위. 홈은 페이지 상단 FormationControls */}
      {isAway ? (
        <FormationControls
          team={team}
          isAway
          eventType={eventType}
          pending={pending}
          onRecord={onRecord}
          playerStat={playerStat}
          forceTappable={forceTappable}
          balanced={balanced}
        />
      ) : null}
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
