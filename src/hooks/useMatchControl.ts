"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useDataStore } from "@/stores/dataStore";
import {
  MATCH_DURATION_SECONDS,
  clampMatchElapsedSeconds,
  matchMinuteFromElapsed,
} from "@/lib/match-config";
import type { Match, LiveMatch, Player, MatchEventType, MatchEvent } from "@/types";

const NEXT_MATCH_READY_NOTICE_SECONDS_BEFORE_END = 10 * 60;
const NEXT_MATCH_READY_NOTICE_AT_SECONDS = Math.max(
  0,
  MATCH_DURATION_SECONDS - NEXT_MATCH_READY_NOTICE_SECONDS_BEFORE_END
);

// §3 여정E / §6 A10 — 실패 위치별 식별 (에러를 1줄로 뭉뚱그리지 않음)
export type MatchActionScope =
  | "load"
  | "start"
  | "pause"
  | "resume"
  | "end"
  | "event"
  | "cancelEvent"
  | "mom";

export interface MatchActionError {
  scope: MatchActionScope;
  message: string;
}

interface UseMatchControlOptions {
  tournamentId: string;
  matchId: string;
}

interface MatchControlState {
  match: Match | null;
  liveMatch: LiveMatch | null;
  homePlayers: Player[];
  awayPlayers: Player[];
  events: MatchEvent[];
  loading: boolean;
  /** 마지막 실패의 위치별 정보 (Q5/A10) — 위치별 메시지+재시도용 */
  actionError: MatchActionError | null;
  /** 하위호환: actionError.message 평문 */
  error: string;
  /** 진행 중인 액션 scope (더블집계 UX 차단 — 버튼 disabled+aria-busy) */
  pendingAction: MatchActionScope | null;
  /** navigator.onLine 기반 온라인 여부 (오프라인 배너) */
  isOnline: boolean;
  elapsedSeconds: number;
  currentHalf: 1 | 2;
  isRunning: boolean;
}

interface MatchControlActions {
  /** 액션 성공 여부 반환 (재진입 차단 시·실패 시 false) */
  startMatch: () => Promise<boolean>;
  pauseMatch: () => Promise<boolean>;
  resumeMatch: () => Promise<boolean>;
  endMatch: () => Promise<boolean>;
  addEvent: (event: {
    type: MatchEventType;
    playerId: string;
    playerName: string;
    teamId: string;
  }) => Promise<boolean>;
  cancelEvent: (eventId: string) => Promise<boolean>;
  setMom: (playerId: string) => Promise<boolean>;
  reload: () => Promise<void>;
  /** 에러 배너의 재시도/닫기 후 상태 해제 */
  clearError: () => void;
}

