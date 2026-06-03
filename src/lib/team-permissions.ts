import type { Player, Team } from "@/types";

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
  "id" | "role" | "teamId" | "teamRole"
> | null | undefined;

type MaybeTeam = Pick<Team, "id" | "captainId"> | null | undefined;

/** Member of the team's roster — used to gate "first post / first photo" CTAs. */
export function isTeamMemberOf(player: MaybePlayer, team: MaybeTeam): boolean {
  if (!player || !team) return false;
  return player.teamId === team.id;
}

/**
 * Has any director-level role for this team.
 *
 * Director = admin (league) · system captain · the team's actual captainId ·
 * a team_role of captain/manager/coach for THIS team.
 *
 * Used by the team home edit pencil, the /my/team management surface, etc.
 */
export function canManageTeam(player: MaybePlayer, team: MaybeTeam): boolean {
  if (!player || !team) return false;
  if (player.role === "admin") return true;
  if (player.role === "captain") return true;
  if (team.captainId && team.captainId === player.id) return true;
  if (player.teamId === team.id) {
    if (
      player.teamRole === "captain" ||
      player.teamRole === "manager" ||
      player.teamRole === "coach"
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Stricter gate for member-management UI (assigning team_role to other
 * players). Captain alone is not enough — Supabase trg_guard_team_role
 * blocks self-mutation and other-team mutation. Members page uses this.
 */
export function canManageTeamMembers(
  player: MaybePlayer,
  team: MaybeTeam,
): boolean {
  if (!player || !team) return false;
  if (player.role === "admin") return true;
  if (player.teamId !== team.id) return false;
  return player.teamRole === "manager" || player.teamRole === "coach";
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
  return player.teamId === teamId;
}
