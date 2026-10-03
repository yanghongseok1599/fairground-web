import { supabaseServer } from "@/lib/supabase-server";
import {
  KNOCKOUT_TOURNAMENT_ID,
  resolveKnockoutFixtures,
} from "@/features/knockout-schedule/resolve-knockout-fixtures";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store, max-age=0" };

/** Published Cup fixtures only: no member session, event history or player data. */
export async function GET() {
  try {
    const { data, error } = await supabaseServer.from("matches")
      .select("id,tournament_id,group_id,round,home_team_id,away_team_id,home_team_name,away_team_name,home_score,away_score,home_shootout_score,away_shootout_score,status")
      .eq("tournament_id", KNOCKOUT_TOURNAMENT_ID)
      .is("group_id", null)
      .gte("round", 13).lte("round", 20)
      .order("round")
      .abortSignal(AbortSignal.timeout(10_000)).retry(false);
    if (error) throw new Error("경기 대진을 불러오지 못했습니다.");
    const matches = (data ?? []).map(row => ({
      id: row.id, tournamentId: row.tournament_id ?? "", round: row.round,
      homeTeamId: row.home_team_id ?? "", awayTeamId: row.away_team_id ?? "",
      homeTeamName: row.home_team_name, awayTeamName: row.away_team_name,
      homeScore: row.home_score, awayScore: row.away_score, status: row.status,
      homeShootoutScore: row.home_shootout_score ?? undefined,
      awayShootoutScore: row.away_shootout_score ?? undefined,
    }));
    return Response.json({ fixtures: resolveKnockoutFixtures(matches) }, { headers });
  } catch {
    // A failed read must not replace the last confirmed fixtures with placeholders.
    return Response.json({ error: "경기 대진을 불러오지 못했습니다." }, { status: 503, headers });
  }
}