export function useMatchControl({
  tournamentId,
  matchId,
}: UseMatchControlOptions): MatchControlState & MatchControlActions {
  const store = useDataStore();

  const [match, setMatch] = useState<Match | null>(null);
  const [homePlayers, setHomePlayers] = useState<Player[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<MatchActionError | null>(null);
  const [pendingAction, setPendingAction] = useState<MatchActionScope | null>(
    null
  );
  const [isOnline, setIsOnline] = useState(true);
  const [localElapsed, setLocalElapsed] = useState(0);
  const [localHalf, setLocalHalf] = useState<1 | 2>(1);
  const [localRunning, setLocalRunning] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncCounterRef = useRef(0);
  const nextMatchReadyNoticeSentRef = useRef(false);

  // Find matching live match from store subscription
  const liveMatch = store.liveMatches.find((m) => m.id === matchId) || null;

  // Extract events from live match
  const events: MatchEvent[] = liveMatch
    ? Array.isArray(liveMatch.events)
      ? liveMatch.events
      : Object.values(liveMatch.events || {})
    : match?.events || [];

  // Sort events by timestamp descending (newest first)
  const sortedEvents = [...events].sort((a, b) => b.timestamp - a.timestamp);

  // Load initial data
  const loadData = useCallback(async () => {
    setLoading(true);
    setActionError(null);
    try {
      const matchData = await store.fetchMatch(tournamentId, matchId);
      if (!matchData) {
        setActionError({ scope: "load", message: "경기를 찾을 수 없습니다" });
        setLoading(false);
        return;
      }
      setMatch(matchData);

      // Load team rosters in parallel
      const [home, away] = await Promise.all([
        store.fetchTeamPlayers(matchData.homeTeamId),
        store.fetchTeamPlayers(matchData.awayTeamId),
      ]);
      setHomePlayers(home);
      setAwayPlayers(away);
    } catch {
      setActionError({
        scope: "load",
        message: "데이터를 불러오는데 실패했습니다",
      });
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, matchId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    nextMatchReadyNoticeSentRef.current = false;
  }, [matchId]);

  // Subscribe to live matches
  useEffect(() => {
    const unsubscribe = store.subscribeLiveMatches();
    return unsubscribe;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // §3 여정E — 오프라인 인지 (navigator.onLine + online/offline 이벤트)
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const sync = () => setIsOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  // Sync local timer state from live match
  useEffect(() => {
    if (liveMatch) {
      setLocalElapsed(clampMatchElapsedSeconds(liveMatch.elapsedSeconds));
      setLocalHalf(liveMatch.currentHalf);
      setLocalRunning(liveMatch.isRunning);
    }
  }, [liveMatch]);

  // Timer interval: count only active play time. Injury/stoppage pauses stop the
  // clock, and at 12:00 the clock stops while the match remains live until the
  // referee/admin confirms "경기 종료".
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!localRunning) return;

    timerRef.current = setInterval(() => {
      let reachedRegulationTime = false;
      let nextElapsedForSync = 0;
      let shouldNotifyNextMatchReady = false;

      setLocalElapsed((prev) => {
        const next = clampMatchElapsedSeconds(prev + 1);
        nextElapsedForSync = next;
        reachedRegulationTime = next >= MATCH_DURATION_SECONDS;
        shouldNotifyNextMatchReady =
          !nextMatchReadyNoticeSentRef.current &&
          next >= NEXT_MATCH_READY_NOTICE_AT_SECONDS &&
          next < MATCH_DURATION_SECONDS;
        syncCounterRef.current += 1;

        // Sync to Supabase every 5 seconds.
        if (syncCounterRef.current >= 5) {
          syncCounterRef.current = 0;
          void store.updateMatchTimer(matchId, next, localHalf).catch((error) => {
            console.error("[useMatchControl] timer sync failed:", error);
          });
        }

        return next;
      });

      if (shouldNotifyNextMatchReady) {
        nextMatchReadyNoticeSentRef.current = true;
        void store.notifyNextMatchReady(matchId).catch((error) => {
          console.error("[useMatchControl] next match readiness notify failed:", error);
        });
      }

      if (reachedRegulationTime) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setLocalRunning(false);
        void (async () => {
          try {
            await store.updateMatchTimer(matchId, nextElapsedForSync, localHalf);
            await store.pauseMatch(matchId);
          } catch {
            setActionError({
              scope: "pause",
              message: "12분 도달 후 타이머 정지 저장에 실패했습니다",
            });
          }
        })();
      }
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localRunning, matchId, localHalf]);

  // Q5/A10 — 액션 실행 가드: 진행 중이면 재진입 차단(더블탭→더블집계 방지),
  // 시작 시 pendingAction 설정(버튼 disabled+aria-busy 근거), 실패 시 위치별 에러.
  const pendingRef = useRef<MatchActionScope | null>(null);
  const runAction = useCallback(
    async (
      scope: MatchActionScope,
      failMessage: string,
      fn: () => Promise<void>
    ): Promise<boolean> => {
      // 재진입 방지: 어떤 액션이든 진행 중이면 무시 (더블집계 차단)
      if (pendingRef.current) return false;
      pendingRef.current = scope;
      setPendingAction(scope);
      setActionError(null);
      try {
        await fn();
        return true;
      } catch {
        setActionError({ scope, message: failMessage });
        return false;
      } finally {
        pendingRef.current = null;
        setPendingAction(null);
      }
    },
    []
  );

  const clearError = useCallback(() => setActionError(null), []);

  // Actions
  const startMatch = useCallback(
    () =>
      runAction("start", "경기 시작에 실패했습니다", async () => {
        await store.startMatch(tournamentId, matchId);
        nextMatchReadyNoticeSentRef.current = false;
        setLocalElapsed(0);
        setLocalHalf(1);
        setLocalRunning(true);
      }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
    [tournamentId, matchId, runAction]
  );

  const pauseMatch = useCallback(
    () =>
      runAction("pause", "일시정지에 실패했습니다", async () => {
        await store.updateMatchTimer(matchId, clampMatchElapsedSeconds(localElapsed), localHalf);
        await store.pauseMatch(matchId);
        setLocalRunning(false);
      }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
    [matchId, localElapsed, localHalf, runAction]
  );

  const resumeMatch = useCallback(
    () => {
      if (localElapsed >= MATCH_DURATION_SECONDS) {
        setActionError({
          scope: "resume",
          message: "규정 시간 12분을 모두 채웠습니다. 경기 종료를 눌러주세요.",
        });
        return Promise.resolve(false);
      }
      return runAction("resume", "재개에 실패했습니다", async () => {
        await store.resumeMatch(matchId);
        setLocalRunning(true);
      });
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
    [matchId, localElapsed, runAction]
  );

  const endMatch = useCallback(
    () =>
      runAction("end", "경기 종료에 실패했습니다", async () => {
        // Sync timer one last time
        await store.updateMatchTimer(matchId, clampMatchElapsedSeconds(localElapsed), localHalf);
        await store.endMatch(tournamentId, matchId);
        setLocalRunning(false);
        // Reload match data to get final state
        const finalMatch = await store.fetchMatch(tournamentId, matchId);
        if (finalMatch) setMatch(finalMatch);
      }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
    [tournamentId, matchId, localElapsed, localHalf, runAction]
  );

  const addEvent = useCallback(
    (event: {
      type: MatchEventType;
      playerId: string;
      playerName: string;
      teamId: string;
    }) =>
      runAction("event", "이벤트 기록에 실패했습니다", async () => {
        const minute = matchMinuteFromElapsed(localElapsed);
        // 규정 제12조③(동일 경기 경고 2회 누적 → 퇴장)은 add_match_event RPC 가
        // 같은 트랜잭션에서 판정·기록한다. 클라이언트는 방금 넣은 경고가 realtime
        // 으로 자기 목록에 반영됐는지 알 수 없어 여기서 세면 오판한다.
        await store.addMatchEvent(tournamentId, matchId, {
          ...event,
          minute,
          half: localHalf,
        });
      }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
    [tournamentId, matchId, localElapsed, localHalf, runAction]
  );

  const cancelEvent = useCallback(
    (eventId: string) =>
      runAction("cancelEvent", "이벤트 취소에 실패했습니다", async () => {
        await store.cancelMatchEvent(tournamentId, matchId, eventId);
      }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
    [tournamentId, matchId, runAction]
  );

  const setMom = useCallback(
    (playerId: string) =>
      runAction("mom", "MOM 선정에 실패했습니다", async () => {
        await store.setMatchMom(tournamentId, matchId, playerId);
      }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
    [tournamentId, matchId, runAction]
  );

  return {
    match,
    liveMatch,
    homePlayers,
    awayPlayers,
    events: sortedEvents,
    loading,
    actionError,
    error: actionError?.message ?? "",
    pendingAction,
    isOnline,
    elapsedSeconds: localElapsed,
    currentHalf: localHalf,
    isRunning: localRunning,
    startMatch,
    pauseMatch,
    resumeMatch,
    endMatch,
    addEvent,
    cancelEvent,
    setMom,
    reload: loadData,
    clearError,
  };
}
