import type { TournamentGroup } from "@/types";
import { normalizeGroupName } from "./match-schedule.ts";

export function restoreGroupAssignment(groups: TournamentGroup[]): Record<string, string> {
  return Object.fromEntries(groups.flatMap((g) => g.teamIds.map((id) => [id, normalizeGroupName(g.name)])));
}

/** Fetch order must never change the seed order in a saved draw. */
export function orderGroupMembers<T extends { id: string }>(members: T[], previous?: TournamentGroup): T[] {
  const index = new Map((previous?.teamIds ?? []).map((id, i) => [id, i]));
  return [...members].sort((a, b) => (index.get(a.id) ?? Infinity) - (index.get(b.id) ?? Infinity));
}
