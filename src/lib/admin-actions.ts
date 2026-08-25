"use client";

import { supabase, isDemoMode } from "@/config/supabase";
import type { Player, PlayerRole, Team, TournamentGroup } from "@/types";
import type { Database } from "@/lib/database.types";

const LS_PLAYERS = "fg_players";
const LS_TEAMS = "fg_teams";
const LS_TOURNAMENTS = "fg_tournaments";

function getLocalPlayers(): Record<string, Player> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(LS_PLAYERS) || "{}"); } catch { return {}; }
}

function saveLocalPlayers(players: Record<string, Player>) {
  localStorage.setItem(LS_PLAYERS, JSON.stringify(players));
}

function getLocalTeams(): Record<string, Team> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(LS_TEAMS) || "{}"); } catch { return {}; }
}

function saveLocalTeams(teams: Record<string, Team>) {
  localStorage.setItem(LS_TEAMS, JSON.stringify(teams));
}

function getLocalTournaments(): Record<string, { groups?: TournamentGroup[]; [key: string]: unknown }> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(LS_TOURNAMENTS) || "{}"); } catch { return {}; }
}

function saveLocalTournaments(tournaments: Record<string, { groups?: TournamentGroup[]; [key: string]: unknown }>) {
  localStorage.setItem(LS_TOURNAMENTS, JSON.stringify(tournaments));
}

export async function setPlayerApproval(playerId: string, approved: boolean) {
  if (isDemoMode) {
    const players = getLocalPlayers();
    if (players[playerId]) {
      players[playerId] = { ...players[playerId], isApproved: approved };
      saveLocalPlayers(players);
    }
    return;
  }
  const { error } = await supabase.rpc("set_player_approval", {
    p_player_id: playerId,
    p_is_approved: approved,
  });
  if (error) throw new Error(error.message);
}

export async function setPlayerRole(playerId: string, role: PlayerRole) {
  if (isDemoMode) {
    const players = getLocalPlayers();
    if (players[playerId]) {
      players[playerId] = { ...players[playerId], role };
      saveLocalPlayers(players);
    }
    return;
  }
  const { error } = await supabase.rpc("set_player_role", {
    p_player_id: playerId,
    p_role: role,
  });
  if (error) throw new Error(error.message);
}

export async function setTeamApproval(teamId: string, approved: boolean) {
  if (isDemoMode) {
    const teams = getLocalTeams();
    if (teams[teamId]) {
      teams[teamId] = { ...teams[teamId], isApproved: approved };
      saveLocalTeams(teams);
    }
    return;
  }
  const { error } = await supabase.from("teams").update({ is_approved: approved }).eq("id", teamId);
  if (error) throw new Error(error.message);
}

export async function setTournamentGroups(tournamentId: string, groups: TournamentGroup[]) {
  if (isDemoMode) {
    const tournaments = getLocalTournaments();
    if (tournaments[tournamentId]) {
      tournaments[tournamentId] = { ...tournaments[tournamentId], groups };
      saveLocalTournaments(tournaments);
    }
    return;
  }
  const { error } = await supabase
    .from("tournaments")
    .update({ groups: groups as unknown as Database["public"]["Tables"]["tournaments"]["Update"]["groups"] })
    .eq("id", tournamentId);
  if (error) throw new Error(error.message);
}

export async function setPlayerBan(playerId: string, banned: boolean, banMatchesRemaining: number) {
  if (isDemoMode) {
    const players = getLocalPlayers();
    if (players[playerId]) {
      players[playerId] = {
        ...players[playerId],
        penaltyStatus: {
          ...players[playerId].penaltyStatus,
          isBanned: banned,
          banMatchesRemaining,
        },
      };
      saveLocalPlayers(players);
    }
    return;
  }
  const { error } = await supabase
    .from("profiles")
    .update({ is_banned: banned, ban_matches_remaining: banMatchesRemaining })
    .eq("id", playerId);
  if (error) throw new Error(error.message);
}
