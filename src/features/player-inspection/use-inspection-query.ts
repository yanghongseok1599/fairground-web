"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Refresh on return to the page and every 15 seconds while visible. Never overlap reads. */
export function useInspectionQuery<T>(read: (signal: AbortSignal) => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const active = useRef<AbortController | null>(null);
  const reload = useCallback(async () => {
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
      }
    }
  }, [read]);

  useEffect(() => {
    void reload();
    const refresh = () => {
      if (document.visibilityState === "visible" && !active.current) void reload();
    };
    const interval = setInterval(refresh, 15_000);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active.current?.abort();
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [reload]);

  return { data, error, loading, updatedAt, reload };
}
