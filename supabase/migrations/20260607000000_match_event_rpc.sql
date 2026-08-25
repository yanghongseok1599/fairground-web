-- Atomic live match event operations.
-- Event rows and score mutations must stay in the same transaction during live use.

create or replace function public.add_match_event(
  p_match_id uuid,
  p_type match_event_t,
  p_player_id uuid default null,
  p_player_name text default '',
  p_team_id uuid default null,
  p_minute int default 0,
  p_half int default 1
) returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  m matches%rowtype;
  v_event_id uuid;
  v_has_lineup boolean;
  v_player_name text;
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

  insert into match_events (match_id, type, player_id, player_name, team_id, minute, half)
  values (
    p_match_id,
    p_type,
    p_player_id,
    coalesce(v_player_name, ''),
    p_team_id,
    greatest(0, coalesce(p_minute, 0)),
    greatest(1, least(2, coalesce(p_half, 1)))
  )
  returning id into v_event_id;

  if p_type = 'goal'::match_event_t then
    update matches set
      home_score = case when p_team_id = home_team_id then coalesce(home_score, 0) + 1 else home_score end,
      away_score = case when p_team_id = away_team_id then coalesce(away_score, 0) + 1 else away_score end
    where id = p_match_id;
  end if;

  return v_event_id;
end $$;

grant execute on function public.add_match_event(uuid, match_event_t, uuid, text, uuid, int, int) to authenticated;

create or replace function public.cancel_match_event(
  p_match_id uuid,
  p_event_id uuid
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
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

  if evt.type = 'goal'::match_event_t then
    update matches set
      home_score = case when evt.team_id = home_team_id then greatest(0, coalesce(home_score, 0) - 1) else home_score end,
      away_score = case when evt.team_id = away_team_id then greatest(0, coalesce(away_score, 0) - 1) else away_score end
    where id = p_match_id;
  end if;
end $$;

grant execute on function public.cancel_match_event(uuid, uuid) to authenticated;

create or replace function public.set_match_mom(
  p_match_id uuid,
  p_player_id uuid
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  m matches%rowtype;
  v_has_lineup boolean;
begin
  if not is_referee_or_admin() then
    raise exception 'only referee/admin may set match MOM' using errcode = '42501';
  end if;

  select * into m from matches where id = p_match_id for update;
  if not found then
    raise exception 'match % not found', p_match_id;
  end if;
  if m.status <> 'live' or m.stats_applied then
    raise exception 'match % is not editable (status=%)', p_match_id, m.status;
  end if;

  select exists(select 1 from match_lineups where match_id = p_match_id) into v_has_lineup;
  if v_has_lineup then
    if not exists (
      select 1 from match_lineups
      where match_id = p_match_id
        and player_id = p_player_id
        and team_id in (m.home_team_id, m.away_team_id)
    ) then
      raise exception 'player % is not in match lineup', p_player_id;
    end if;
  elsif not exists (
    select 1 from profiles
    where id = p_player_id
      and team_id in (m.home_team_id, m.away_team_id)
  ) then
    raise exception 'player % is not part of match teams', p_player_id;
  end if;

  update matches set mom_player_id = p_player_id where id = p_match_id;
end $$;

grant execute on function public.set_match_mom(uuid, uuid) to authenticated;
