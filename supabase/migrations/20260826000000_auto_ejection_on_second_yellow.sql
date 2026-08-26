-- 규정 제12조③ — 동일 경기 내 경고 2회 누적 시 자동 퇴장.
--
-- 이 판정을 클라이언트(useMatchControl.addEvent)에서 하면 안 된다.
-- 클라이언트는 방금 넣은 경고가 realtime 으로 자기 목록에 이미 반영됐는지
-- 알 수 없어서, "기존 경고 수 + 1" 로 세면 realtime 이 먼저 도착한 경우
-- 첫 경고에서도 2회로 오판해 즉시 퇴장시킨다.
--
-- add_match_event 는 이미 matches 행을 for update 로 잠그고 있으므로,
-- 같은 트랜잭션에서 방금 삽입한 경고까지 포함해 세면 경합 없이 정확하다.
-- 심판이 어느 기기에서 기록하든 동일하게 적용된다.

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

  -- 제12조③ 자동 퇴장. 방금 삽입한 경고가 아래 count 에 포함된다.
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
      insert into match_events (match_id, type, player_id, player_name, team_id, minute, half)
      values (p_match_id, 'red_card'::match_event_t, p_player_id, coalesce(v_player_name, ''), p_team_id, v_minute, v_half);
    end if;
  end if;

  return v_event_id;
end $$;

grant execute on function public.add_match_event(uuid, match_event_t, uuid, text, uuid, int, int) to authenticated;
