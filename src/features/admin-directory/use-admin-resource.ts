"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Cancel navigation/retry requests and ignore stale completions, preserving the last good list. */
export function useAdminResource<T>(load: (signal: AbortSignal) => Promise<T>, initial: T) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const active = useRef<AbortController | null>(null);
  const reload = useCallback(async () => {
    active.current?.abort();
    const request = new AbortController();
    active.current = request;
    setLoading(true);
    setError("");
    try {
      const result = await load(request.signal);
      if (!request.signal.aborted && active.current === request) setData(result);
    } catch (cause) {
      if (!request.signal.aborted && active.current === request) {
        setError(cause instanceof Error ? cause.message : "목록을 불러오지 못했습니다.");
      }
    } finally {
      if (!request.signal.aborted && active.current === request) setLoading(false);
    }
  }, [load]);
  useEffect(() => { void reload(); return () => active.current?.abort(); }, [reload]);
  return { data, setData, loading, error, reload };
}
