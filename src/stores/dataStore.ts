"use client";

import { create } from "zustand";
import { supabase } from "@/config/supabase";
import {
  rowToPlayer,
  rowToTeam,
  rowToEvent,
  rowToMatch,
  rowToLiveMatch,
  rowToTournament,
  rowToSeason,
} from "@/lib/mappers";
import type {
  Player,
  Team,
  Match,
  LiveMatch,
  MatchEvent,
  Tournament,
  Season,
  TeamStanding,
} from "@/types";

// 읽기측 공개사이트: Supabase 공개읽기(RLS anon) 위주.
// Firebase RTDB(get/onValue) → Supabase Postgres select + realtime 채널.
// 공개 인터페이스(스토어 export 시그니처)는 보존 — 페이지 컴포넌트 무파손.

// 한 경기의 이벤트 조회 헬퍼 (created_at 오름차순).
async function fetchEvents(matchId: string): Promise<MatchEvent[]> {
  const { data, error } = await supabase
    .from("match_events")
    .select("*")
    .eq("match_id", matchId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[dataStore] fetchEvents:", error.message);
    return [];
  }
  return (data ?? []).map(rowToEvent);
}

interface DataState {
  players: Record<string, Player>;
  teams: Record<string, Team>;
  tournaments: Record<string, Tournament>;
  liveMatches: LiveMatch[];
  standings: TeamStanding[];
  currentSeason: Season | null;
  loading: boolean;

  fetchPlayers: () => Promise<Player[]>;
  fetchPlayer: (id: string) => Promise<Player | null>;
  fetchTeams: () => Promise<Team[]>;
  fetchTeam: (id: string) => Promise<Team | null>;
  fetchTeamPlayers: (teamId: string) => Promise<Player[]>;
  fetchTournaments: () => Promise<Tournament[]>;
  fetchTournament: (id: string) => Promise<Tournament | null>;
  fetchMatches: (tournamentId: string) => Promise<Match[]>;
  fetchStandings: () => Promise<void>;
  subscribeLiveMatches: () => () => void;
}

export const useDataStore = create<DataState>((setState, getState) => ({
  players: {},
  teams: {},
  tournaments: {},
  liveMatches: [],
  standings: [],
  currentSeason: null,
  loading: false,

  fetchPlayers: async () => {
    const { data, error } = await supabase.from("profiles").select("*");
    if (error) {
      console.error("[dataStore] fetchPlayers:", error.message);
      return [];
    }
    const players: Record<string, Player> = {};
    const list: Player[] = [];
    for (const row of data ?? []) {
      const p = rowToPlayer(row);
      players[p.id] = p;
      list.push(p);
    }
    setState({ players });
    return list;
  },

  fetchPlayer: async (id) => {
    const cached = getState().players[id];
    if (cached) return cached;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.error("[dataStore] fetchPlayer:", error.message);
      return null;
    }
    if (!data) return null;
    const player = rowToPlayer(data);
    setState((s) => ({ players: { ...s.players, [id]: player } }));
    return player;
  },

  fetchTeams: async () => {
    const { data, error } = await supabase.from("teams").select("*");
    if (error) {
      console.error("[dataStore] fetchTeams:", error.message);
      return [];
    }
    const teams: Record<string, Team> = {};
    const list: Team[] = [];
    for (const row of data ?? []) {
      const t = rowToTeam(row);
      teams[t.id] = t;
      list.push(t);
    }
    setState({ teams });
    return list;
  },

  fetchTeam: async (id) => {
    const cached = getState().teams[id];
    if (cached) return cached;
    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.error("[dataStore] fetchTeam:", error.message);
      return null;
    }
    if (!data) return null;
    const team = rowToTeam(data);
    setState((s) => ({ teams: { ...s.teams, [id]: team } }));
    return team;
  },

  fetchTeamPlayers: async (teamId) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("team_id", teamId);
    if (error) {
      console.error("[dataStore] fetchTeamPlayers:", error.message);
      return [];
    }
    return (data ?? []).map(rowToPlayer);
  },

  fetchTournaments: async () => {
    const { data, error } = await supabase.from("tournaments").select("*");
    if (error) {
      console.error("[dataStore] fetchTournaments:", error.message);
      return [];
    }
    const tournaments: Record<string, Tournament> = {};
    const list: Tournament[] = [];
    for (const row of data ?? []) {
      const t = rowToTournament(row);
      tournaments[t.id] = t;
      list.push(t);
    }
    setState({ tournaments });
    return list;
  },

  fetchTournament: async (id) => {
    const cached = getState().tournaments[id];
    if (cached) return cached;
    const { data, error } = await supabase
      .from("tournaments")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.error("[dataStore] fetchTournament:", error.message);
      return null;
    }
    if (!data) return null;
    const tournament = rowToTournament(data);
    setState((s) => ({ tournaments: { ...s.tournaments, [id]: tournament } }));
    return tournament;
  },

  fetchMatches: async (tournamentId) => {
    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .eq("tournament_id", tournamentId);
    if (error) {
      console.error("[dataStore] fetchMatches:", error.message);
      return [];
    }
    return Promise.all(
      (data ?? []).map(async (row) => rowToMatch(row, await fetchEvents(row.id))),
    );
  },

  fetchStandings: async () => {
    setState({ loading: true });
    // 그린필드: 별도 standings 노드 없음 → teams.season_stats 에서 파생.
    const [{ data: teams, error: tErr }, { data: seasons }] = await Promise.all([
      supabase.from("teams").select("*"),
      supabase.from("seasons").select("*").eq("is_active", true).limit(1),
    ]);
    if (tErr) {
      console.error("[dataStore] fetchStandings:", tErr.message);
      setState({ loading: false });
      return;
    }
    const currentSeason =
      seasons && seasons.length ? rowToSeason(seasons[0]) : null;
    const standings: TeamStanding[] = (teams ?? [])
      .map((row) => {
        const t = rowToTeam(row);
        const ss = t.seasonStats;
        return {
          teamId: t.id,
          teamName: t.name,
          teamLogo: t.logo,
          points: ss.points,
          rank: ss.rank,
          wins: ss.wins,
          draws: ss.draws,
          losses: ss.losses,
          goalsFor: ss.goalsFor,
          goalsAgainst: ss.goalsAgainst,
          goalDifference: ss.goalDifference,
          gamesPlayed: ss.gamesPlayed,
        };
      })
      .sort(
        (a, b) =>
          b.points - a.points ||
          b.goalDifference - a.goalDifference ||
          b.goalsFor - a.goalsFor,
      );
    setState({ currentSeason, standings, loading: false });
  },

  subscribeLiveMatches: () => {
    const load = async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .eq("status", "live");
      if (error) {
        console.error("[dataStore] subscribeLiveMatches:", error.message);
        return;
      }
      const withEvents = await Promise.all(
        (data ?? []).map(async (row) =>
          rowToLiveMatch(row, await fetchEvents(row.id)),
        ),
      );
      setState({ liveMatches: withEvents });
    };

    void load();
    // Realtime: matches/match_events 변경 시 재로딩 (Firebase onValue 대체).
    const channel = supabase
      .channel("web-live-matches")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches" },
        () => void load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_events" },
        () => void load(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  },
}));
