-- This cup's last four placement fixtures follow the completed 13-16 results.
-- No existing match, event, clock, statistic, permission or preparation-alert state is rewritten.
create unique index matches_cup_rank_round_unique
  on public.matches(tournament_id,round)
  where tournament_id='5ff73034-1747-4b9e-874a-6fe19fa68ac1'::uuid and round between 17 and 20;

create function public.ensure_cup_rank_fixtures(p_tournament_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  source record;
  winners uuid[] := array[]::uuid[];
  losers uuid[] := array[]::uuid[];
  winner_names text[] := array[]::text[];
  loser_names text[] := array[]::text[];
  home_won boolean;
  created_ids uuid[] := array[]::uuid[];
  fixture record;
  new_id uuid;
  source_count integer;
begin
  if p_tournament_id is distinct from '5ff73034-1747-4b9e-874a-6fe19fa68ac1'::uuid then
    raise exception 'rank fixture automation is limited to this cup' using errcode='22023';
  end if;
  -- Source rows are read without row locks. Two different finalizers must never
  -- hold their own match and wait for each other's match through this helper.
  perform pg_advisory_xact_lock(hashtextextended('fairground-rank-fixtures:'||p_tournament_id::text,0));
  select count(*) into source_count from public.matches
    where tournament_id=p_tournament_id and round between 13 and 16;
  if source_count<>4 or exists(
    select 1 from public.matches where tournament_id=p_tournament_id and round between 13 and 16
    group by round having count(*)<>1
  ) then
    return jsonb_build_object('status','waiting_for_sources','createdMatchIds','[]'::jsonb);
  end if;
  if (select count(distinct t.team_id) from public.matches m cross join lateral unnest(array[m.home_team_id,m.away_team_id]) t(team_id)
      where m.tournament_id=p_tournament_id and m.round between 13 and 16)<>8 then
    return jsonb_build_object('status','waiting_for_teams','createdMatchIds','[]'::jsonb);
  end if;
  for source in
    select * from public.matches where tournament_id=p_tournament_id and round between 13 and 16 order by round
  loop
    if source.status<>'finished' or source.stats_applied is distinct from true or source.group_id is not null or
       source.home_team_id is null or source.away_team_id is null or source.home_team_id=source.away_team_id then
      return jsonb_build_object('status','waiting_for_results','createdMatchIds','[]'::jsonb);
    end if;
    if source.home_score=source.away_score then
      if source.home_shootout_score is null or source.away_shootout_score is null or source.home_shootout_score=source.away_shootout_score then
        return jsonb_build_object('status','waiting_for_shootout','createdMatchIds','[]'::jsonb);
      end if;
      home_won:=source.home_shootout_score>source.away_shootout_score;
    else
      home_won:=source.home_score>source.away_score;
    end if;
    winners:=array_append(winners,case when home_won then source.home_team_id else source.away_team_id end);
    losers:=array_append(losers,case when home_won then source.away_team_id else source.home_team_id end);
    winner_names:=array_append(winner_names,case when home_won then source.home_team_name else source.away_team_name end);
    loser_names:=array_append(loser_names,case when home_won then source.away_team_name else source.home_team_name end);
  end loop;
  for fixture in
    select 17 as round,losers[1] as home_id,losers[2] as away_id,loser_names[1] as home_name,loser_names[2] as away_name,timestamptz '2026-10-03 15:20:00+09' as scheduled_at
    union all select 18,winners[1],winners[2],winner_names[1],winner_names[2],timestamptz '2026-10-03 15:40:00+09'
    union all select 19,losers[3],losers[4],loser_names[3],loser_names[4],timestamptz '2026-10-03 16:00:00+09'
    union all select 20,winners[3],winners[4],winner_names[3],winner_names[4],timestamptz '2026-10-03 16:20:00+09'
  loop
    new_id:=null;
    insert into public.matches(tournament_id,group_id,round,home_team_id,away_team_id,home_team_name,away_team_name,
      home_score,away_score,status,scheduled_at,current_half,elapsed_seconds,is_running,stats_applied)
    values(p_tournament_id,null,fixture.round,fixture.home_id,fixture.away_id,fixture.home_name,fixture.away_name,
      0,0,'scheduled',fixture.scheduled_at,1,0,false,false)
    on conflict (tournament_id,round) where tournament_id='5ff73034-1747-4b9e-874a-6fe19fa68ac1'::uuid and round between 17 and 20
    do nothing returning id into new_id;
    if new_id is not null then created_ids:=array_append(created_ids,new_id); end if;
  end loop;
  return jsonb_build_object('status','ready','createdMatchIds',to_jsonb(created_ids));
end $$;
revoke all on function public.ensure_cup_rank_fixtures(uuid) from public,anon,authenticated,service_role;

create function public.ensure_cup_rank_fixtures_after_result()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.tournament_id='5ff73034-1747-4b9e-874a-6fe19fa68ac1'::uuid and new.round between 13 and 16 then
    perform public.ensure_cup_rank_fixtures(new.tournament_id);
  end if;
  return null;
end $$;
revoke all on function public.ensure_cup_rank_fixtures_after_result() from public,anon,authenticated,service_role;

create constraint trigger cup_rank_fixtures_after_result
  after update on public.matches deferrable initially deferred for each row
  when (new.status='finished' and (old.status is distinct from new.status or
    old.home_shootout_score is distinct from new.home_shootout_score or
    old.away_shootout_score is distinct from new.away_shootout_score))
  execute function public.ensure_cup_rank_fixtures_after_result();

notify pgrst, 'reload schema';
