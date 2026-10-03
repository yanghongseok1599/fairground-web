"use client";

import { createContext, useContext } from "react";
import { useStore, type StoreApi } from "zustand";
import type { Player } from "@/types";
import { useDataStore } from "@/stores/dataStore";

export type MatchControlOperations = Pick<ReturnType<typeof useDataStore.getState>,
  | "liveMatches" | "fetchMatch" | "fetchTeamPlayers" | "fetchMatchLineup"
  | "subscribeLiveMatches" | "startMatch" | "pauseMatch" | "resumeMatch"
  | "endMatch" | "forfeitMatch" | "substitutePlayer" | "addMatchEvent"
  | "cancelMatchEvent" | "updateMatchTimer" | "notifyNextMatchReady" | "setMatchMom"
> & {
  setMatchShootout?: ReturnType<typeof useDataStore.getState>["setMatchShootout"];
  managesClock?: boolean; canPersistClock?: boolean; allowsOfflineRecording?: boolean; recordingPlayers?: Player[];
};

// Only this subtree uses the practice store. The global production store and
// Supabase configuration are never switched into a demo mode.
export const MatchControlStoreContext = createContext<StoreApi<MatchControlOperations> | null>(null);

export function useMatchControlStore(): MatchControlOperations {
  const practice = useContext(MatchControlStoreContext);
  return useStore(practice ?? useDataStore);
}
