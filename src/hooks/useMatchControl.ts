"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useDataStore } from "@/stores/dataStore";
import type { Match, LiveMatch, Player, MatchEventType, MatchEvent } from "@/types";

// §3 여정E / §6 A10 — 실패 위치별 식별 (에러를 1줄로 뭉뚱그리지 않음)
export type MatchActionScope =
  | "load"
  | "start"
  | "pause"
  | "resume"
  | "secondHalf"
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
  startSecondHalf: () => Promise<boolean>;
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
      setLocalElapsed(liveMatch.elapsedSeconds);
      setLocalHalf(liveMatch.currentHalf);
      setLocalRunning(liveMatch.isRunning);
    }
  }, [liveMatch]);

  // Timer interval: tick every second, sync to Firebase every 5s
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!localRunning) return;

    timerRef.current = setInterval(() => {
      setLocalElapsed((prev) => {
        const next = prev + 1;
        syncCounterRef.current += 1;

        // Sync to Firebase every 5 seconds
        if (syncCounterRef.current >= 5) {
          syncCounterRef.current = 0;
          store.updateMatchTimer(matchId, next, localHalf);
        }

        return next;
      });
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
        await store.updateMatchTimer(matchId, localElapsed, localHalf);
        await store.pauseMatch(matchId);
        setLocalRunning(false);
      }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
    [matchId, localElapsed, localHalf, runAction]
  );

  const resumeMatch = useCallback(
    () =>
      runAction("resume", "재개에 실패했습니다", async () => {
        await store.resumeMatch(matchId);
        setLocalRunning(true);
      }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
    [matchId, runAction]
  );

  const startSecondHalf = useCallback(
    () =>
      runAction("secondHalf", "후반전 시작에 실패했습니다", async () => {
        setLocalHalf(2);
        setLocalElapsed(0);
        syncCounterRef.current = 0;
        await store.updateMatchTimer(matchId, 0, 2);
        await store.resumeMatch(matchId);
        setLocalRunning(true);
      }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
    [matchId, runAction]
  );

  const endMatch = useCallback(
    () =>
      runAction("end", "경기 종료에 실패했습니다", async () => {
        // Sync timer one last time
        await store.updateMatchTimer(matchId, localElapsed, localHalf);
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
        const minute = Math.floor(localElapsed / 60);
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
    startSecondHalf,
    addEvent,
    cancelEvent,
    setMom,
    reload: loadData,
    clearError,
  };
}
