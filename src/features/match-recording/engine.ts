import { useAuthStore } from "@/stores/authStore";
import { readRooms, updateRoom } from "./storage";
import { sendCommand } from "./transport";
import { flushRoom } from "./sync-core";
import { finalizationWaitMessage, otherPendingCount } from "./control-safety";

let running = false;
let failures = 0;
let nextAttemptAt = 0;
export async function syncRecordings(actorId: string, force = false): Promise<void> {
  if (running || !navigator.onLine || (!force && Date.now() < nextAttemptAt) || useAuthStore.getState().user?.uid !== actorId) return;
  if (!navigator.locks) return; // UI refuses writable mode without cross-tab coordination.
  running = true;
  try {
    await navigator.locks.request(`fg-match-sync:${actorId}`, { ifAvailable: true }, async lock => {
      if (!lock) return;
      for (const room of await readRooms(actorId)) {
        if (room.pending.length && !room.blocked) await flushRoom(room, {
          send: sendCommand, update: updateRoom, currentActor: () => useAuthStore.getState().user?.uid,
          waitBeforeSend: command => finalizationWaitMessage(command.kind, otherPendingCount(room.matchId)),
        });
      }
      const pending = (await readRooms(actorId)).some(r => r.pending.length && !r.blocked);
      failures = pending ? Math.min(failures + 1, 4) : 0;
      nextAttemptAt = Date.now() + (pending ? Math.min(60000, 5000 * 2 ** failures) : 0);
    });
  } catch { nextAttemptAt = Date.now() + 15000; }
  finally { running = false; }
}
