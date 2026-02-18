"use client";

import { create } from "zustand";
import { ref, onValue, get } from "firebase/database";
import { database, isDemoMode } from "@/config/firebase";
import type { Player, Team, Match, LiveMatch, MatchEvent, Tournament, Season, TeamStanding } from "@/types";

// Demo data helpers
const LS_TEAMS = "fg_teams";
const LS_PLAYERS = "fg_players";
const LS_MATCHES = "fg_matches";
const LS_LIVE = "fg_liveMatches";
const LS_TOURNAMENTS = "fg_tournaments";

function getLocal<T>(key: string): T {
  if (typeof window === "undefined") return {} as T;
  try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch { return {} as T; }
}

function eventsToArray(events: Record<string, MatchEvent> | MatchEvent[] | undefined): MatchEvent[] {
  if (!events) return [];
  if (Array.isArray(events)) return events;
  return Object.values(events);
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
    if (isDemoMode) {
      const data = getLocal<Record<string, Player>>(LS_PLAYERS);
      const list = Object.entries(data).map(([id, p]) => ({ ...p, id }));
      setState({ players: data });
      return list;
    }
    try {
      const snap = await get(ref(database, "players"));
      if (snap.exists()) {
        const data = snap.val() as Record<string, Player>;
        const players: Record<string, Player> = {};
        const list: Player[] = [];
        for (const [id, p] of Object.entries(data)) {
          players[id] = { ...p, id };
          list.push({ ...p, id });
        }
        setState({ players });
        return list;
      }
      return [];
    } catch { return []; }
  },

  fetchPlayer: async (id) => {
    const cached = getState().players[id];
    if (cached) return cached;
    if (isDemoMode) {
      const data = getLocal<Record<string, Player>>(LS_PLAYERS);
      return data[id] ? { ...data[id], id } : null;
    }
    try {
      const snap = await get(ref(database, `players/${id}`));
      if (snap.exists()) {
        const player = { ...snap.val(), id } as Player;
        setState((s) => ({ players: { ...s.players, [id]: player } }));
        return player;
      }
      return null;
    } catch { return null; }
  },

  fetchTeams: async () => {
    if (isDemoMode) {
      const data = getLocal<Record<string, Team>>(LS_TEAMS);
      const list = Object.entries(data).map(([id, t]) => ({ ...t, id }));
      setState({ teams: data });
      return list;
    }
    try {
      const snap = await get(ref(database, "teams"));
      if (snap.exists()) {
        const data = snap.val() as Record<string, Team>;
        const teams: Record<string, Team> = {};
        const list: Team[] = [];
        for (const [id, t] of Object.entries(data)) {
          teams[id] = { ...t, id };
          list.push({ ...t, id });
        }
        setState({ teams });
        return list;
      }
      return [];
    } catch { return []; }
  },

  fetchTeam: async (id) => {
    const cached = getState().teams[id];
    if (cached) return cached;
    if (isDemoMode) {
      const data = getLocal<Record<string, Team>>(LS_TEAMS);
      return data[id] ? { ...data[id], id } : null;
    }
    try {
      const snap = await get(ref(database, `teams/${id}`));
      if (snap.exists()) {
        const team = { ...snap.val(), id } as Team;
        setState((s) => ({ teams: { ...s.teams, [id]: team } }));
        return team;
      }
      return null;
    } catch { return null; }
  },

  fetchTeamPlayers: async (teamId) => {
    if (isDemoMode) {
      const data = getLocal<Record<string, Player>>(LS_PLAYERS);
      return Object.entries(data).filter(([, p]) => p.teamId === teamId).map(([id, p]) => ({ ...p, id }));
    }
    try {
      const snap = await get(ref(database, "players"));
      if (snap.exists()) {
        const data = snap.val() as Record<string, Player>;
        return Object.entries(data).filter(([, p]) => p.teamId === teamId).map(([id, p]) => ({ ...p, id }));
      }
      return [];
    } catch { return []; }
  },

  fetchTournaments: async () => {
    if (isDemoMode) {
      const data = getLocal<Record<string, Tournament>>(LS_TOURNAMENTS);
      const list = Object.entries(data).map(([id, t]) => ({ ...t, id }));
      setState({ tournaments: data });
      return list;
    }
    try {
      const snap = await get(ref(database, "tournaments"));
      if (snap.exists()) {
        const data = snap.val() as Record<string, Tournament>;
        const tournaments: Record<string, Tournament> = {};
        const list: Tournament[] = [];
        for (const [id, t] of Object.entries(data)) {
          tournaments[id] = { ...t, id };
          list.push({ ...t, id });
        }
        setState({ tournaments });
        return list;
      }
      return [];
    } catch { return []; }
  },

  fetchTournament: async (id) => {
    const cached = getState().tournaments[id];
    if (cached) return cached;
    if (isDemoMode) {
      const data = getLocal<Record<string, Tournament>>(LS_TOURNAMENTS);
      return data[id] ? { ...data[id], id } : null;
    }
    try {
      const snap = await get(ref(database, `tournaments/${id}`));
      if (snap.exists()) {
        const tournament = { ...snap.val(), id } as Tournament;
        setState((s) => ({ tournaments: { ...s.tournaments, [id]: tournament } }));
        return tournament;
      }
      return null;
    } catch { return null; }
  },

  fetchMatches: async (tournamentId) => {
    if (isDemoMode) {
      const all = getLocal<Record<string, Record<string, Match>>>(LS_MATCHES);
      const tMatches = all[tournamentId] || {};
      return Object.entries(tMatches).map(([id, m]) => ({ ...m, id, events: eventsToArray(m.events) }));
    }
    try {
      const snap = await get(ref(database, `matches/${tournamentId}`));
      if (snap.exists()) {
        const data = snap.val() as Record<string, Match>;
        return Object.entries(data).map(([id, m]) => ({
          ...m, id, events: eventsToArray(m.events as unknown as Record<string, MatchEvent>)
        }));
      }
      return [];
    } catch { return []; }
  },

  fetchStandings: async () => {
    if (isDemoMode) { setState({ loading: false }); return; }
    setState({ loading: true });
    try {
      const [seasonSnap, standingsSnap] = await Promise.all([
        get(ref(database, "currentSeason")),
        get(ref(database, "standings")),
      ]);
      const currentSeason = seasonSnap.exists() ? (seasonSnap.val() as Season) : null;
      if (standingsSnap.exists()) {
        const data = standingsSnap.val() as Record<string, TeamStanding>;
        const standings = Object.entries(data)
          .map(([id, s]) => ({ ...s, teamId: id }))
          .sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor);
        setState({ currentSeason, standings, loading: false });
      } else {
        setState({ currentSeason, loading: false });
      }
    } catch { setState({ loading: false }); }
  },

  subscribeLiveMatches: () => {
    if (isDemoMode) {
      const data = getLocal<Record<string, LiveMatch>>(LS_LIVE);
      const liveMatches = Object.entries(data).map(([id, m]) => ({ ...m, id }));
      setState({ liveMatches });
      return () => {};
    }
    const liveRef = ref(database, "liveMatches");
    const unsub = onValue(liveRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val() as Record<string, LiveMatch>;
        const liveMatches = Object.entries(data).map(([id, m]) => ({ ...m, id }));
        setState({ liveMatches });
      } else {
        setState({ liveMatches: [] });
      }
    });
    return unsub;
  },
}));
