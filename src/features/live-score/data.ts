import { supabase } from "@/config/supabase";
import { rowToLiveMatch, rowToMatch, rowToTournament } from "@/lib/mappers";
import type { LiveScoreSnapshot } from "./schedule";

/** Two reads, no per-match event queries: this view only needs the stored scoreboard. */
export async function fetchLiveScoreSnapshot(): Promise<LiveScoreSnapshot> {
  const [matches, tournaments] = await Promise.all([
    supabase.from("matches").select("*"),
    supabase.from("tournaments").select("*"),
  ]);
  if (matches.error) throw new Error(matches.error.message);
  if (tournaments.error) throw new Error(tournaments.error.message);
  return {
    matches: (matches.data ?? []).map((row) => ({
      ...rowToMatch(row),
      createdAt: Date.parse(row.created_at) || 0,
      currentHalf: rowToLiveMatch(row).currentHalf,
      elapsedSeconds: row.elapsed_seconds,
      isRunning: row.is_running,
    })),
    tournaments: (tournaments.data ?? []).map(rowToTournament),
  };
}
