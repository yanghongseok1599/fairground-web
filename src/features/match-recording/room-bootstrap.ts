import type { Player } from "@/types";
import type { RecordingMatch, RecordingRoom } from "./model";
import type { RoomSessionGuard } from "./room-session";

/** Commit a room only once its adapter can render it; malformed caches remain recoverable. */
export function createRoomPublication<T extends { publish: (room: RecordingRoom) => void }>(
  createAdapter: (room: RecordingRoom) => T,
  onPublished: (room: RecordingRoom, adapter: T) => void,
) {
  let current: RecordingRoom | undefined;
  let adapter: T | undefined;
  return {
    get current() { return current; },
    publish(room: RecordingRoom) {
      if (current && room.revision < current.revision) return;
      const next = adapter ?? createAdapter(room);
      if (adapter) next.publish(room);
      current = room;
      adapter = next;
      onPublished(room, next);
    },
  };
}

export async function prepareRecordingRoom(options: {
  actorId: string; matchId: string; allowed: boolean; hasProfile: boolean;
  guard: RoomSessionGuard;
  readRooms: (actorId: string) => Promise<RecordingRoom[]>;
  readSnapshot: (matchId: string) => Promise<RecordingMatch>;
  fetchPlayers: (teamId: string) => Promise<Player[]>;
  updateRoom: (key: string, change: (room?: RecordingRoom) => RecordingRoom, signal?: AbortSignal) => Promise<RecordingRoom>;
  publish: (room: RecordingRoom) => void;
}) {
  const { guard, actorId, matchId } = options;
  guard.assertActive();
  const existing = (await options.readRooms(actorId)).find(room => room.matchId === matchId);
  guard.assertActive();
  if (existing && (options.allowed || !options.hasProfile)) options.publish(existing);
  if (existing || !options.allowed) return;
  const base = await options.readSnapshot(matchId);
  guard.assertActive();
  const [home, away] = await Promise.all([options.fetchPlayers(base.homeTeamId), options.fetchPlayers(base.awayTeamId)]);
  guard.assertActive();
  if (!home.length || !away.length) throw new Error("양 팀 명단을 확인한 후 기기 저장을 준비할 수 있습니다. 연결 후 다시 시도해주세요.");
  const room = await options.updateRoom(`${actorId}:${matchId}`, previous => {
    // updateRoom can itself wait for IndexedDB. Recheck inside the transaction
    // so a timed-out initializer cannot write after its replacement starts.
    guard.assertActive();
    return previous ?? {
      key: `${actorId}:${matchId}`, actorId, matchId, base, players: [...home, ...away], lineups: base.lineups ?? [],
      pending: [], journal: [], revision: 0, savedAt: Date.now(), syncedAt: Date.now(),
    };
  }, guard.signal);
  guard.assertActive();
  options.publish(room);
}
