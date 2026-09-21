"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchApprovalPlayers, type ApprovalPlayer } from "./api";

export function useApprovalPlayers() {
  const [players, setPlayers] = useState<ApprovalPlayer[]>([]);
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
      const list = await fetchApprovalPlayers(request.signal);
      if (request.signal.aborted || active.current !== request) return;
      setPlayers([...list].sort((a, b) => Number(a.isApproved) - Number(b.isApproved) || b.createdAt - a.createdAt));
    } catch (cause) {
      if (request.signal.aborted || active.current !== request) return;
      setError(cause instanceof Error ? cause.message : "선수 목록을 불러오지 못했습니다.");
    } finally {
      if (!request.signal.aborted && active.current === request) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reload();
    const cancel = () => active.current?.abort();
    return cancel;
  }, [reload]);
  return { players, setPlayers, loading, error, reload };
}
