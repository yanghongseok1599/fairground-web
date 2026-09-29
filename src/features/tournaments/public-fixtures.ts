import type { Tournament } from "@/types";

const OFFICIALLY_RELEASED_FIXTURES: Record<string, string> = {
  // 대회 운영자가 참가팀 공개를 요청한 2026 혼성 풋살대회.
  "5ff73034-1747-4b9e-874a-6fe19fa68ac1": "2026 제 1회 페어그라운드 혼성풋살대회",
};

export function isTournamentFixturesPublic(tournament: Pick<Tournament, "id" | "fixturesPublished">) {
  return tournament.fixturesPublished || Object.hasOwn(OFFICIALLY_RELEASED_FIXTURES, tournament.id);
}

export function getTournamentDisplayName(tournament: Pick<Tournament, "id" | "name">) {
  return OFFICIALLY_RELEASED_FIXTURES[tournament.id] ?? tournament.name;
}
