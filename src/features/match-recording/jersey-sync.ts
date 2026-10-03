import type { Player } from "@/types";
import type { RecordingRoom } from "./model";

export type RecordingJersey = Pick<Player, "id" | "teamId" | "number" | "numberLabel">;

/** Refresh labels only: membership, lineups, results and queued commands stay intact. */
export function reconcileJerseys(room: RecordingRoom, jerseys: RecordingJersey[]): RecordingRoom {
  const byId = new Map(jerseys.map(player => [player.id, player]));
  let changed = false;
  const players = room.players.map(player => {
    const latest = byId.get(player.id);
    if (!latest || latest.teamId !== player.teamId ||
      (latest.number === player.number && latest.numberLabel === player.numberLabel)) return player;
    changed = true;
    return { ...player, number: latest.number, numberLabel: latest.numberLabel };
  });
  return changed ? { ...room, players } : room;
}

export function createJerseyRefresh(options: {
  active: () => boolean;
  current: () => RecordingRoom | undefined;
  read: (teamIds: string[]) => Promise<RecordingJersey[]>;
  update: (key: string, change: (current?: RecordingRoom) => RecordingRoom) => Promise<RecordingRoom>;
  publish: (room: RecordingRoom) => void;
  now?: () => number;
}) {
  const now = options.now ?? Date.now;
  let nextRead = 0;
  let running = false;
  return async () => {
    const room = options.current();
    if (!room || !options.active() || running || now() < nextRead) return;
    running = true;
    nextRead = now() + 15_000;
    try {
      const jerseys = await options.read([room.base.homeTeamId, room.base.awayTeamId]);
      if (!options.active()) return;
      const current = options.current();
      if (!current || current.key !== room.key || reconcileJerseys(current, jerseys) === current) return;
      const updated = await options.update(room.key, latest => {
        if (!options.active()) throw new DOMException("기록 화면이 변경되었습니다.", "AbortError");
        if (!latest || latest.key !== room.key) throw new Error("기기 저장 기록을 찾을 수 없습니다.");
        // Read the latest queue inside the transaction, never the earlier network snapshot.
        return reconcileJerseys(latest, jerseys);
      });
      if (options.active()) options.publish(updated);
    } catch { /* Keep the last known labels and all recording data when offline or unavailable. */ }
    finally { running = false; }
  };
}
