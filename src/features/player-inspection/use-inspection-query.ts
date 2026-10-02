"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { subscribeInspectionChanges } from "@/lib/inspection-sync";

/** Realtime invalidations plus bounded polling; keep the last successful snapshot. */
export function useInspectionQuery<T>(read: (signal: AbortSignal) => Promise<T>, live = false) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const active = useRef<AbortController | null>(null);
  const pending = useRef(false);
  const followUp = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reload = useCallback(async () => {
    if (followUp.current) { clearTimeout(followUp.current); followUp.current = null; }
    pending.current = false;
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setLoading(true);
    try {
      const result = await read(controller.signal);
      if (controller.signal.aborted) return;
      setData(result);
      setError("");
      setUpdatedAt(Date.now());
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : "검인 정보를 불러오지 못했습니다.");
      }
    } finally {
      if (active.current === controller && !controller.signal.aborted) {
        active.current = null;
        setLoading(false);
        if (pending.current) {
          pending.current = false;
          followUp.current = setTimeout(() => { void reload(); }, 250);
        }
      }
    }
  }, [read]);

  useEffect(() => {
    void reload();
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      if (active.current) pending.current = true;
      else void reload();
    };
    // Coalesce noisy/untrusted broadcasts. They cannot replace authorized data.
    let signalTimer: ReturnType<typeof setTimeout> | null = null;
    const signalRefresh = () => {
      if (signalTimer) return;
      signalTimer = setTimeout(() => { signalTimer = null; refresh(); }, 500);
    };
    const unsubscribe = live ? subscribeInspectionChanges({ refresh: signalRefresh, connection: setConnected }) : () => {};
    const interval = setInterval(refresh, live ? 5_000 : 15_000);
    const offline = () => setConnected(false);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active.current?.abort();
      pending.current = false;
      if (followUp.current) clearTimeout(followUp.current);
      if (signalTimer) clearTimeout(signalTimer);
      unsubscribe();
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [reload, live]);

  return { data, error, loading, updatedAt, reload, connected };
}
