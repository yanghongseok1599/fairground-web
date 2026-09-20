import type { PracticeSnapshot } from "./store";
import { createPracticeFixture, PRACTICE_HOME_ID, PRACTICE_AWAY_ID } from "./fixtures";

export const PRACTICE_STORAGE_KEY = "fairground:practice-match:v1";

export function readPracticeSnapshot(storage: Pick<Storage, "getItem">): PracticeSnapshot | undefined {
  const raw = storage.getItem(PRACTICE_STORAGE_KEY);
  if (!raw) return;
  const data = JSON.parse(raw) as { version: number; snapshot: PracticeSnapshot };
  const s = data.snapshot;
  const statuses = ["scheduled", "live", "finished"];
  const eventTypes = ["goal", "assist", "yellow_card", "red_card", "foul", "substitution", "mom"];
  if (data.version !== 1 || !s || !s.match || typeof s.match.id !== "string" || !s.match.id.startsWith("practice-") ||
      !statuses.includes(s.match.status) || !Number.isFinite(s.match.scheduledAt) ||
      !Number.isInteger(s.elapsedSeconds) || s.elapsedSeconds < 0 || s.elapsedSeconds > 720 ||
      ![1, 10, 60].includes(s.speed) || !Number.isInteger(s.nextIncident) || s.nextIncident < 0 || s.nextIncident > 9 ||
      !Array.isArray(s.match.events) || !Array.isArray(s.lineup)) throw new Error("연습 기록이 손상되었습니다.");
  const fixture = createPracticeFixture(s.match.id, s.match.scheduledAt);
  const validPlayer = (id: string, team: string) => fixture.players.some(p => p.id === id && p.teamId === team);
  if (s.match.events.some(e => !e || typeof e.id !== "string" || !eventTypes.includes(e.type) || !validPlayer(e.playerId, e.teamId) ||
      !Number.isFinite(e.timestamp) || !Number.isFinite(e.minute) || (e.half !== 1 && e.half !== 2)) ||
      s.lineup.length !== 14 || new Set(s.lineup.map(p => p.playerId)).size !== 14 ||
      s.lineup.some(p => !validPlayer(p.playerId, p.teamId) || typeof p.isStarter !== "boolean") ||
      [PRACTICE_HOME_ID, PRACTICE_AWAY_ID].some(team => s.lineup.filter(p => p.teamId === team && p.isStarter).length !== 5) ||
      !Number.isInteger(s.match.homeScore) || s.match.homeScore < 0 || !Number.isInteger(s.match.awayScore) || s.match.awayScore < 0 ||
      (s.match.momPlayerId && !fixture.players.some(p => p.id === s.match.momPlayerId))) throw new Error("연습 기록이 손상되었습니다.");
  // Restore only this fixture's identities, never arbitrary saved team/player IDs.
  return {
    ...fixture, match: { ...fixture.match, status: s.match.status, homeScore: s.match.homeScore, awayScore: s.match.awayScore, events: s.match.events, momPlayerId: s.match.momPlayerId },
    lineup: fixture.lineup.map(p => ({ ...p, isStarter: s.lineup.find(row => row.playerId === p.playerId)!.isStarter })),
    elapsedSeconds: s.elapsedSeconds, speed: s.speed, nextIncident: s.nextIncident,
    running: false, automatic: false,
  };
}

export function savePracticeSnapshot(storage: Pick<Storage, "setItem">, snapshot: PracticeSnapshot) {
  storage.setItem(PRACTICE_STORAGE_KEY, JSON.stringify({ version: 1, snapshot }));
}
