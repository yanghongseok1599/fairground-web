-- Match lifecycle hardening for tournament operations.
--
-- Goals:
-- 1) Referee/admin can safely start, pause, resume, and sync timer through RPCs.
-- 2) Goal/assist/card events remain editable only while match is live.
-- 3) Ending a match applies player stats, card rating, team league stats, and ranks once.

create or replace function public.compute_card_rating(
  p_goals integer,
  p_assists integer,
  p_mom integer
) returns integer
language sql
immutable
as $$
  select least(
    110,
    greatest(
      70,
      70
        + coalesce(p_goals, 0)
        + coalesce(p_assists, 0)
        + coalesce(p_mom, 0) * 3
    )
  )::integer;
$$;

create or replace function public.team_stats_with_result(
  p_stats jsonb,
  p_points integer,
  p_wins integer,
  p_draws integer,
  p_losses integer,
  p_goals_for integer,
  p_goals_against integer
) returns jsonb
language sql
immutable
as $$
  with s as (
    select coalesce(p_stats, '{}'::jsonb) as stats
  )
  select jsonb_build_object(
    'points', coalesce((stats->>'points')::integer, 0) + coalesce(p_points, 0),
    'rank', coalesce((stats->>'rank')::integer, 0),
    'wins', coalesce((stats->>'wins')::integer, 0) + coalesce(p_wins, 0),
    'draws', coalesce((stats->>'draws')::integer, 0) + coalesce(p_draws, 0),
    'losses', coalesce((stats->>'losses')::integer, 0) + coalesce(p_losses, 0),
    'goalsFor', coalesce((stats->>'goalsFor')::integer, 0) + coalesce(p_goals_for, 0),
    'goalsAgainst', coalesce((stats->>'goalsAgainst')::integer, 0) + coalesce(p_goals_against, 0),
    'goalDifference',
      coalesce((stats->>'goalDifference')::integer, 0)
      + coalesce(p_goals_for, 0)
      - coalesce(p_goals_against, 0),
    'gamesPlayed', coalesce((stats->>'gamesPlayed')::integer, 0) + 1
  )
  from s;
$$;

create or replace function public.recompute_team_ranks()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  r record;
begin
  for r in
    select
      id,
      row_number() over (
        order by
          coalesce((season_stats::jsonb->>'points')::integer, 0) desc,
          coalesce((season_stats::jsonb->>'goalDifference')::integer, 0) desc,
          coalesce((season_stats::jsonb->>'goalsFor')::integer, 0) desc,
          name asc
      ) as new_rank
    from public.teams
    where is_approved = true
  loop
    update public.teams
      set season_stats = jsonb_set(
        coalesce(season_stats::jsonb, '{}'::jsonb),
        '{rank}',
        to_jsonb(r.new_rank),
        true
      )
    where id = r.id;
  end loop;
end;
$$;

create or replace function public.start_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  m public.matches%rowtype;
begin
  if not public.is_referee_or_admin() then
    raise exception 'only referee/admin may start a match' using errcode = '42501';
  end if;

  select * into m from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'match % not found', p_match_id;
  end if;
  if m.stats_applied or m.status = 'finished' then
    raise exception 'match % already finalized', p_match_id;
  end if;

  update public.matches set
    status = 'live',
    current_half = 1,
    elapsed_seconds = case when m.status = 'live' then elapsed_seconds else 0 end,
    is_running = true
  where id = p_match_id;
end;
$$;

create or replace function public.pause_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  m public.matches%rowtype;
begin
  if not public.is_referee_or_admin() then
    raise exception 'only referee/admin may pause a match' using errcode = '42501';
  end if;

  select * into m from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'match % not found', p_match_id;
  end if;
  if m.status <> 'live' or m.stats_applied then
    raise exception 'match % is not live', p_match_id;
  end if;

  update public.matches set is_running = false where id = p_match_id;
end;
$$;

create or replace function public.resume_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  m public.matches%rowtype;
begin
  if not public.is_referee_or_admin() then
    raise exception 'only referee/admin may resume a match' using errcode = '42501';
  end if;

  select * into m from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'match % not found', p_match_id;
  end if;
  if m.status <> 'live' or m.stats_applied then
    raise exception 'match % is not live', p_match_id;
  end if;

  update public.matches set is_running = true where id = p_match_id;
end;
$$;

