"use client";

import { useEffect, useState } from "react";
import { useDataStore } from "@/stores/dataStore";
import type { Team, Player } from "@/types";

export function useTeam(teamId?: string) {
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchTeam = useDataStore((s) => s.fetchTeam);
  const cached = useDataStore((s) => (teamId ? s.teams[teamId] : undefined));

  useEffect(() => {
    if (!teamId) {
      setLoading(false);
      return;
    }
    if (cached) {
      setTeam(cached);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchTeam(teamId).then((t) => {
      setTeam(t);
      setLoading(false);
    });
  }, [teamId, cached, fetchTeam]);

  return { team, loading };
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
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchTeamPlayers(teamId).then((p) => {
      setPlayers(p);
      setLoading(false);
    });
  }, [teamId, fetchTeamPlayers]);

  return { players, loading };
}
