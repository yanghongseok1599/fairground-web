-- 규정 제22조 — 선출(중등부 이상 선수 등록 이력자, K리그/WK리그/FK리그/WFK리그
-- 활동 이력자)은 본 대회에 출전할 수 없다.
--
-- profiles.has_player_experience 를 '선출 여부' 플래그로 사용한다.
-- 자기신고 + 운영진의 JOIN KFA 확인으로 채워지며, true 인 선수는
--   1) 출전 명단(match_lineups)에 올릴 수 없고
--   2) 경기 이벤트(득점·경고 등) 기록 대상이 될 수 없다.
-- 클라이언트 필터만으로는 우회가 가능하므로 DB 에서 강제한다.

-- 1) 운영진이 선출 여부를 지정하는 RPC. 자기신고만으로는 걸러지지 않으므로
--    JOIN KFA 확인 결과를 운영진이 반영할 수 있어야 한다.
create or replace function public.set_player_eligibility(
  p_player_id uuid,
  p_is_registered_player boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role public.player_role_t;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다';
  end if;

  select role into v_actor_role from public.profiles where id = auth.uid();
  if v_actor_role <> 'admin' then
    raise exception '참가 자격 변경 권한이 없습니다';
  end if;

  update public.profiles
    set has_player_experience = coalesce(p_is_registered_player, false)
    where id = p_player_id;

  if not found then
    raise exception '대상 선수를 찾을 수 없습니다';
  end if;
end;
$$;

revoke all on function public.set_player_eligibility(uuid, boolean) from public;
grant execute on function public.set_player_eligibility(uuid, boolean) to authenticated;

-- 2) 출전 명단 등재 차단.
create or replace function public.reject_registered_player_lineup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  select name into v_name
  from public.profiles
  where id = new.player_id and has_player_experience;

  if found then
    raise exception '% 선수는 선출로 등록되어 있어 출전할 수 없습니다 (규정 제22조)', coalesce(v_name, '해당');
  end if;

  return new;
end;
$$;

drop trigger if exists trg_reject_registered_player_lineup on public.match_lineups;
create trigger trg_reject_registered_player_lineup
  before insert or update on public.match_lineups
  for each row execute function public.reject_registered_player_lineup();

-- 3) 경기 이벤트 기록 차단. 출전 명단 없이 운영하는 경기도 있으므로
--    이벤트 단계에서도 한 번 더 막는다.
create or replace function public.assert_player_is_eligible(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  select name into v_name
  from public.profiles
  where id = p_player_id and has_player_experience;

  if found then
    raise exception '% 선수는 선출로 등록되어 있어 출전할 수 없습니다 (규정 제22조)', coalesce(v_name, '해당');
  end if;
end;
$$;

-- add_match_event 에 자격 검사를 끼워 넣는다. 나머지 동작(골 점수 반영,
-- 라인업 검증, 경고 2회 자동 퇴장)은 20260826000000 과 동일하다.
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
