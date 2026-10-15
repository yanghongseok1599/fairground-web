import { hasJerseyNumber } from "@/lib/jersey-number";
import type { Player } from "@/types";

export function hasCompletedPlayerCardSetup(player: Player | null | undefined): boolean {
  if (!player) return false;
  return (
    Boolean(player.name?.trim()) &&
    hasJerseyNumber(player) &&
    // 초상 홍보 이용 동의는 [선택] 이라 카드 완성 조건이 아니다.
    Boolean(player.position)
  );
}

export function shouldContinueGroundChallengeSetup(player: Player | null | undefined): boolean {
  if (!player) return true;
  return !hasCompletedPlayerCardSetup(player);
}
