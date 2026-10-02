import { supabase } from "@/config/supabase";
import { createPendingPresenceTracker } from "./presence-pending";
import { createPresencePublisher } from "./presence-publisher";

export interface SharedRecordingState { connected: boolean; names: string[]; pendingElsewhere: number; blockingPendingElsewhere: number }

type RecordingChannel = ReturnType<typeof supabase.channel>;
const closingByTopic = new Map<string, Promise<unknown>>();

function removeRecordingChannel(topic: string, channel: RecordingChannel) {
  // Supabase reuses same-topic instances until asynchronous unsubscribe completes.
  const closing = Promise.resolve().then(() => supabase.removeChannel(channel)).catch(() => {}).finally(() => {
    if (closingByTopic.get(topic) === closing) closingByTopic.delete(topic);
  });
  closingByTopic.set(topic, closing);
  return closing;
}

/** Presence is advisory UI only. RPCs authorize and return every authoritative value. */
export function joinRecordingChannel(options: {
  matchId: string; actorId: string; deviceId: string; name: string;
  refresh: () => void; onState: (state: SharedRecordingState) => void;
}) {
  let connected = false;
  let pending = 0;
  let blockingPending = 0;
  let queueRevision = 0;
  let disposed = false;
  let channel: RecordingChannel | undefined;
  let rejoinTimer: ReturnType<typeof setTimeout> | undefined;
  const key = `${options.actorId}:${options.deviceId}`;
  const topic = `match-recording:${options.matchId}`;
  const pendingTracker = createPendingPresenceTracker(key);
  const publisher = createPresencePublisher(payload => channel ? channel.track(payload) : Promise.resolve("error"));
  const updatePresence = () => publisher.set({ name: options.name, pending, blockingPending, queueRevision });
  updatePresence();
  const publish = () => {
    if (disposed) return;
    if (!connected || !channel) { options.onState({ connected: false, names: [], pendingElsewhere: 0, blockingPendingElsewhere: 0 }); return; }
    const entries = Object.entries(channel.presenceState<{ name?: string; pending?: number; blockingPending?: number; queueRevision?: number }>()).flatMap(([id, rows]) => rows.map(row => ({ ...row, key: id })));
    options.onState({ connected, names: [...new Set(entries.map(e => String(e.name ?? "기록자").slice(0, 40)))],
      ...pendingTracker(entries) });
  };
  const refresh = () => { if (!disposed) options.refresh(); };
  const startWhenReady = () => {
    const closing = closingByTopic.get(topic);
    if (closing) void closing.then(() => { if (!disposed && !channel) join(); });
    else if (!disposed && !channel) join();
  };
  const join = () => {
    if (disposed) return;
    const current = supabase.channel(topic, { config: { presence: { key } } });
    channel = current;
    const currentRefresh = () => { if (channel === current) refresh(); };
    current.on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `id=eq.${options.matchId}` }, currentRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "match_events", filter: `match_id=eq.${options.matchId}` }, currentRefresh)
      .on("presence", { event: "sync" }, () => { if (channel === current) publish(); })
      .subscribe(status => {
        if (disposed || channel !== current) return;
        connected = status === "SUBSCRIBED";
        publisher.setActive(connected);
        publish();
        if (connected) refresh();
        if (status === "CLOSED") {
          // CLOSED channels leave the SDK collection and do not rejoin on their own.
          channel = undefined;
          removeRecordingChannel(topic, current);
          clearTimeout(rejoinTimer);
          rejoinTimer = setTimeout(() => { rejoinTimer = undefined; startWhenReady(); }, 1000);
        }
      });
  };
  startWhenReady();
  const offline = () => { connected = false; publisher.setActive(false); publish(); };
  const online = () => {
    connected = channel?.state === "joined";
    publisher.setActive(connected); publish(); refresh();
    if (!channel && rejoinTimer === undefined) startWhenReady();
  };
  window.addEventListener("offline", offline);
  window.addEventListener("online", online);
  return {
    setPending(count: number, blockingCount: number, revision: number) {
      if (revision < queueRevision) return;
      pending = count; blockingPending = blockingCount; queueRevision = revision; updatePresence();
    },
    close() {
      if (disposed) return;
      disposed = true;
      publisher.close();
      clearTimeout(rejoinTimer);
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
      if (channel) removeRecordingChannel(topic, channel);
    },
  };
}
