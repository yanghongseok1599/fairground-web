import type { Player, Team } from "@/types";
import { hasMatchStaffPermission, hasTeamOperationsPermission } from "./team-role-policy.ts";

/**
 * Single source of truth for "who can manage this team" UX gates.
 *
 * These functions decide which buttons/sections to *show*, not whether a
 * write actually succeeds — final enforcement is Supabase RLS + triggers.
 * Keep this file the only place where role logic is encoded; pages should
 * call these helpers instead of re-implementing the boolean inline.
 *
 * Inputs are intentionally typed as nullable so callers can pass live state
 * without optional-chaining noise.
 */

type MaybePlayer = Pick<
  Player,
  "id" | "role" | "teamId" | "teamRole" | "isApproved"
> | null | undefined;

type MaybeTeam = Pick<Team, "id" | "captainId"> | null | undefined;

/** Member of the team's roster — used to gate "first post / first photo" CTAs. */
export function isTeamMemberOf(player: MaybePlayer, team: MaybeTeam): boolean {
  if (!player || !team) return false;
  return player.isApproved && player.teamId === team.id;
}

/**
 * Has any director-level role for this team.
 *
 * Director = admin (league) · the team's actual captainId · a team_role of
 * 감독(coach)/매니저(manager) for THIS team.
 *
 * Used by the team home edit pencil, the /my/team management surface, etc.
 */
export function canManageTeam(player: MaybePlayer, team: MaybeTeam): boolean {
  if (!player || !team) return false;
  if (player.role === "admin") return true;
  if (!player.isApproved) return false;
  if (team.captainId && team.captainId === player.id) return true;
  return player.teamId === team.id && hasTeamOperationsPermission(player);
}

/** Pending owners may correct registration details; operations stay approval-gated. */
export function canEditTeamDetails(player: MaybePlayer, team: MaybeTeam): boolean {
  return Boolean(player && team && (player.role === "admin" || team.captainId === player.id));
}

/**
 * Stricter gate for member-management UI (assigning team_role to other players).
 * 감독 and 매니저 can manage roles for their own team; captainId remains a
 * legacy-safe owner fallback for teams created before teamRole was backfilled.
 */
export function canManageTeamMembers(
  player: MaybePlayer,
  team: MaybeTeam,
): boolean {
  if (!player || !team) return false;
  if (player.role === "admin") return true;
  if (!player.isApproved) return false;
  if (team.captainId && team.captainId === player.id) return true;
  if (player.teamId !== team.id) return false;
  return hasTeamOperationsPermission(player);
}

export function canOperateMatchForTeam(
  player: MaybePlayer,
  teamId: string | null | undefined,
): boolean {
  if (!player || !teamId) return false;
  if (player.role === "admin") return true;
  if (!player.isApproved) return false;
  return player.teamId === teamId && hasMatchStaffPermission(player);
}

/** Quick boolean for "is this user the captainId of the team?" */
export function isTeamCaptain(
  player: MaybePlayer,
  team: MaybeTeam,
): boolean {
  if (!player || !team) return false;
  return Boolean(team.captainId && team.captainId === player.id);
}

/**
 * Posting permission for the team's free-form board (자유게시판).
 * Any team member can post; admin can post on any team.
 *
 * Lighter signature (teamId string) so chat pages can call it before the
 * full team row has loaded.
 */
export function canPostInTeamBoard(
  player: MaybePlayer,
  teamId: string | null | undefined,
): boolean {
  if (!player || !teamId) return false;
  if (player.role === "admin") return true;
  return player.isApproved && player.teamId === teamId;
}
