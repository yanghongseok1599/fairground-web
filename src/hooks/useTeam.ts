"use client";

import { useEffect, useState } from "react";
import { useDataStore } from "@/stores/dataStore";
import type { Team, Player } from "@/types";

export function useTeam(teamId?: string) {
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchTeam = useDataStore((s) => s.fetchTeam);
  const cached = useDataStore((s) => (teamId ? s.teams[teamId] : undefined));

  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    if (!teamId) {
      queueMicrotask(() => { if (!cancelled) { setTeam(null); setLoading(false); setError(""); } });
      return () => { cancelled = true; };
    }
    queueMicrotask(() => { if (!cancelled) { setError(""); setLoading(!cached); } });
    if (cached) {
      queueMicrotask(() => { if (!cancelled) { setTeam(cached); setLoading(false); } });
    } else {
      fetchTeam(teamId, true).then((t) => { if (!cancelled) setTeam(t); })
        .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "팀을 불러오지 못했습니다."); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }
    return () => { cancelled = true; };
  }, [teamId, cached, fetchTeam, retry]);

  return { team: team?.id === teamId ? team : null, loading, error, retry: () => setRetry((v) => v + 1) };
}

export function useTeams() {
  const teams = useDataStore((s) => s.teams);
  const loading = useDataStore((s) => s.teamsLoading);
  const fetchTeams = useDataStore((s) => s.fetchTeams);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  return { teams: Object.values(teams), loading };
}

export function useTeamPlayers(teamId?: string) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchTeamPlayers = useDataStore((s) => s.fetchTeamPlayers);

  useEffect(() => {
    if (!teamId) {
      queueMicrotask(() => setLoading(false));
      return;
    }
    queueMicrotask(() => setLoading(true));
    fetchTeamPlayers(teamId).then((p) => {
      setPlayers(p);
      setLoading(false);
    });
  }, [teamId, fetchTeamPlayers]);

  return { players, loading };
}
