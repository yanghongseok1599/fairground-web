"use client";

import { supabase, isDemoMode } from "@/config/supabase";
import { withApprovalDeadline } from "@/features/admin-players/api";
import { getRefereeCandidates } from "@/lib/admin-referees";
import type { Player, Team } from "@/types";

export type RefereeSummary = Pick<Player, "id" | "name" | "role" | "isApproved" | "createdAt" | "phone" | "email" | "hasPlayerExperience">;
export type PenaltySummary = Pick<Player, "id" | "name" | "position" | "penaltyStatus">;
export type CoachSummary = Pick<Player, "id" | "name" | "teamId" | "email" | "phone" | "createdAt">;
export type PushDirectory = { teams: Pick<Team, "id" | "name">[]; players: Pick<Player, "id" | "name" | "teamName">[] };
export const EMPTY_PUSH_DIRECTORY: PushDirectory = { teams: [], players: [] };

// Each screen has an explicit projection. Never read the two inline photo columns here.
export const REFEREE_COLUMNS = "id,name,role,is_approved,created_at,phone,email,has_player_experience";
export const PENALTY_COLUMNS = "id,name,position,is_banned,ban_matches_remaining,season_yellow_cards";
export const COACH_COLUMNS = "id,name,team_id,email,phone,created_at";
export const PUSH_PLAYER_COLUMNS = "id,name,team_id";
function localPlayers(): Player[] { return Object.values(JSON.parse(localStorage.getItem("fg_players") || "{}")); }
function requireList<T>(data: T[] | null, error: { message: string } | null): T[] {
  if (error) throw new Error(error.message);
  if (!Array.isArray(data)) throw new Error("목록 응답을 확인하지 못했습니다. 다시 시도해주세요.");
  return data;
}

export async function fetchRefereeSummaries(signal: AbortSignal): Promise<RefereeSummary[]> {
  if (isDemoMode) return getRefereeCandidates(localPlayers());
  return withApprovalDeadline(async (requestSignal) => {
    const { data, error } = await supabase.rpc("get_admin_profiles", undefined, { get: true })
      .select(REFEREE_COLUMNS).eq("role", "referee").abortSignal(requestSignal);
    return getRefereeCandidates(requireList(data, error).map(r => ({
      id: r.id, name: r.name, role: r.role, isApproved: r.is_approved, createdAt: Date.parse(r.created_at),
      phone: r.phone ?? undefined, email: r.email ?? undefined, hasPlayerExperience: r.has_player_experience ?? undefined,
    })));
  }, signal);
}

export async function fetchPenaltySummaries(signal: AbortSignal): Promise<PenaltySummary[]> {
  const list = isDemoMode ? localPlayers() : await withApprovalDeadline(async (requestSignal) => {
    const { data, error } = await supabase.rpc("get_admin_profiles", undefined, { get: true })
      .select(PENALTY_COLUMNS).abortSignal(requestSignal);
    return requireList(data, error).map(r => ({ id: r.id, name: r.name, position: r.position,
      penaltyStatus: { isBanned: r.is_banned, banMatchesRemaining: r.ban_matches_remaining, seasonYellowCards: r.season_yellow_cards } }));
  }, signal);
  return [...list].sort((a, b) => Number(b.penaltyStatus.isBanned) - Number(a.penaltyStatus.isBanned)
    || b.penaltyStatus.seasonYellowCards - a.penaltyStatus.seasonYellowCards);
}

export async function fetchCoachSummaries(signal: AbortSignal): Promise<CoachSummary[]> {
  if (isDemoMode) return [];
  return withApprovalDeadline(async (requestSignal) => {
    const { data, error } = await supabase.rpc("get_admin_profiles", undefined, { get: true })
      .select(COACH_COLUMNS).eq("team_role", "coach").eq("is_approved", false).abortSignal(requestSignal);
    return requireList(data, error).map(r => ({ id: r.id, name: r.name, teamId: r.team_id ?? "",
      phone: r.phone ?? undefined, email: r.email ?? undefined, createdAt: Date.parse(r.created_at) }));
  }, signal);
}

export async function fetchPushDirectory(signal: AbortSignal): Promise<PushDirectory> {
  if (isDemoMode) return { teams: Object.values(JSON.parse(localStorage.getItem("fg_teams") || "{}")), players: localPlayers() };
  // Sequential reads avoid leaving a sibling request running if the first fails.
  return withApprovalDeadline(async (requestSignal) => {
    const teamsResult = await supabase.from("teams").select("id,name").abortSignal(requestSignal);
    const teams = requireList(teamsResult.data, teamsResult.error).sort((a, b) => a.name.localeCompare(b.name, "ko"));
    const { data, error } = await supabase.rpc("get_admin_profiles", undefined, { get: true })
      .select(PUSH_PLAYER_COLUMNS).abortSignal(requestSignal);
    const names = new Map(teams.map(t => [t.id, t.name]));
    const players = requireList(data, error).map(r => ({ id: r.id, name: r.name, teamName: names.get(r.team_id ?? "") }))
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
    return { teams, players };
  }, signal);
}
