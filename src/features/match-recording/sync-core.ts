import type { RecordingCommand, RecordingMatch, RecordingRoom } from "./model";
import { reconcileSnapshot } from "./model.ts";

// Injectable core makes response-loss and ordering testable without production writes.
export async function flushRoom(room: RecordingRoom, deps: {
  send: (matchId: string, command: RecordingCommand) => Promise<RecordingMatch>;
  update: (key: string, change: (room?: RecordingRoom) => RecordingRoom) => Promise<RecordingRoom>;
  currentActor: () => string | undefined;
}): Promise<void> {
  while (room.pending.length && !room.blocked && deps.currentActor() === room.actorId) {
    const command = room.pending[0];
    let base: RecordingMatch;
    try { base = await deps.send(room.matchId, command); }
    catch (error) {
      const code = (error as { code?: string }).code ?? "";
      const blocked = /^(22|23|42|P000)/.test(code);
      await deps.update(room.key, current => {
        if (!current) throw new Error("기기 저장 기록이 없습니다.");
        if (!current.pending.some(p => p.id === command.id)) return current;
        return { ...current, blocked, error: blocked ? "서버 확인이 필요한 기록이 있습니다. 기기 기록은 보관 중입니다. 백업 후 관리자에게 확인해주세요." : "연결 복구를 기다리고 있습니다. 이 기기에 저장된 기록을 자동으로 다시 전송합니다." };
      });
      return;
    }
    // A lost local acknowledgement is safe: the next send reuses the SAME UUID.
    room = await deps.update(room.key, current => {
      if (!current) throw new Error("기기 저장 기록이 없습니다.");
      const next = reconcileSnapshot(current, base);
      return { ...next, pending: next.pending.filter(p => p.id !== command.id), syncedAt: Date.now(), error: undefined, blocked: false };
    });
  }
}
