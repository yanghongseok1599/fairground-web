import type { Player } from "@/types";

export function getRefereeCandidates<T extends Pick<Player, "role" | "isApproved" | "createdAt">>(players: T[]): T[] {
  return players
    .filter((player) => player.role === "referee")
    .sort((a, b) => Number(a.isApproved) - Number(b.isApproved) || b.createdAt - a.createdAt);
}

export function getRefereeStatusLabel(player: Pick<Player, "isApproved">): string {
  return player.isApproved ? "활동 심판" : "심판 승인 대기";
}
