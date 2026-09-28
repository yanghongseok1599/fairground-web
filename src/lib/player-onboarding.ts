import { parseJerseyNumber } from "./jersey-number";
import { hasPortraitConsent } from "@/features/portrait-consent/policy";
import type { Player } from "@/types";

export function hasCompletedPlayerCardSetup(player: Player | null | undefined): boolean {
  if (!player) return false;
  return (
    Boolean(player.name?.trim()) &&
    parseJerseyNumber(String(player.number)) !== null &&
    (Number(player.number) > 0 || player.number === "00" || player.jerseyNumberAssigned === true) &&
    Boolean(player.position) &&
    // A photo alone is not evidence of personal consent.
    hasPortraitConsent(player)
  );
}

export function shouldContinueGroundChallengeSetup(player: Player | null | undefined): boolean {
  if (!player) return true;
  return !hasCompletedPlayerCardSetup(player);
}
