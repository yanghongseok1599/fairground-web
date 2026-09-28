"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/config/supabase";
import { createMatchLiveRefresh } from "@/lib/match-live-refresh";
import { fetchLiveScoreSnapshot } from "./data";
import { selectLiveScoreboard, type LiveScoreSnapshot } from "./schedule";

export function useLiveScoreboard() {
  const [snapshot, setSnapshot] = useState<LiveScoreSnapshot>({ matches: [], tournaments: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const refreshRef = useRef<() => void>(() => {});

  useEffect(() => {
    const sync = createMatchLiveRefresh({
      load: fetchLiveScoreSnapshot,
      publish: (value) => { setSnapshot(value); setError(false); setLoading(false); },
      onError: () => { setError(true); setLoading(false); },
    });
    const refresh = () => { void sync.refresh(); };
    const refreshVisible = () => { if (document.visibilityState === "visible") refresh(); };
    refreshRef.current = refresh;
    refresh();
    const channel = supabase.channel("public-live-scoreboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "tournaments" }, refresh)
      .subscribe((status) => { if (status === "SUBSCRIBED") refresh(); });
    const poll = setInterval(refreshVisible, 5_000);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      sync.stop();
      refreshRef.current = () => {};
      clearInterval(poll);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refreshVisible);
      void supabase.removeChannel(channel);
    };
  }, []);

  return { ...selectLiveScoreboard(snapshot), tournaments: snapshot.tournaments, loading, error, refresh: () => refreshRef.current() };
}
