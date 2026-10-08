"use client";

import { useSyncExternalStore } from "react";
import type { CardType } from "@/types";
import { createFinalCardTierStore, EMPTY_FINAL_CARD_TIERS } from "./final-card-tier-store";

const store = createFinalCardTierStore();
const inactiveSubscribe = () => () => undefined;

/** Whole galleries subscribe once to the same store as individual player/team cards. */
export function useFinalCardTiers(): Readonly<Record<string, CardType>> {
  return useSyncExternalStore(store.subscribe, store.snapshot, () => EMPTY_FINAL_CARD_TIERS);
}

export function useFinalCardTier(teamId?: string): CardType | undefined {
  const snapshot = useSyncExternalStore(teamId ? store.subscribe : inactiveSubscribe, store.snapshot, () => EMPTY_FINAL_CARD_TIERS);
  return teamId ? snapshot[teamId] : undefined;
}
