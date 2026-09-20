"use client";

import { TournamentPushCard } from "@/features/tournament-readiness/components/tournament-push-card";
import { useTournamentPush } from "@/features/tournament-readiness/hooks/use-tournament-push";

/** Shared, account-aware alert settings for existing entry points. */
export function PushEnableCard({ compact = false }: { compact?: boolean }) {
  const push = useTournamentPush();
  return <TournamentPushCard push={push} compact={compact} />;
}
