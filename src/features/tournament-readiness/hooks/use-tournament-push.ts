"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  PUSH_SUPPORTED, PUSH_SUBSCRIPTION_CHANGED, hasSavedPushSubscription,
  subscribeAndSave, unsubscribeAndDelete,
} from "@/lib/push";
import { canSaveWithTournamentAlerts, type TournamentPushState } from "../policy";

function deviceContext() {
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const installed = window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return { ios, installed };
}

export function useTournamentPush() {
  const { user } = useAuth();
  const userId = user?.uid;
  const [snapshot, setSnapshot] = useState<{ userId?: string; state: TournamentPushState }>({ state: "loading" });
  const [ios, setIos] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fallbackAcknowledged, setFallbackAcknowledged] = useState(false);
  const revision = useRef(0);
  const inFlight = useRef(false);
  const state = snapshot.userId === userId ? snapshot.state : "loading";

  const refresh = useCallback(async (): Promise<TournamentPushState> => {
    const request = ++revision.current;
    setSnapshot({ userId, state: "loading" });
    let next: TournamentPushState;
    try {
      const device = deviceContext();
      setIos(device.ios);
      if (device.ios && !device.installed) next = "install";
      else if (!PUSH_SUPPORTED) next = "unsupported";
      else if (Notification.permission === "denied") next = "denied";
      else next = userId && await hasSavedPushSubscription(userId) ? "on" : "off";
    } catch {
      next = "error";
    }
    if (request !== revision.current) return "loading";
    setSnapshot({ userId, state: next });
    return next;
  }, [userId]);

  useEffect(() => {
    const invalidate = () => { revision.current++; };
    setFallbackAcknowledged(false);
    setError("");
    void refresh();
    const sync = () => { if (!inFlight.current && document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", sync);
    window.addEventListener(PUSH_SUBSCRIPTION_CHANGED, sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      invalidate();
      window.removeEventListener("focus", sync);
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
      const saved = enable ? await subscribeAndSave() : (await unsubscribeAndDelete(), true);
      const next = await refresh();
      if (enable && (!saved || next !== "on") && next !== "denied") {
        setError("알림 설정을 완료하지 못했습니다. 권한 요청에서 ‘허용’을 선택하고, 인터넷 연결을 확인한 뒤 다시 시도해주세요.");
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

  const verifyForSave = async () => {
    if (inFlight.current) return false;
    return canSaveWithTournamentAlerts(await refresh(), fallbackAcknowledged);
  };

  return {
    state, ios, busy, error, fallbackAcknowledged, setFallbackAcknowledged,
    canSave: !busy && canSaveWithTournamentAlerts(state, fallbackAcknowledged),
    refresh, enable: () => change(true), disable: () => change(false), verifyForSave,
  };
}

export type TournamentPush = ReturnType<typeof useTournamentPush>;
