"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  PUSH_SUBSCRIPTION_CHANGED,
  connectPush, unsubscribeAndDelete,
} from "@/lib/push";
import { PUSH_CONNECTION_MESSAGE } from "@/lib/notifications/push-connection-result";
import type { TournamentPushState } from "../policy";
import { getPushEnvironment } from "../push-environment";
import { readTournamentPushStatus, type PushPermission } from "../push-status";

export function useTournamentPush() {
  const { user } = useAuth();
  const userId = user?.uid;
  const [snapshot, setSnapshot] = useState<{ userId?: string; state: TournamentPushState; permission: PushPermission }>({ state: "loading", permission: "unavailable" });
  const [environment, setEnvironment] = useState<ReturnType<typeof getPushEnvironment>>({ ios: false, installed: false, needsInstall: false, supported: false, browser: "other", inApp: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const revision = useRef(0);
  const inFlight = useRef(false);
  const state = snapshot.userId === userId ? snapshot.state : "loading";

  const refresh = useCallback(async (): Promise<TournamentPushState> => {
    const request = ++revision.current;
    setSnapshot({ userId, state: "loading", permission: "unavailable" });
    const result = await readTournamentPushStatus(userId);
    if (request !== revision.current) return "loading";
    setEnvironment(result.environment);
    setSnapshot({ userId, state: result.state, permission: result.permission });
    return result.state;
  }, [userId]);

  useEffect(() => {
    const invalidate = () => { revision.current++; };
    setError("");
    void refresh();
    const sync = () => { if (!inFlight.current && document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", sync);
    window.addEventListener("pageshow", sync);
    window.addEventListener(PUSH_SUBSCRIPTION_CHANGED, sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      invalidate();
      window.removeEventListener("focus", sync);
      window.removeEventListener("pageshow", sync);
      window.removeEventListener(PUSH_SUBSCRIPTION_CHANGED, sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [refresh]);

  const change = async (enable: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    revision.current++;
    try {
      // Keep the native permission request in the click's user-activation chain.
      const result = enable ? await connectPush() : (await unsubscribeAndDelete(), { ok: true as const });
      const next = await refresh();
      if (enable && (!result.ok || next !== "on")) {
        setError(!result.ok ? PUSH_CONNECTION_MESSAGE[result.reason]
          : "수신 연결을 확인하지 못했습니다. 알림 상태를 다시 확인해주세요.");
      } else if (!enable && next === "on") {
        setError("알림을 끄지 못했습니다. 다시 시도해주세요.");
      }
    } catch {
      setError("알림 설정을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.");
      await refresh();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return {
    state, ios: environment.ios, environment,
    permission: snapshot.userId === userId ? snapshot.permission : "unavailable" as PushPermission,
    busy, error,
    refresh, enable: () => change(true), disable: () => change(false),
  };
}

export type TournamentPush = ReturnType<typeof useTournamentPush>;
