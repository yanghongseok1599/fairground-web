"use client";

import { useSyncExternalStore } from "react";
import { useDataStore } from "@/stores/dataStore";
import type { CardType } from "@/types";
import { finalPlacements, finalRankCardType } from "./final-placements";

const empty: Record<string, CardType> = {};
let tiers = empty;
let pending = false;
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

/** 모든 카드가 하나의 공개 조회를 공유한다. 확정 전에는 기존 카드 등급을 유지한다. */
async function refresh() {
  if (pending) return;
  pending = true;
  try {
    const store = useDataStore.getState();
    const tournaments = (await store.fetchTournaments()).filter(t => t.groups.length === 2 && t.groups.every(g => g.teamIds.length === 4))
      .sort((a, b) => b.createdAt - a.createdAt);
    const next: Record<string, CardType> = {};
    for (const t of tournaments) {
      const ranks = finalPlacements(t, await store.fetchMatches(t.id));
      for (const row of ranks) if (!next[row.teamId]) next[row.teamId] = finalRankCardType(row.rank)!;
    }
    if (JSON.stringify(next) !== JSON.stringify(tiers)) {
      tiers = next;
      for (const notify of listeners) notify();
    }
  } catch {
    // 일시적인 조회 실패로 이미 확정된 카드 등급을 되돌리지 않는다.
  } finally { pending = false; }
}
function subscribe(notify: () => void) {
  listeners.add(notify);
  if (listeners.size === 1) {
    void refresh();
    timer = setInterval(refresh, 30000);
  }
  return () => {
    listeners.delete(notify);
    if (!listeners.size) { clearInterval(timer); timer = undefined; }
  };
}
const inactiveSubscribe = () => () => undefined;
export function useFinalCardTier(teamId?: string): CardType | undefined {
  const snapshot = useSyncExternalStore(teamId ? subscribe : inactiveSubscribe, () => tiers, () => empty);
  return teamId ? snapshot[teamId] : undefined;
}
