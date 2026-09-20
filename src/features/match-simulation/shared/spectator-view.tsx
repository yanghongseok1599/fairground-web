"use client";

import { useStore } from "zustand";
import { MatchControlStoreContext } from "@/features/match-control/store-context";
import { MatchControlScreen } from "@/features/match-control/match-control-screen";
import type { createRoomSession } from "./session";

export function PracticeSpectatorView({ session }: { session: ReturnType<typeof createRoomSession> }) {
  const { snapshot } = useStore(session.store);
  return <MatchControlStoreContext.Provider value={session.store}>
    <div className="p-3"><MatchControlScreen key={snapshot.match.id} matchId={snapshot.match.id} tournamentId={snapshot.match.tournamentId} practice spectator /></div>
  </MatchControlStoreContext.Provider>;
}
