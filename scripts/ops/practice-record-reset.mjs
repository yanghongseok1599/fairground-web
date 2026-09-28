// Transaction owner must back up, approve the exact scope, and verify preservation.
// No CLI or implicit connection: this helper cannot independently access production.
export async function resetApprovedPracticeRecords(db, { tournamentIds, profileIds, badgePairs }) {
  if (!tournamentIds.length || new Set(tournamentIds).size !== tournamentIds.length) throw Error('Explicit unique tournament scope required');
  const matches = (await db.query('select * from public.matches where tournament_id=any($1::uuid[]) order by id for update', [tournamentIds])).rows;
  if (!matches.length) throw Error('No scoped matches');
  const matchIds = matches.map(m => m.id);
  const teamIds = [...new Set(matches.flatMap(m => [m.home_team_id, m.away_team_id]).filter(Boolean))];
  const outside = (await db.query(`select id from public.matches where not(id=any($1::uuid[])) and stats_applied
    and (home_team_id=any($2::uuid[]) or away_team_id=any($2::uuid[])) limit 1`, [matchIds, teamIds])).rows;
  if (outside.length) throw Error('Other finalized matches contribute to these teams; scoped recomputation required');
  const outsiders = (await db.query(`select distinct e.player_id from public.match_events e where e.player_id=any($1::uuid[]) and not(e.match_id=any($2::uuid[]))
    union select player_id from public.match_lineups where player_id=any($1::uuid[]) and not(match_id=any($2::uuid[]))`, [profileIds, matchIds])).rows;
  if (outsiders.length) throw Error('Other matches contribute to these players; scoped recomputation required');
  const eligible = new Set(matches.map(m => m.mom_player_id).filter(Boolean));
  for (const r of (await db.query('select player_id from public.match_events where match_id=any($1::uuid[]) union select player_id from public.match_lineups where match_id=any($1::uuid[])', [matchIds])).rows) eligible.add(r.player_id);
  if (profileIds.some(id => !eligible.has(id))) throw Error('Unrelated player in reset scope');
  if (badgePairs.some(b => !profileIds.includes(b.playerId))) throw Error('Unrelated badge in reset scope');
  await db.query("select set_config('app.in_end_match','1',true)");
  const counts = {};
  counts.notifications = (await db.query('delete from public.notifications where match_id=any($1::uuid[])', [matchIds])).rowCount;
  counts.activities = (await db.query('delete from public.activity_events where match_id=any($1::uuid[])', [matchIds])).rowCount;
  for (const { playerId, badgeId } of badgePairs) counts.activities += (await db.query("delete from public.activity_events where kind='badge_earned' and player_id=$1 and badge_id=$2", [playerId, badgeId])).rowCount;
  counts.events = (await db.query('delete from public.match_events where match_id=any($1::uuid[])', [matchIds])).rowCount;
  counts.matches = (await db.query(`update public.matches set status='scheduled',home_score=0,away_score=0,current_half=1,
    elapsed_seconds=0,is_running=false,stats_applied=false,mom_player_id=null
    where id=any($1::uuid[]) and (status<>'scheduled' or home_score<>0 or away_score<>0 or current_half<>1 or elapsed_seconds<>0 or is_running or stats_applied or mom_player_id is not null)`, [matchIds])).rowCount;
  counts.profiles = (await db.query(`update public.profiles set goals=0,assists=0,games=0,mom=0,card_rating=public.compute_card_rating(0,0,0),
    season_yellow_cards=0,ban_matches_remaining=0,is_banned=false,attendance_streak=0,attendance_streak_best=0 where id=any($1::uuid[])`, [profileIds])).rowCount;
  counts.badges = 0;
  for (const { playerId, badgeId } of badgePairs) counts.badges += (await db.query('update public.player_badges set progress=0,is_earned=false,earned_at=null where player_id=$1 and badge_id=$2', [playerId, badgeId])).rowCount;
  counts.teams = (await db.query(`update public.teams set season_stats=coalesce(season_stats::jsonb,'{}'::jsonb)||
    '{"wins":0,"draws":0,"losses":0,"points":0,"goalsFor":0,"goalsAgainst":0,"goalDifference":0,"gamesPlayed":0}'::jsonb where id=any($1::uuid[])`, [teamIds])).rowCount;
  await db.query(`with ranks as (select id,row_number() over(order by name asc) rank from public.teams where id=any($1::uuid[]) and is_approved)
    update public.teams t set season_stats=jsonb_set(t.season_stats::jsonb,'{rank}',to_jsonb(r.rank),true) from ranks r where t.id=r.id`, [teamIds]);
  return { counts, matchIds, teamIds };
}
