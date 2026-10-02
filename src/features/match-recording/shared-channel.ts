import { supabase } from "@/config/supabase";
import { mergeKnownPending } from "./presence-pending";

export interface SharedRecordingState { connected: boolean; names: string[]; pendingElsewhere: number; blockingPendingElsewhere: number }

type RecordingChannel = ReturnType<typeof supabase.channel>;
const closingByTopic = new Map<string, Promise<unknown>>();

function removeRecordingChannel(topic: string, channel: RecordingChannel) {
  // Supabase reuses same-topic instances until asynchronous unsubscribe completes.
  const closing = Promise.resolve().then(() => supabase.removeChannel(channel)).catch(() => {}).finally(() => {
    if (closingByTopic.get(topic) === closing) closingByTopic.delete(topic);
  });
  closingByTopic.set(topic, closing);
}

/** Presence is advisory UI only. RPCs authorize and return every authoritative value. */
export function joinRecordingChannel(options: {
  matchId: string; actorId: string; deviceId: string; name: string;
  refresh: () => void; onState: (state: SharedRecordingState) => void;
}) {
  let connected = false;
  let pending = 0;
  let blockingPending = 0;
  let knownPending = new Map<string, number>();
  let disposed = false;
  let channel: RecordingChannel | undefined;
  const key = `${options.actorId}:${options.deviceId}`;
  const topic = `match-recording:${options.matchId}`;
  const publish = () => {
    if (disposed) return;
    if (!connected || !channel) { options.onState({ connected: false, names: [], pendingElsewhere: 0, blockingPendingElsewhere: 0 }); return; }
    const entries = Object.entries(channel.presenceState<{ name?: string; pending?: number; blockingPending?: number }>()).flatMap(([id, rows]) => rows.map(row => ({ ...row, key: id })));
    const others = entries.filter(e => e.key !== key);
    knownPending = mergeKnownPending(knownPending, entries, key);
    const activeKeys = new Set(others.map(e => e.key));
    const departedPending = [...knownPending].reduce((n, [peer, count]) => n + (activeKeys.has(peer) ? 0 : count), 0);
    options.onState({ connected, names: [...new Set(entries.map(e => String(e.name ?? "기록자").slice(0, 40)))],
      pendingElsewhere: departedPending + others.reduce((n, e) => n + Math.max(0, Number(e.pending) || 0), 0),
      blockingPendingElsewhere: [...knownPending.values()].reduce((n, count) => n + count, 0) });
  };
  const refresh = () => { if (!disposed) options.refresh(); };
  const track = () => { if (!disposed && connected && channel) void channel.track({ name: options.name, pending, blockingPending }).catch(() => {}); };
  const join = () => {
    if (disposed) return;
    channel = supabase.channel(topic, { config: { presence: { key } } });
    channel.on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `id=eq.${options.matchId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "match_events", filter: `match_id=eq.${options.matchId}` }, refresh)
      .on("presence", { event: "sync" }, publish)
      .subscribe(status => { if (disposed) return; connected = status === "SUBSCRIBED"; publish(); if (connected) { track(); refresh(); } });
  };
  const closing = closingByTopic.get(topic);
  if (closing) void closing.then(join);
  else join();
  const offline = () => { connected = false; publish(); };
  const online = () => { connected = channel?.state === "joined"; publish(); track(); refresh(); };
  window.addEventListener("offline", offline);
  window.addEventListener("online", online);
  return {
    setPending(count: number, blockingCount: number) { if (pending === count && blockingPending === blockingCount) return; pending = count; blockingPending = blockingCount; track(); },
    close() {
      if (disposed) return;
      disposed = true;
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
      if (channel) removeRecordingChannel(topic, channel);
    },
  };
}
