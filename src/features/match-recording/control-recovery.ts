import { reconcileSnapshot, type RecordingMatch, type RecordingRoom } from "./model.ts";

export function canReleaseRejectedEnd(room: RecordingRoom): boolean {
  const first = room.pending[0];
  const rejection = room.rejectedOperation;
  return !!(room.blocked && first?.kind === "end" && rejection?.id === first.id &&
    rejection.code === "22023" && rejection.message.includes("clock control changed"));
}

/** User-reviewed recovery for one definitely rejected end; the original journal is immutable. */
export function releaseRejectedEnd(room: RecordingRoom, incoming: RecordingMatch, operationId: string): RecordingRoom {
  if (incoming.id !== room.matchId || (incoming.serverRevision ?? 0) < (room.base.serverRevision ?? 0)) {
    throw new Error("최신 경기 상태를 다시 불러온 뒤 확인해주세요.");
  }
  const next = reconcileSnapshot(room, incoming);
  // A concurrent retry may already have been acknowledged; never remove anything else.
  if (next.base.appliedOperationIds?.includes(operationId)) {
    return room.rejectedOperation?.id === operationId
      ? { ...next, blocked: false, error: undefined, rejectedOperation: undefined }
      : next;
  }
  if (!canReleaseRejectedEnd(next) || next.pending[0].id !== operationId) {
    throw new Error("해제할 수 있는 이전 종료 요청이 없습니다. 현재 기록을 확인해주세요.");
  }
  return {
    ...next,
    pending: next.pending.filter(command => command.id !== operationId),
    reviewedOperationIds: [...new Set([...(next.reviewedOperationIds ?? []), operationId])],
    notice: "반영되지 않은 이전 종료 요청을 해제했습니다. 최신 상태를 확인한 뒤 경기 종료를 다시 눌러주세요.",
    blocked: false, error: undefined, rejectedOperation: undefined,
  };
}
