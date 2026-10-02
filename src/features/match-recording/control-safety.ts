import type { CommandKind, RecordingCommand, RecordingMatch } from "./model";

type ObservedClock = { seconds: number; half: 1 | 2; version: number };

/** Explicit pause/end can save the screen's final second even from a backup operator. */
export function createObservedClock() {
  let observed: ObservedClock | undefined;
  return {
    remember(seconds: number, half: 1 | 2, version: number) {
      if (!Number.isFinite(seconds)) return;
      observed = { seconds: Math.min(720, Math.max(0, Math.floor(seconds))), half, version };
    },
    payload(match: RecordingMatch): Record<string, number> {
      const current = observed?.version === (match.clock?.version ?? 0) ? observed : undefined;
      return {
        _elapsedSeconds: Math.min(720, Math.max(match.elapsedSeconds, current?.seconds ?? 0)),
        _half: Math.max(match.currentHalf, current?.half ?? 1),
      };
    },
  };
}

/** Finalization itself must not make two operators wait on each other forever. */
export function blockingPendingCount(commands: RecordingCommand[]): number {
  return commands.filter(command => command.kind !== "end" && command.kind !== "forfeit").length;
}

// Presence is an advisory guard, never authorization or proof that unseen offline queues are empty.
const pendingSources = new Map<string, Set<() => number>>();
export function observeOtherPending(matchId: string, read: () => number): () => void {
  const sources = pendingSources.get(matchId) ?? new Set<() => number>();
  sources.add(read);
  pendingSources.set(matchId, sources);
  return () => {
    sources.delete(read);
    if (!sources.size) pendingSources.delete(matchId);
  };
}
export function otherPendingCount(matchId: string): number {
  return Math.max(0, ...[...(pendingSources.get(matchId) ?? [])].map(read => read()));
}
export function finalizationWaitMessage(kind: CommandKind, pending: number): string | undefined {
  if ((kind === "end" || kind === "forfeit") && pending > 0) {
    return `다른 기기에 전송 대기 기록 ${pending}건이 있습니다. 모두 동기화된 후 경기 종료를 다시 확인해주세요.`;
  }
}
