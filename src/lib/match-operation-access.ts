import type { Player } from "../types";

export type MatchTrack = "referee" | "coach" | "admin" | "none";

const STAFF_ROLES = ["captain", "manager", "coach"] as const;

interface TrackMatch {
  homeTeamId: string;
  awayTeamId: string;
  status: string;
}

/** player 와 match 를 받아 경기운영 진입 트랙을 결정한다. */
export function resolveMatchTrack(
  player: Pick<Player, "role" | "isApproved" | "teamId" | "teamRole"> | null,
  match: TrackMatch
): MatchTrack {
  if (!player) return "none";
  if (player.role === "admin") return "admin";
  if (player.role === "referee") return player.isApproved ? "referee" : "none";

  const isParticipantStaff =
    !!player.teamId &&
    (player.teamId === match.homeTeamId || player.teamId === match.awayTeamId) &&
    !!player.teamRole &&
    (STAFF_ROLES as readonly string[]).includes(player.teamRole);

  return isParticipantStaff ? "coach" : "none";
}
