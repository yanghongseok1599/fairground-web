"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useMatchControl } from "@/hooks/useMatchControl";
import { useDataStore } from "@/stores/dataStore";
import { AdminHeader } from "@/components/admin-header";
import { AdminLoading } from "@/components/admin-loading";
import { AdminGuard } from "@/components/admin-guard";
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
} from "lucide-react";
import type { MatchEventType, MatchLineupEntry, Player } from "@/types";

const EVENT_TYPES: { value: MatchEventType; label: string; emoji: string }[] = [
  { value: "goal", label: "골", emoji: "⚽" },
  { value: "assist", label: "어시스트", emoji: "🅰️" },
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
  const [eventTeamSide, setEventTeamSide] = useState<"home" | "away">("home");
  const [eventType, setEventType] = useState<MatchEventType | "">("");
  const [eventPlayerId, setEventPlayerId] = useState("");

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

  const homeScore = mc.liveMatch?.homeScore ?? matchData.homeScore;
  const awayScore = mc.liveMatch?.awayScore ?? matchData.awayScore;

  // Lineup-by-team 분리 (메모)
  const homeLineup = lineup.filter((e) => e.teamId === matchData.homeTeamId);
  const awayLineup = lineup.filter((e) => e.teamId === matchData.awayTeamId);

  // Players for event input — 라인업 있으면 라인업 선수로 필터, 없으면 전체 멤버.
  const activeTeamId =
    eventTeamSide === "home" ? matchData.homeTeamId : matchData.awayTeamId;
  const activeTeamMembers: Player[] =
    eventTeamSide === "home" ? mc.homePlayers : mc.awayPlayers;
  const activeLineup = eventTeamSide === "home" ? homeLineup : awayLineup;
  const activeLineupIds = new Set(activeLineup.map((e) => e.playerId));
  const activePlayers: Player[] =
    activeLineup.length > 0
      ? activeTeamMembers.filter((p) => activeLineupIds.has(p.id))
      : activeTeamMembers;

  // All players for MOM selection (라인업 있으면 양 팀 라인업 합집합)
  const allLineupIds = new Set(lineup.map((e) => e.playerId));
  const allTeamMembers = [...mc.homePlayers, ...mc.awayPlayers];
  const allPlayers: Player[] =
    lineup.length > 0
      ? allTeamMembers.filter((p) => allLineupIds.has(p.id))
      : allTeamMembers;

  const handleAddEvent = async () => {
    if (!eventType || !eventPlayerId) return;
    const player = activePlayers.find((p) => p.id === eventPlayerId);
    if (!player) return;

    const ok = await mc.addEvent({
      type: eventType,
      playerId: eventPlayerId,
      playerName: player.name,
      teamId: activeTeamId,
    });

    // 성공 시에만 입력 초기화 — 실패 시 입력 유지로 재시도 가능
    if (ok) {
      setEventType("");
      setEventPlayerId("");
    }
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
        return () => handleAddEvent();
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

      <div className="mx-auto max-w-md space-y-4 p-4">
        {/* Match Info Bar */}
        <Card style={{ borderColor: "var(--accent-gold)" }}>
          <CardContent className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="text-center">
                <div className="text-sm font-bold">
                  {matchData.homeTeamName}
                </div>
              </div>
              <div className="flex items-center gap-1 text-2xl font-black tabular-nums">
                <span>{homeScore}</span>
                <span style={{ color: "var(--muted-foreground)" }}>:</span>
                <span>{awayScore}</span>
              </div>
              <div className="text-center">
                <div className="text-sm font-bold">
                  {matchData.awayTeamName}
                </div>
              </div>
            </div>
            <Badge
              className={
                isLive
                  ? "bg-red-100 text-red-700"
                  : isFinished
                    ? "bg-gray-100 text-gray-700"
                    : "bg-blue-100 text-blue-700"
              }
            >
              {isLive && (
                <Circle className="mr-1 h-2 w-2 animate-pulse fill-red-500 text-red-500" />
              )}
              {isScheduled ? "예정" : isLive ? "진행중" : "종료"}
            </Badge>
          </CardContent>
        </Card>

        {/* 출전 명단 (readonly) — 라인업이 있으면 이벤트/MOM 드롭다운이 라인업 선수로 자동 필터됨 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              출전 명단
              {lineup.length > 0 && (
                <span
                  className="text-[10px] font-normal"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  · 선수 드롭다운이 명단으로 필터됨
                </span>
              )}
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

        {/* Timer Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">타이머</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-center">
              <div className="text-5xl font-black tabular-nums tracking-tight">
                {formatTime(mc.elapsedSeconds)}
              </div>
              <div
                className="mt-1 text-sm"
                style={{ color: "var(--muted-foreground)" }}
              >
                {mc.currentHalf === 1 ? "전반" : "후반"}
                {mc.isRunning && (
                  <span className="ml-2 inline-flex items-center text-red-500">
                    <Circle className="mr-0.5 h-1.5 w-1.5 animate-pulse fill-current" />
                    진행중
                  </span>
                )}
              </div>
            </div>

            {/* 주요 액션 — 터치타깃 44px+, 진행 중 disabled+스피너+aria-busy.
                위험 액션(경기 종료)은 시각·위치 분리 (A10 / SC 2.5.5). */}
            <div className="flex flex-wrap justify-center gap-2">
              {isScheduled && (
                <Button
                  onClick={() => mc.startMatch()}
                  className="min-h-[44px] bg-green-600 px-5 text-white hover:bg-green-700"
                  disabled={mc.pendingAction !== null}
                  aria-busy={mc.pendingAction === "start"}
                >
                  {mc.pendingAction === "start" ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-1 h-4 w-4" />
                  )}
                  {mc.pendingAction === "start" ? "시작 처리중…" : "경기 시작"}
                </Button>
              )}

              {isLive && mc.isRunning && (
                <Button
                  onClick={() => mc.pauseMatch()}
                  variant="secondary"
                  className="min-h-[44px] px-5"
                  disabled={mc.pendingAction !== null}
                  aria-busy={mc.pendingAction === "pause"}
                >
                  {mc.pendingAction === "pause" ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Pause className="mr-1 h-4 w-4" />
                  )}
                  {mc.pendingAction === "pause" ? "처리중…" : "일시정지"}
                </Button>
              )}

              {isLive && !mc.isRunning && (
                <Button
                  onClick={() => mc.resumeMatch()}
                  className="min-h-[44px] px-5"
                  disabled={mc.pendingAction !== null}
                  aria-busy={mc.pendingAction === "resume"}
                >
                  {mc.pendingAction === "resume" ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-1 h-4 w-4" />
                  )}
                  {mc.pendingAction === "resume" ? "처리중…" : "재개"}
                </Button>
              )}

              {isLive && mc.currentHalf === 1 && !mc.isRunning && (
                <Button
                  onClick={() => mc.startSecondHalf()}
                  variant="outline"
                  className="min-h-[44px] px-5"
                  disabled={mc.pendingAction !== null}
                  aria-busy={mc.pendingAction === "secondHalf"}
                >
                  {mc.pendingAction === "secondHalf" && (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  )}
                  {mc.pendingAction === "secondHalf"
                    ? "처리중…"
                    : "후반 시작"}
                </Button>
              )}
            </div>

            {/* 위험 액션 분리 영역 — 실수 방지 위해 별도 행·상단 구분선 */}
            {isLive && (
              <div className="mt-1 flex justify-center border-t pt-3">
                <Button
                  onClick={() => setEndDialogOpen(true)}
                  variant="destructive"
                  className="min-h-[44px] px-6"
                  disabled={mc.pendingAction !== null}
                  aria-busy={endPending}
                >
                  {endPending ? (
                    <>
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      종료 처리중…
                    </>
                  ) : (
                    <>
                      <Square className="mr-1 h-4 w-4" />
                      경기 종료
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

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
              {/* Team toggle */}
              <div className="flex overflow-hidden rounded-lg border">
                <button
                  className="flex-1 py-3 text-sm font-medium transition-colors"
                  style={
                    eventTeamSide === "home"
                      ? {
                          background: "var(--primary)",
                          color: "var(--primary-foreground)",
                        }
                      : {
                          background: "var(--background)",
                          color: "var(--muted-foreground)",
                        }
                  }
                  onClick={() => {
                    setEventTeamSide("home");
                    setEventPlayerId("");
                  }}
                >
                  {matchData.homeTeamName}
                </button>
                <button
                  className="flex-1 py-3 text-sm font-medium transition-colors"
                  style={
                    eventTeamSide === "away"
                      ? {
                          background: "var(--primary)",
                          color: "var(--primary-foreground)",
                        }
                      : {
                          background: "var(--background)",
                          color: "var(--muted-foreground)",
                        }
                  }
                  onClick={() => {
                    setEventTeamSide("away");
                    setEventPlayerId("");
                  }}
                >
                  {matchData.awayTeamName}
                </button>
              </div>

              {/* Event type */}
              <div className="space-y-1">
                <label
                  className="text-xs font-medium"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  이벤트 유형
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {EVENT_TYPES.map((et) => (
                    <button
                      key={et.value}
                      className="min-h-[44px] rounded-lg border py-2 text-center text-xs transition-all"
                      style={
                        eventType === et.value
                          ? {
                              borderColor: "var(--accent-gold)",
                              background: "var(--secondary)",
                              fontWeight: 600,
                            }
                          : undefined
                      }
                      onClick={() => setEventType(et.value)}
                    >
                      <div className="text-base">{et.emoji}</div>
                      <div className="mt-0.5">{et.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Player select */}
              <div className="space-y-1">
                <label
                  className="text-xs font-medium"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  선수
                </label>
                <Select
                  value={eventPlayerId}
                  onValueChange={setEventPlayerId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="선수 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {activePlayers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        #{p.number} {p.name} ({p.position})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                className="min-h-[44px] w-full"
                onClick={handleAddEvent}
                disabled={
                  !eventType || !eventPlayerId || mc.pendingAction !== null
                }
                aria-busy={mc.pendingAction === "event"}
              >
                {mc.pendingAction === "event" ? (
                  <>
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    기록 처리중…
                  </>
                ) : (
                  <>
                    <Plus className="mr-1 h-4 w-4" />
                    이벤트 기록
                  </>
                )}
              </Button>
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
