import "server-only";
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getTournamentDisplayName } from "@/features/tournaments/public-fixtures";
import { shootoutResultText } from "@/features/match-shootout/model";

// Anonymous RLS reads only; crawler requests never inherit a member session or service key.
export const getSharedMatchResult = cache(async (id: string) => {
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) return null;
  const client = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(10_000) }) },
  });
  const { data: match, error } = await client.from("matches")
    .select("id,tournament_id,home_team_name,away_team_name,home_score,away_score,home_shootout_score,away_shootout_score,round,status")
    .eq("id", id).eq("status", "finished").maybeSingle();
  if (error) throw new Error("경기 결과를 불러오지 못했습니다.");
  if (!match?.tournament_id) return null;
  const { data: tournament, error: tournamentError } = await client.from("tournaments")
    .select("id,name").eq("id", match.tournament_id).maybeSingle();
  if (tournamentError) throw new Error("대회 정보를 불러오지 못했습니다.");
  if (!tournament) return null;
  const shootout = {
    homeScore: match.home_score, awayScore: match.away_score,
    homeShootoutScore: match.home_shootout_score ?? undefined, awayShootoutScore: match.away_shootout_score ?? undefined,
    homeTeamName: match.home_team_name, awayTeamName: match.away_team_name,
  };
  const shootoutText = shootoutResultText(shootout);
  return {
    id: match.id, tournamentId: tournament.id, tournamentName: getTournamentDisplayName(tournament),
    home: match.home_team_name, away: match.away_team_name,
    homeScore: match.home_score, awayScore: match.away_score, round: match.round,
    homeShootoutScore: shootout.homeShootoutScore, awayShootoutScore: shootout.awayShootoutScore, shootoutText,
    title: `${match.home_team_name} ${match.home_score} : ${match.away_score} ${match.away_team_name}${shootoutText ? ` · ${shootoutText}` : ""}`,
  };
});
