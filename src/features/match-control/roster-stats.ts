import type { MatchEvent, MatchEventType, Player } from "@/types";

export const ROSTER_EVENTS = [
  { type: "goal", label: "골", symbol: "⚽" },
  { type: "assist", label: "어시", symbol: "A" },
  { type: "yellow_card", label: "경고", symbol: "🟨" },
  { type: "red_card", label: "퇴장", symbol: "🟥" },
  { type: "foul", label: "반칙", symbol: "🚫" },
] as const;
export type RosterEventType = typeof ROSTER_EVENTS[number]["type"];
export const isRosterEvent = (value: unknown): value is RosterEventType => ROSTER_EVENTS.some(e => e.type === value);

export function rosterPlayers(players: Player[], teamId: string) {
  return players.filter(p => p.teamId === teamId && !p.hasPlayerExperience)
    .sort((a, b) => (a.number > 0 ? a.number : Infinity) - (b.number > 0 ? b.number : Infinity) || a.name.localeCompare(b.name, "ko"));
}

export function rosterStats(events: MatchEvent[]) {
  const counts = new Map<string, Partial<Record<MatchEventType, number>>>();
  for (const e of events) {
    if (e.isCancelled) continue;
    const row = counts.get(e.playerId) ?? {};
    row[e.type] = (row[e.type] ?? 0) + 1;
    counts.set(e.playerId, row);
  }
  return counts;
}
