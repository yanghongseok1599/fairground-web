import type { Player, TeamRole } from "@/types";

export const TEAM_ROLE_LABELS: Record<TeamRole, string> = {
  coach: "감독",
  manager: "매니저",
  captain: "캡틴",
  member: "멤버",
};

export const TEAM_ROLE_DESCRIPTIONS: Record<TeamRole, string> = {
  coach: "선수 지도·경기 운영 총책임",
  manager: "팀 운영관리 담당",
  captain: "경기 중 대표·보조",
  member: "일반 멤버",
};

export const TEAM_ROLE_ORDER: readonly TeamRole[] = [
  "coach",
  "manager",
  "captain",
  "member",
] as const;

export function normalizeTeamRole(role: TeamRole | null | undefined): TeamRole {
  return role ?? "member";
}

export function isTeamCoach(player: Pick<Player, "teamRole"> | null | undefined): boolean {
  return player?.teamRole === "coach";
}

export function isTeamManager(player: Pick<Player, "teamRole"> | null | undefined): boolean {
  return player?.teamRole === "manager";
}

export function hasTeamOperationsPermission(
  player: Pick<Player, "teamRole"> | null | undefined,
): boolean {
  return player?.teamRole === "coach" || player?.teamRole === "manager";
}

export function hasMatchStaffPermission(
  player: Pick<Player, "teamRole"> | null | undefined,
): boolean {
  return player?.teamRole === "coach" || player?.teamRole === "captain";
}

export function selectableTeamRolesFor(actor: Pick<Player, "role" | "teamRole"> | null | undefined): TeamRole[] {
  if (!actor) return [];
  if (actor.role === "admin" || actor.teamRole === "coach") return [...TEAM_ROLE_ORDER];
  if (actor.teamRole === "manager") return ["manager", "captain", "member"];
  return [];
}
