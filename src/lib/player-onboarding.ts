import type { Player } from "@/types";

export function hasCompletedPlayerCardSetup(player: Player | null | undefined): boolean {
  if (!player) return false;
  return (
    Boolean(player.name?.trim()) &&
    Number.isFinite(player.number) &&
    player.number > 0 &&
    Boolean(player.position) &&
    // Photos are optional. A submitted consent timestamp plus the required
    // card fields also marks a completed setup; OAuth defaults have neither.
    (Boolean(player.photoUrl?.trim()) || Boolean(player.portraitConsentAt))
  );
}

export function shouldContinueGroundChallengeSetup(player: Player | null | undefined): boolean {
  if (!player) return true;
  return !hasCompletedPlayerCardSetup(player);
}
