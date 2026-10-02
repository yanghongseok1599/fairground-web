import type { MatchLineupEntry, Player } from "@/types";
import { jerseyNumberOrder } from "../../lib/jersey-number.ts";

/** 제출 여부와 무관하게 코트 밖의 출전 가능 팀 선수를 모두 표시한다. */
export function benchRoster(entries: MatchLineupEntry[], pool: Player[], onCourt: Player[]): Player[] {
  const onCourtIds = new Set(onCourt.map(p => p.id));
  const explicitIds = new Set(entries.filter(e => !e.isStarter).map(e => e.playerId));
  return pool.filter(p => !p.hasPlayerExperience && !onCourtIds.has(p.id))
    .sort((a, b) => Number(explicitIds.has(b.id)) - Number(explicitIds.has(a.id)) ||
      jerseyNumberOrder(a) - jerseyNumberOrder(b) || a.name.localeCompare(b.name, "ko"));
}
