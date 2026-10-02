import type { Match, MatchEvent, Player, MatchLineupEntry } from "@/types";

export type RecordingMatch = Match & { elapsedSeconds: number; currentHalf: 1 | 2; isRunning: boolean; lineups?: MatchLineupEntry[] };
export type CommandKind = "start" | "pause" | "resume" | "timer" | "event" | "cancel" | "mom" | "end" | "forfeit" | "substitute";
export interface RecordingCommand {
  id: string;
  kind: CommandKind;
  payload: Record<string, string | number>;
  at: number;
}
export interface RecordingRoom {
  key: string;
  actorId: string;
  matchId: string;
  base: RecordingMatch;
  players: Player[];
  lineups: MatchLineupEntry[];
  pending: RecordingCommand[];
  journal: RecordingCommand[];
  revision: number;
  savedAt: number;
  syncedAt?: number;
  error?: string;
  blocked?: boolean;
}

/** Pure projection: only unacknowledged commands overlay the server snapshot. */
export function projectRoom(room: RecordingRoom): RecordingMatch {
  const m = structuredClone(room.base);
  for (const command of room.pending) {
    const p = command.payload;
    switch (command.kind) {
      case "start": m.status = "live"; m.elapsedSeconds = 0; m.currentHalf = 1; m.isRunning = true; break;
      case "pause": m.isRunning = false; break;
      case "resume": m.isRunning = true; break;
      case "timer": m.elapsedSeconds = Math.min(720, Math.max(m.elapsedSeconds, Number(p.seconds))); m.currentHalf = Number(p.half) === 2 ? 2 : 1; break;
      case "mom": m.momPlayerId = String(p.playerId); break;
      case "end": m.status = "finished"; m.isRunning = false; break;
      case "forfeit": m.status = "finished"; m.isRunning = false; m.homeScore = p.teamId === m.homeTeamId ? 0 : 3; m.awayScore = p.teamId === m.awayTeamId ? 0 : 3; break;
      case "event": {
        const event = { ...p, id: `local:${command.id}`, timestamp: command.at } as unknown as MatchEvent;
        m.events.push(event);
        if (event.type === "goal") { if (event.teamId === m.homeTeamId) m.homeScore++; else m.awayScore++; }
        if (event.type === "yellow_card" && m.events.filter(e => !e.isCancelled && e.playerId === event.playerId && e.type === "yellow_card").length >= 2 && !m.events.some(e => !e.isCancelled && e.playerId === event.playerId && e.type === "red_card")) {
          m.events.push({ ...event, id: `auto:${command.id}`, type: "red_card" });
        }
        break;
      }
      case "cancel": {
        const id = p.eventOperationId ? `local:${p.eventOperationId}` : p.eventId;
        const event = m.events.find(e => e.id === id);
        if (event && !event.isCancelled) {
          event.isCancelled = true;
          if (event.type === "goal") { if (event.teamId === m.homeTeamId) m.homeScore--; else m.awayScore--; }
          if (event.type === "yellow_card" && m.events.filter(e => !e.isCancelled && e.playerId === event.playerId && e.type === "yellow_card").length < 2) {
            m.events.filter(e => e.id.startsWith("auto:") && e.playerId === event.playerId).forEach(e => { e.isCancelled = true; });
          }
        }
        break;
      }
      case "substitute":
        m.lineups = (m.lineups ?? room.lineups).map(entry => entry.teamId !== p.teamId ? entry : entry.playerId === p.outId ? { ...entry, isStarter: false } : entry.playerId === p.inId ? { ...entry, isStarter: true } : entry);
        m.events.push({ id: `local:${command.id}`, type: "substitution", playerId: String(p.inId), playerName: String(p.inName), teamId: String(p.teamId), minute: Number(p.minute), half: Number(p.half) === 2 ? 2 : 1, timestamp: command.at });
        break;
    }
  }
  return m;
}
