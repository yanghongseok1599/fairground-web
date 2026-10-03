import type { Match } from "@/types";

export const KNOCKOUT_TOURNAMENT_ID = "5ff73034-1747-4b9e-874a-6fe19fa68ac1";

/** 2026-10-03 운영자 확정: 17경기는 양팀 기권으로 미실시. 승패를 부여하지 않는다. */
export function fixtureOperatingNote(match: Pick<Match, "tournamentId" | "round" | "status">): string | undefined {
  if (match.tournamentId === KNOCKOUT_TOURNAMENT_ID && match.round === 17 && match.status === "cancelled") {
    return "양팀 기권 · 미실시";
  }
}
