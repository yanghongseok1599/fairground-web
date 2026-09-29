import type { Tournament } from "@/types";

const OFFICIAL_TOURNAMENT_NAMES: Record<string, string> = {
  "5ff73034-1747-4b9e-874a-6fe19fa68ac1": "2026 제 1회 페어그라운드 혼성풋살대회",
};

export function getTournamentDisplayName(tournament: Pick<Tournament, "id" | "name">) {
  return OFFICIAL_TOURNAMENT_NAMES[tournament.id] ?? tournament.name;
}
