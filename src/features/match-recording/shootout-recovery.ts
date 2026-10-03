import { reconcileSnapshot, type RecordingMatch, type RecordingRoom } from "./model.ts";

const REVIEWABLE_ERRORS = new Set([
  "shootout result changed; review pending result",
  "shootout previous scores required; review pending result",
]);

export function canReleaseRejectedShootout(room: RecordingRoom): boolean {
  const first = room.pending[0];
  const rejection = room.rejectedOperation;
  return !!(room.blocked && first?.kind === "shootout" && rejection?.id === first.id &&
    rejection.code === "22023" && REVIEWABLE_ERRORS.has(rejection.message));
}

/** Explicit review of a definite rejection. Keep the journal and unrelated commands intact. */
export function releaseRejectedShootout(room: RecordingRoom, incoming: RecordingMatch, operationId: string, actorId: string): RecordingRoom {
  if (room.actorId !== actorId) throw new Error("기록 계정이 변경되었습니다. 원래 계정으로 로그인해주세요.");
  if (incoming.id !== room.matchId || (incoming.serverRevision ?? 0) < (room.base.serverRevision ?? 0)) {
    throw new Error("최신 경기 상태를 다시 불러온 뒤 확인해주세요.");
  }
  const next = reconcileSnapshot(room, incoming);
  // A concurrent response or realtime acknowledgement takes precedence over review.
  // In that case no following command is removed or marked as reviewed.
  if (next.base.appliedOperationIds?.includes(operationId)) {
    return room.rejectedOperation?.id === operationId
      ? { ...next, blocked: false, error: undefined, rejectedOperation: undefined }
      : next;
  }
  if (!canReleaseRejectedShootout(next) || next.pending[0].id !== operationId) {
    throw new Error("확인할 수 있는 승부차기 충돌이 없습니다. 현재 기록을 확인해주세요.");
  }
  if (next.pending.slice(1).some(command => command.kind === "shootout" || command.kind === "forfeit")) {
    throw new Error("추가 승부차기 또는 몰수패 요청이 있습니다. 기록을 보관한 채 관리자에게 확인해주세요.");
  }
  const rejectedJournalIndex = next.journal.findIndex(command => command.id === operationId);
  const followingEnds = next.pending.slice(1).filter(command => command.kind === "end");
  // flushRoom sends FIFO and stops at this definitely rejected head. A later end
  // in both queue and journal has never been sent and needs renewed confirmation.
  if (rejectedJournalIndex < 0 || followingEnds.some(command =>
    next.journal.findIndex(entry => entry.id === command.id) <= rejectedJournalIndex)) {
    throw new Error("종료 요청의 전송 여부를 확인하지 못했습니다. 기존 기록을 보관하고 있습니다.");
  }
  const reviewed = new Set([operationId, ...followingEnds.map(command => command.id)]);
  return {
    ...next,
    pending: next.pending.filter(command => !reviewed.has(command.id)),
    reviewedOperationIds: [...new Set([...(next.reviewedOperationIds ?? []), ...reviewed])],
    notice: "승부차기 결과가 변경되어 이전 승부차기·종료 요청을 해제했습니다. 서버 결과를 확인하고 다시 기록·종료해주세요.",
    blocked: false, error: undefined, rejectedOperation: undefined,
  };
}
