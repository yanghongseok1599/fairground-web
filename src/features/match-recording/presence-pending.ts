export interface PendingPresence { key: string; pending?: number; blockingPending?: number }

/** A peer disappearing is not an acknowledgement that its known local queue was sent. */
export function mergeKnownPending(previous: ReadonlyMap<string, number>, entries: PendingPresence[], ownKey: string): Map<string, number> {
  const next = new Map(previous);
  const explicit = new Map<string, number>();
  for (const entry of entries) {
    if (entry.key === ownKey) continue;
    const count = entry.blockingPending ?? entry.pending;
    if (typeof count !== "number" || !Number.isFinite(count) || count < 0) continue;
    explicit.set(entry.key, Math.max(explicit.get(entry.key) ?? 0, Math.floor(count)));
  }
  for (const [key, count] of explicit) {
    if (count === 0) next.delete(key);
    else next.set(key, count);
  }
  return next;
}
