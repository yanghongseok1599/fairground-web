import type { CardType } from "@/types";
import { isDemoMode } from "@/config/supabase";
import { useDataStore } from "@/stores/dataStore";
import { fetchResultTournaments } from "@/features/match-results/api";
import { subscribeMatchResults } from "@/features/match-results/subscribe";
import { finalPlacements, finalRankCardType } from "./final-placements";
import { fetchPlacementMatches } from "./final-results-api";

type Tiers = Record<string, CardType>;
export const EMPTY_FINAL_CARD_TIERS: Tiers = {};

export async function fetchFinalCardTiers(): Promise<Tiers> {
  const tournaments = (await (isDemoMode ? useDataStore.getState().fetchTournaments() : fetchResultTournaments()))
    .filter(t => t.groups.length === 2 && t.groups.every(g => g.teamIds.length === 4))
    .sort((a, b) => b.createdAt - a.createdAt);
  // One batched score query covers every eligible tournament, without event N+1 reads.
  const matches = isDemoMode
    ? (await Promise.all(tournaments.map(t => useDataStore.getState().fetchMatches(t.id)))).flat()
    : await fetchPlacementMatches(tournaments.map(t => t.id));
  const next: Tiers = {};
  for (const tournament of tournaments) {
    for (const row of finalPlacements(tournament, matches)) {
      if (!next[row.teamId]) next[row.teamId] = finalRankCardType(row.rank)!;
    }
  }
  return next;
}

/** All mounted cards share one serialized subscription and keep good tiers on failed reads. */
export function createFinalCardTierStore(load: () => Promise<Tiers> = fetchFinalCardTiers) {
  let tiers = EMPTY_FINAL_CARD_TIERS;
  let stop: (() => void) | undefined;
  const listeners = new Set<() => void>();
  return {
    snapshot: () => tiers,
    subscribe(notify: () => void) {
      listeners.add(notify);
      if (listeners.size === 1) {
        stop = subscribeMatchResults({
          key: "final-card-tiers", load,
          publish: next => {
            if (JSON.stringify(next) === JSON.stringify(tiers)) return;
            tiers = next;
            for (const listener of listeners) listener();
          },
          onError: () => { /* A failed read never revokes a previously confirmed tier. */ },
        });
      }
      return () => {
        listeners.delete(notify);
        if (!listeners.size) { stop?.(); stop = undefined; }
      };
    },
  };
}