create or replace function public.update_match_timer(
  p_match_id uuid,
  p_elapsed_seconds integer,
  p_current_half integer default 1
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  m public.matches%rowtype;
begin
  if not public.is_referee_or_admin() then
    raise exception 'only referee/admin may update match timer' using errcode = '42501';
  end if;

  select * into m from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'match % not found', p_match_id;
  end if;
  if m.status <> 'live' or m.stats_applied then
    raise exception 'match % is not live', p_match_id;
  end if;

  update public.matches set
    elapsed_seconds = least(720, greatest(0, coalesce(p_elapsed_seconds, 0))),
    current_half = greatest(1, least(2, coalesce(p_current_half, 1)))
  where id = p_match_id;
end;
$$;

create or replace function public.end_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  m public.matches%rowtype;
  r record;
  has_lineup boolean;
  team_record record;
  prev_match_id uuid;
  current_player uuid;
  home_points integer;
  away_points integer;
  home_wins integer;
  away_wins integer;
  home_draws integer;
  away_draws integer;
  home_losses integer;
  away_losses integer;
begin
  if not public.is_referee_or_admin() then
    raise exception 'only referee/admin may end a match' using errcode = '42501';
  end if;

  select * into m from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'match % not found', p_match_id;
  end if;
  if m.stats_applied or m.status = 'finished' then
    return;
  end if;
  if m.status <> 'live' then
    raise exception 'match % must be live before finalization', p_match_id;
  end if;

  perform set_config('app.in_end_match', '1', true);

  select exists(select 1 from public.match_lineups where match_id = p_match_id) into has_lineup;

  if has_lineup then
    for r in
      select ml.player_id,
             coalesce(stat.g, 0) as g,
             coalesce(stat.a, 0) as a,
             coalesce(stat.y, 0) as y,
             (m.mom_player_id is not null and m.mom_player_id = ml.player_id) as got_mom
      from public.match_lineups ml
      left join (
        select e.player_id,
               count(*) filter (where e.type = 'goal')        as g,
               count(*) filter (where e.type = 'assist')      as a,
               count(*) filter (where e.type = 'yellow_card') as y
        from public.match_events e
        where e.match_id = p_match_id and not e.is_cancelled and e.player_id is not null
        group by e.player_id
      ) stat on stat.player_id = ml.player_id
      where ml.match_id = p_match_id
    loop
      update public.profiles set
        games = games + 1,
        goals = goals + r.g,
        assists = assists + r.a,
        mom = mom + (case when r.got_mom then 1 else 0 end),
        card_rating = public.compute_card_rating(
          goals + r.g,
          assists + r.a,
          mom + (case when r.got_mom then 1 else 0 end)
        ),
        season_yellow_cards = season_yellow_cards + r.y
      where id = r.player_id;
    end loop;

    if m.tournament_id is not null then
      for team_record in
        select unnest(array[m.home_team_id, m.away_team_id]) as team_id
      loop
        if team_record.team_id is null then continue; end if;

        select id into prev_match_id from public.matches
          where tournament_id = m.tournament_id
            and (home_team_id = team_record.team_id or away_team_id = team_record.team_id)
            and status = 'finished'
            and id <> p_match_id
          order by created_at desc
          limit 1;

        if prev_match_id is not null then
          for current_player in
            select player_id from public.match_lineups
            where match_id = prev_match_id and team_id = team_record.team_id
              and player_id not in (
                select player_id from public.match_lineups
                where match_id = p_match_id and team_id = team_record.team_id
              )
          loop
            update public.profiles set attendance_streak = 0
            where id = current_player and attendance_streak > 0;
          end loop;
        end if;

        for current_player in
          select player_id from public.match_lineups
          where match_id = p_match_id and team_id = team_record.team_id
        loop
          update public.profiles set
            attendance_streak = attendance_streak + 1,
            attendance_streak_best = greatest(attendance_streak_best, attendance_streak + 1)
          where id = current_player;
        end loop;
      end loop;
    end if;
  else
    for r in
      select e.player_id,
             count(*) filter (where e.type = 'goal')        as g,
             count(*) filter (where e.type = 'assist')      as a,
             count(*) filter (where e.type = 'yellow_card') as y,
             bool_or(e.player_id = m.mom_player_id) as got_mom
      from public.match_events e
      where e.match_id = p_match_id and not e.is_cancelled and e.player_id is not null
      group by e.player_id
    loop
      update public.profiles set
        games = games + 1,
        goals = goals + r.g,
        assists = assists + r.a,
        mom = mom + (case when r.got_mom then 1 else 0 end),
        card_rating = public.compute_card_rating(
          goals + r.g,
          assists + r.a,
          mom + (case when r.got_mom then 1 else 0 end)
        ),
        season_yellow_cards = season_yellow_cards + r.y
      where id = r.player_id;
    end loop;
  end if;

  home_points := case
    when m.home_score > m.away_score then 3
    when m.home_score = m.away_score then 1
    else 0
  end;
  away_points := case
    when m.away_score > m.home_score then 3
    when m.away_score = m.home_score then 1
    else 0
  end;
  home_wins := case when m.home_score > m.away_score then 1 else 0 end;
  away_wins := case when m.away_score > m.home_score then 1 else 0 end;
  home_draws := case when m.home_score = m.away_score then 1 else 0 end;
  away_draws := home_draws;
  home_losses := case when m.home_score < m.away_score then 1 else 0 end;
  away_losses := case when m.away_score < m.home_score then 1 else 0 end;

  if m.home_team_id is not null then
    update public.teams set
      season_stats = public.team_stats_with_result(
        coalesce(season_stats::jsonb, '{}'::jsonb),
        home_points,
        home_wins,
        home_draws,
        home_losses,
        m.home_score,
        m.away_score
      )
    where id = m.home_team_id;
  end if;

  if m.away_team_id is not null then
    update public.teams set
      season_stats = public.team_stats_with_result(
        coalesce(season_stats::jsonb, '{}'::jsonb),
        away_points,
        away_wins,
        away_draws,
        away_losses,
        m.away_score,
        m.home_score
      )
    where id = m.away_team_id;
  end if;

  for current_player in
    select distinct e.player_id
    from public.match_events e
    where e.match_id = p_match_id and not e.is_cancelled
      and e.type = 'red_card' and e.player_id is not null
  loop
    update public.profiles set
      ban_matches_remaining = ban_matches_remaining + 2,
      is_banned = true
    where id = current_player;
  end loop;

  for current_player in
    select distinct e.player_id
    from public.match_events e
    where e.match_id = p_match_id and not e.is_cancelled
      and e.type = 'yellow_card' and e.player_id is not null
  loop
    update public.profiles set
      ban_matches_remaining = ban_matches_remaining + (season_yellow_cards / 5),
      is_banned = case when (ban_matches_remaining + (season_yellow_cards / 5)) > 0 then true else is_banned end,
      season_yellow_cards = season_yellow_cards % 5
    where id = current_player and season_yellow_cards >= 5;
  end loop;

  if has_lineup then
    for current_player in
      select p.id from public.profiles p
      where p.team_id in (m.home_team_id, m.away_team_id)
        and p.ban_matches_remaining > 0
        and p.id not in (select player_id from public.match_lineups where match_id = p_match_id)
    loop
      update public.profiles set
        ban_matches_remaining = greatest(0, ban_matches_remaining - 1),
        is_banned = (ban_matches_remaining - 1) > 0
      where id = current_player;
    end loop;
  end if;

  update public.matches set
    status = 'finished',
    is_running = false,
    stats_applied = true
  where id = p_match_id;

  perform public.recompute_team_ranks();
end;
$$;

create or replace function public.forfeit_match(
  p_match_id uuid,
  p_forfeit_team_id uuid
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  m public.matches%rowtype;
  v_home_score integer;
  v_away_score integer;
begin
  if not public.is_referee_or_admin() then
    raise exception 'only referee/admin may forfeit a match' using errcode = '42501';
  end if;

  select * into m from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'match % not found', p_match_id;
  end if;
  if p_forfeit_team_id <> m.home_team_id and p_forfeit_team_id <> m.away_team_id then
    raise exception 'forfeit team % not in match %', p_forfeit_team_id, p_match_id;
  end if;
  if m.stats_applied or m.status = 'finished' then
    raise exception 'match % already finalized', p_match_id;
  end if;

  perform set_config('app.in_end_match', '1', true);

  v_home_score := case when m.home_team_id = p_forfeit_team_id then 0 else 3 end;
  v_away_score := case when m.away_team_id = p_forfeit_team_id then 0 else 3 end;

  if m.home_team_id is not null then
    update public.teams set
      season_stats = public.team_stats_with_result(
        coalesce(season_stats::jsonb, '{}'::jsonb),
        case when v_home_score > v_away_score then 3 else 0 end,
        case when v_home_score > v_away_score then 1 else 0 end,
        0,
        case when v_home_score < v_away_score then 1 else 0 end,
        v_home_score,
        v_away_score
      )
    where id = m.home_team_id;
  end if;

  if m.away_team_id is not null then
    update public.teams set
      season_stats = public.team_stats_with_result(
        coalesce(season_stats::jsonb, '{}'::jsonb),
        case when v_away_score > v_home_score then 3 else 0 end,
        case when v_away_score > v_home_score then 1 else 0 end,
        0,
        case when v_away_score < v_home_score then 1 else 0 end,
        v_away_score,
        v_home_score
      )
    where id = m.away_team_id;
  end if;

  update public.matches set
    home_score = v_home_score,
    away_score = v_away_score,
    status = 'finished',
    is_running = false,
    stats_applied = true
  where id = p_match_id;

  perform public.recompute_team_ranks();
end;
$$;

grant execute on function public.compute_card_rating(integer, integer, integer) to authenticated;
grant execute on function public.start_match(uuid) to authenticated;
grant execute on function public.pause_match(uuid) to authenticated;
grant execute on function public.resume_match(uuid) to authenticated;
grant execute on function public.update_match_timer(uuid, integer, integer) to authenticated;
grant execute on function public.end_match(uuid) to authenticated;
grant execute on function public.forfeit_match(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
