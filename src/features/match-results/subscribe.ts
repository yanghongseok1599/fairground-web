import { supabase, isDemoMode } from "@/config/supabase";
import { createMatchLiveRefresh } from "@/lib/match-live-refresh";
import { isFinalResultChange } from "./model";

/** Realtime is an invalidation hint; serialized server reads remain authoritative. */
export function subscribeMatchResults<T>(options: {
  key: string;
  matchId?: string;
  tournamentId?: string;
  finalOnly?: boolean;
  load: () => Promise<T>;
  publish: (value: T) => void;
  onError: (error: unknown) => void;
}) {
  const sync = createMatchLiveRefresh(options);
  let debounce: ReturnType<typeof setTimeout> | undefined;
  const reload = () => { void sync.refresh(); };
  const visible = () => {
    if (typeof document === "undefined" || document.visibilityState === "visible") reload();
  };
  const changed = (payload: { new?: unknown; old?: unknown }) => {
    if (options.finalOnly !== false && !isFinalResultChange(payload)) return;
    clearTimeout(debounce);
    debounce = setTimeout(visible, 150);
  };
  reload();
  const filter = options.matchId ? `id=eq.${options.matchId}` : options.tournamentId ? `tournament_id=eq.${options.tournamentId}` : undefined;
  // Never subscribe to whole profile rows: they may carry inline photos.
  const channel = isDemoMode ? null : supabase.channel(`match-results:${options.key}:${crypto.randomUUID()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "matches", ...(filter ? { filter } : {}) }, changed);
  if (channel && options.finalOnly === false) {
    // Match events are also corrected independently of the score.
    channel.on("postgres_changes", { event: "*", schema: "public", table: "match_events", ...(options.matchId ? { filter: `match_id=eq.${options.matchId}` } : {}) }, () => changed({}));
  }
  channel?.subscribe(status => { if (status === "SUBSCRIBED") visible(); });
  const poll = setInterval(visible, 5_000);
  if (typeof window !== "undefined") {
    window.addEventListener("online", visible);
    window.addEventListener("focus", visible);
  }
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", visible);
  return () => {
    sync.stop();
    clearTimeout(debounce);
    clearInterval(poll);
    if (typeof window !== "undefined") {
      window.removeEventListener("online", visible);
      window.removeEventListener("focus", visible);
    }
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", visible);
    if (channel) void supabase.removeChannel(channel);
  };
}
