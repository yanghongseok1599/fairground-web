export interface PendingPresence { key: string; pending?: number; blockingPending?: number; queueRevision?: number }
type QueuePresence = { key: string; pending: number; blockingPending: number; queueRevision?: number };

function count(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

/** SDK presence metas can contain historical updates; one durable queue exists per key. */
function latestPresences(entries: PendingPresence[], ownKey: string): Map<string, QueuePresence> {
  const latest = new Map<string, QueuePresence>();
  for (const entry of entries) {
    if (entry.key === ownKey) continue;
    const blockingPending = count(entry.blockingPending ?? entry.pending);
    if (blockingPending === undefined) continue;
    const next = { key: entry.key, pending: count(entry.pending) ?? blockingPending, blockingPending, queueRevision: count(entry.queueRevision) };
    const previous = latest.get(entry.key);
    const nextRevision = next.queueRevision ?? -1;
    const previousRevision = previous?.queueRevision ?? -1;
    if (!previous || nextRevision > previousRevision) latest.set(entry.key, next);
    else if (nextRevision === previousRevision) latest.set(entry.key, {
      ...next, pending: Math.max(previous.pending, next.pending), blockingPending: Math.max(previous.blockingPending, next.blockingPending),
    });
  }
  return latest;
}

/** A peer disappearing is not an acknowledgement that its known local queue was sent. */
export function mergeKnownPending(previous: ReadonlyMap<string, number>, entries: PendingPresence[], ownKey: string): Map<string, number> {
  const next = new Map(previous);
  for (const [key, state] of latestPresences(entries, ownKey)) {
    if (state.blockingPending === 0) next.delete(key);
    else next.set(key, state.blockingPending);
  }
  return next;
}

/** Keep known offline work and zero high-water marks until this recorder channel closes. */
export function createPendingPresenceTracker(ownKey: string) {
  const known = new Map<string, QueuePresence>();
  return (entries: PendingPresence[]) => {
    const active = latestPresences(entries, ownKey);
    for (const [key, next] of active) {
      const previous = known.get(key);
      const revision = next.queueRevision ?? -1;
      const previousRevision = previous?.queueRevision ?? -1;
      if (!previous || revision > previousRevision || (revision === -1 && previousRevision === -1)) known.set(key, next);
      else if (revision === previousRevision) known.set(key, {
        ...next, pending: Math.max(previous.pending, next.pending), blockingPending: Math.max(previous.blockingPending, next.blockingPending),
      });
    }
    let pendingElsewhere = 0;
    let blockingPendingElsewhere = 0;
    for (const [key, value] of known) {
      // End-only requests need not survive a departure; actual unsent records must.
      pendingElsewhere += active.has(key) ? value.pending : value.blockingPending;
      blockingPendingElsewhere += value.blockingPending;
    }
    return { pendingElsewhere, blockingPendingElsewhere };
  };
}
