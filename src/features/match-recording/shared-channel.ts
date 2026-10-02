import { supabase } from "@/config/supabase";

export interface SharedRecordingState { connected: boolean; names: string[]; pendingElsewhere: number }

/** Presence is advisory UI only. RPCs authorize and return every authoritative value. */
export function joinRecordingChannel(options: {
  matchId: string; actorId: string; deviceId: string; name: string;
  refresh: () => void; onState: (state: SharedRecordingState) => void;
}) {
  let connected = false;
  let pending = 0;
  const key = `${options.actorId}:${options.deviceId}`;
  const channel = supabase.channel(`match-recording:${options.matchId}`, { config: { presence: { key } } });
  const publish = () => {
    if (!connected) { options.onState({ connected: false, names: [], pendingElsewhere: 0 }); return; }
    const entries = Object.entries(channel.presenceState<{ name?: string; pending?: number }>()).flatMap(([id, rows]) => rows.map(row => ({ ...row, key: id })));
    options.onState({ connected, names: [...new Set(entries.map(e => String(e.name ?? "기록자").slice(0, 40)))],
      pendingElsewhere: entries.filter(e => e.key !== key).reduce((n, e) => n + Math.max(0, Number(e.pending) || 0), 0) });
  };
  const track = () => { if (connected) void channel.track({ name: options.name, pending }).catch(() => {}); };
  channel.on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `id=eq.${options.matchId}` }, options.refresh)
    .on("postgres_changes", { event: "*", schema: "public", table: "match_events", filter: `match_id=eq.${options.matchId}` }, options.refresh)
    .on("presence", { event: "sync" }, publish)
    .subscribe(status => { connected = status === "SUBSCRIBED"; publish(); if (connected) { track(); options.refresh(); } });
  const offline = () => { connected = false; publish(); };
  const online = () => { connected = channel.state === "joined"; publish(); track(); options.refresh(); };
  window.addEventListener("offline", offline);
  window.addEventListener("online", online);
  return {
    setPending(count: number) { if (pending === count) return; pending = count; track(); },
    close() { window.removeEventListener("offline", offline); window.removeEventListener("online", online); void supabase.removeChannel(channel); },
  };
}
