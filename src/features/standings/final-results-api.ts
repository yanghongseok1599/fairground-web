import { supabase } from "@/config/supabase";
import type { Match } from "@/types";

/** Final placement needs scores, not event histories, clocks or profile photos. */
export async function fetchPlacementMatches(tournamentIds: string[]): Promise<Match[]> {
  if (!tournamentIds.length) return [];
  const { data, error } = await supabase.from("matches")
    .select("id,tournament_id,group_id,round,home_team_id,away_team_id,home_team_name,away_team_name,home_score,away_score,home_shootout_score,away_shootout_score,status,scheduled_at,mom_player_id")
    .in("tournament_id", tournamentIds).retry(false);
  if (error) throw new Error(error.message);
  return (data ?? []).map(row => ({
    id: row.id, tournamentId: row.tournament_id ?? "", groupId: row.group_id ?? undefined,
    round: row.round, homeTeamId: row.home_team_id ?? "", awayTeamId: row.away_team_id ?? "",
    homeTeamName: row.home_team_name, awayTeamName: row.away_team_name,
    homeScore: row.home_score, awayScore: row.away_score, status: row.status,
    homeShootoutScore: row.home_shootout_score ?? undefined, awayShootoutScore: row.away_shootout_score ?? undefined,
    scheduledAt: row.scheduled_at ? Date.parse(row.scheduled_at) : 0, momPlayerId: row.mom_player_id ?? undefined, events: [],
  }));
}
