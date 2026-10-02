"use client";

import { useEffect, useRef } from "react";
import { subscribeMatchResults } from "./subscribe";
import { isDemoMode } from "@/config/supabase";

export function useMatchResults<T>(options: {
  key: string;
  enabled?: boolean;
  matchId?: string;
  tournamentId?: string;
  finalOnly?: boolean;
  load: () => Promise<T>;
  publish: (value: T) => void;
  onError?: (error: unknown) => void;
}) {
  const latest = useRef(options);
  useEffect(() => { latest.current = options; });
  const { key, enabled = true, matchId, tournamentId, finalOnly } = options;
  useEffect(() => {
    if (!enabled || isDemoMode) return;
    return subscribeMatchResults({
      key, matchId, tournamentId, finalOnly,
      load: () => latest.current.load(),
      publish: value => latest.current.publish(value),
      onError: error => { latest.current.onError?.(error); },
    });
  }, [key, enabled, matchId, tournamentId, finalOnly]);
}
