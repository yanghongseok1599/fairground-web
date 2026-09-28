-- Reviewed against a fresh production schema restored locally on 2026-09-28.
-- No existing member, score, event, or migration-history rows are rewritten.
-- bigint COUNT results must match the integer compute_card_rating signature.
-- Source linkage only applies to automatic red cards created after this migration.
alter table public.match_events
  add column source_yellow_event_id uuid references public.match_events(id);

CREATE OR REPLACE FUNCTION public.end_match(p_match_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
               (count(*) filter (where e.type = 'goal'))::integer        as g,
               (count(*) filter (where e.type = 'assist'))::integer      as a,
               (count(*) filter (where e.type = 'yellow_card'))::integer as y
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
      select participants.player_id,
             (count(*) filter (where e.type = 'goal'))::integer as g,
             (count(*) filter (where e.type = 'assist'))::integer as a,
             (count(*) filter (where e.type = 'yellow_card'))::integer as y,
             coalesce(participants.player_id = m.mom_player_id, false) as got_mom
      from (
        select player_id from public.match_events
        where match_id = p_match_id and not is_cancelled and player_id is not null
        union
        select m.mom_player_id where m.mom_player_id is not null
      ) participants
      left join public.match_events e
        on e.match_id = p_match_id and e.player_id = participants.player_id and not e.is_cancelled
      group by participants.player_id
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
$function$;

CREATE OR REPLACE FUNCTION public.add_match_event(p_match_id uuid, p_type match_event_t, p_player_id uuid DEFAULT NULL::uuid, p_player_name text DEFAULT ''::text, p_team_id uuid DEFAULT NULL::uuid, p_minute integer DEFAULT 0, p_half integer DEFAULT 1)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  m matches%rowtype;
  v_event_id uuid;
  v_has_lineup boolean;
  v_player_name text;
  v_yellow_count int;
  v_minute int;
  v_half int;
begin
  if not is_referee_or_admin() then
    raise exception 'only referee/admin may add match events' using errcode = '42501';
  end if;

  select * into m from matches where id = p_match_id for update;
  if not found then
    raise exception 'match % not found', p_match_id;
  end if;
  if m.status <> 'live' or m.stats_applied then
    raise exception 'match % is not editable (status=%)', p_match_id, m.status;
  end if;

  if p_team_id is null or (p_team_id <> m.home_team_id and p_team_id <> m.away_team_id) then
    raise exception 'team % is not part of match %', p_team_id, p_match_id;
  end if;

  if p_player_id is null then
    raise exception 'player is required for match event';
  end if;

  perform assert_player_is_eligible(p_player_id);

  select exists(select 1 from match_lineups where match_id = p_match_id) into v_has_lineup;
  if v_has_lineup then
    if not exists (
      select 1 from match_lineups
      where match_id = p_match_id
        and team_id = p_team_id
        and player_id = p_player_id
    ) then
      raise exception 'player % is not in match lineup for team %', p_player_id, p_team_id;
    end if;
  elsif not exists (
    select 1 from profiles
    where id = p_player_id
      and team_id = p_team_id
  ) then
    raise exception 'player % is not a member of team %', p_player_id, p_team_id;
  end if;

  v_player_name := nullif(trim(coalesce(p_player_name, '')), '');
  if v_player_name is null then
    select name into v_player_name from profiles where id = p_player_id;
  end if;

  v_minute := greatest(0, coalesce(p_minute, 0));
  v_half := greatest(1, least(2, coalesce(p_half, 1)));

  insert into match_events (match_id, type, player_id, player_name, team_id, minute, half)
  values (p_match_id, p_type, p_player_id, coalesce(v_player_name, ''), p_team_id, v_minute, v_half)
  returning id into v_event_id;

  if p_type = 'goal'::match_event_t then
    update matches set
      home_score = case when p_team_id = home_team_id then coalesce(home_score, 0) + 1 else home_score end,
      away_score = case when p_team_id = away_team_id then coalesce(away_score, 0) + 1 else away_score end
    where id = p_match_id;
  end if;

  if p_type = 'yellow_card'::match_event_t then
    select count(*) into v_yellow_count
    from match_events
    where match_id = p_match_id
      and player_id = p_player_id
      and type = 'yellow_card'::match_event_t
      and not is_cancelled;

    if v_yellow_count >= 2 and not exists (
      select 1 from match_events
      where match_id = p_match_id
        and player_id = p_player_id
        and type = 'red_card'::match_event_t
        and not is_cancelled
    ) then
      insert into match_events (match_id, type, player_id, player_name, team_id, minute, half, source_yellow_event_id)
      values (p_match_id, 'red_card'::match_event_t, p_player_id, coalesce(v_player_name, ''), p_team_id, v_minute, v_half, v_event_id);
    end if;
  end if;

  return v_event_id;
end $function$;

CREATE OR REPLACE FUNCTION public.cancel_match_event(p_match_id uuid, p_event_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  m matches%rowtype;
  evt match_events%rowtype;
begin
  if not is_referee_or_admin() then
    raise exception 'only referee/admin may cancel match events' using errcode = '42501';
  end if;

  select * into m from matches where id = p_match_id for update;
  if not found then
    raise exception 'match % not found', p_match_id;
  end if;
  if m.status <> 'live' or m.stats_applied then
    raise exception 'match % is not editable (status=%)', p_match_id, m.status;
  end if;

  select * into evt
  from match_events
  where id = p_event_id and match_id = p_match_id
  for update;

  if not found or evt.is_cancelled then
    return;
  end if;

  update match_events set is_cancelled = true where id = p_event_id;

  -- Only reverse expulsions linked to a second yellow; a direct red stays valid.
  if evt.type = 'yellow_card'::match_event_t and (
    select count(*) from match_events
    where match_id = p_match_id and player_id = evt.player_id
      and type = 'yellow_card'::match_event_t and not is_cancelled
  ) < 2 then
    update match_events set is_cancelled = true
    where match_id = p_match_id and player_id = evt.player_id
      and type = 'red_card'::match_event_t and not is_cancelled
      and source_yellow_event_id is not null;
  end if;

  if evt.type = 'goal'::match_event_t then
    update matches set
      home_score = case when evt.team_id = home_team_id then greatest(0, coalesce(home_score, 0) - 1) else home_score end,
      away_score = case when evt.team_id = away_team_id then greatest(0, coalesce(away_score, 0) - 1) else away_score end
    where id = p_match_id;
  end if;
end $function$;
