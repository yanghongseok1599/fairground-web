import { supabase } from "@/config/supabase";
import { rowToEvent, rowToLiveMatch, rowToMatch, rowToTournament } from "@/lib/mappers";
import { PLAYER_RESULT_COLUMNS, TEAM_RESULT_COLUMNS, LEADERBOARD_RESULT_COLUMNS, type LeaderboardCategory } from "./model";

export async function fetchPlayerResult(id: string, ownProfile = false) {
  // Self reads include pending/unlisted players while public reads retain the view's privacy filter.
  const request = ownProfile
    ? supabase.from("profiles").select(PLAYER_RESULT_COLUMNS).eq("id", id)
    : supabase.from("public_player_profiles").select(PLAYER_RESULT_COLUMNS).eq("id", id);
  const { data, error } = await request.maybeSingle().retry(false);
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchTeamPlayerResults(teamId: string) {
  const { data, error } = await supabase.from("public_player_profiles").select(PLAYER_RESULT_COLUMNS).eq("team_id", teamId).retry(false);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchPlayerResults(ids: string[]) {
  if (!ids.length) return [];
  const { data, error } = await supabase.from("public_player_profiles").select(PLAYER_RESULT_COLUMNS).in("id", ids).retry(false);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchLeaderboardResults(category: LeaderboardCategory, limit = 20) {
  const column = category === "rating" ? "card_rating" : category === "streak" ? "attendance_streak" : category;
  const { data, error } = await supabase.from("public_player_profiles").select(LEADERBOARD_RESULT_COLUMNS)
    .gt(column, 0).order(column, { ascending: false }).order("name", { ascending: true }).limit(limit).retry(false);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchTeamResults(teamId?: string) {
  const request = supabase.from("teams").select(TEAM_RESULT_COLUMNS);
  const { data, error } = await (teamId ? request.eq("id", teamId) : request).retry(false);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** One event query per page refresh; a failed query must not become a successful empty history. */
export async function fetchResultMatches(scope: { tournamentId?: string; matchId?: string }) {
  let request = supabase.from("matches").select("*");
  if (scope.tournamentId) request = request.eq("tournament_id", scope.tournamentId);
  if (scope.matchId) request = request.eq("id", scope.matchId);
  const { data: rows, error } = await request.retry(false);
  if (error) throw new Error(error.message);
  if (!rows?.length) return [];
  const { data: events, error: eventError } = await supabase.from("match_events").select("*")
    .in("match_id", rows.map(row => row.id)).order("created_at", { ascending: true }).retry(false);
  if (eventError) throw new Error(eventError.message);
  return rows.map(row => {
    const history = (events ?? []).filter(event => event.match_id === row.id).map(rowToEvent);
    return row.status === "live" ? rowToLiveMatch(row, history) : rowToMatch(row, history);
  });
}

export async function fetchResultTournaments(id?: string) {
  const request = supabase.from("tournaments").select("*");
  const { data, error } = await (id ? request.eq("id", id) : request).retry(false);
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToTournament);
}
