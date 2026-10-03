import { supabase } from "@/config/supabase";
import { fetchResultMatches, fetchResultTournaments } from "@/features/match-results/api";
import { CUP_RESULTS_TOURNAMENT_ID, PUBLISHED_MOM_RECIPIENTS } from "./data";
import type { PublicCupPlayer } from "./types";

/** Reuse the result reads so corrections update the announcement as one snapshot. */
export async function fetchCupResultSnapshot() {
  const [tournaments, matches] = await Promise.all([
    fetchResultTournaments(CUP_RESULTS_TOURNAMENT_ID),
    fetchResultMatches({ tournamentId: CUP_RESULTS_TOURNAMENT_ID }),
  ]);
  const ids = [...new Set([
    ...PUBLISHED_MOM_RECIPIENTS.map(recipient => recipient.playerId),
    ...matches.flatMap(match => [match.momPlayerId, ...match.events.map(event => event.playerId)]),
  ].filter((id): id is string => Boolean(id)))];
  const { data: profiles, error } = await supabase.from("public_player_profiles")
    .select("id,name,team_id").in("id", ids).retry(false);
  if (error) throw new Error(error.message);
  const players: PublicCupPlayer[] = (profiles ?? []).map(profile => ({
    id: profile.id, name: profile.name, teamId: profile.team_id ?? undefined,
  }));
  return { tournament: tournaments[0] ?? null, matches, players };
}
