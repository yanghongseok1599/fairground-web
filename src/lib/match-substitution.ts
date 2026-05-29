interface Slot { playerId: string }
interface SubInput { outId: string; inId: string; onCourt: Slot[]; bench: Slot[] }
export type SubResult = { ok: true } | { ok: false; reason: string };

/** 교체 유효성: OUT 은 코트(선발)에, IN 은 벤치에 있어야 하며 서로 달라야 한다. */
export function validateSubstitution({ outId, inId, onCourt, bench }: SubInput): SubResult {
  if (outId === inId) return { ok: false, reason: "같은 선수" };
  if (!onCourt.some((s) => s.playerId === outId)) return { ok: false, reason: "OUT 선수가 코트에 없음" };
  if (!bench.some((s) => s.playerId === inId)) return { ok: false, reason: "IN 선수가 벤치에 없음" };
  return { ok: true };
}
