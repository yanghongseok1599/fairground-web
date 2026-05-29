-- 경기중(live) 선수 교체 RPC
-- 배경: match_lineups RLS 가 match_is_open()(status='scheduled')로 경기중 쓰기를 막는다.
-- 감독이 경기 중 교체를 등록하려면 RLS 를 우회하되, 함수 내부에서 권한·상태·선발/벤치를 검증한다.
-- 트리거 enforce_lineup_constraints 는 SECURITY DEFINER 로도 그대로 실행되므로
-- OUT 을 먼저 선발 해제(선발수 5→4) 후 IN 을 선발 등록해 선발 5 제한을 통과한다.

create or replace function public.substitute_player(
  p_match_id uuid,
  p_team_id uuid,
  p_out_player_id uuid,
  p_in_player_id uuid,
  p_in_player_name text default '',
  p_minute int default 0,
  p_half int default 1
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_status text;
begin
  -- 권한: 해당 팀 스태프 또는 admin
  if not is_team_staff(p_team_id) then
    raise exception 'not authorized for team %', p_team_id using errcode = '42501';
  end if;

  -- 팀이 매치 소속이며 경기 진행중(live)인지
  select status::text into v_status from matches
    where id = p_match_id and (home_team_id = p_team_id or away_team_id = p_team_id);
  if v_status is null then
    raise exception 'team % is not part of match %', p_team_id, p_match_id;
  end if;
  if v_status <> 'live' then
    raise exception 'match % is not live (status=%)', p_match_id, v_status;
  end if;

  if p_out_player_id = p_in_player_id then
    raise exception 'out and in player are the same';
  end if;

  -- OUT 은 현재 선발이어야 함
  if not exists (
    select 1 from match_lineups
    where match_id = p_match_id and team_id = p_team_id
      and player_id = p_out_player_id and is_starter = true
  ) then
    raise exception 'out player % is not a starter', p_out_player_id;
  end if;

  -- IN 은 라인업(벤치, is_starter=false)에 있어야 함
  if not exists (
    select 1 from match_lineups
    where match_id = p_match_id and team_id = p_team_id
      and player_id = p_in_player_id and is_starter = false
  ) then
    raise exception 'in player % is not on the bench', p_in_player_id;
  end if;

  -- 교체: OUT 먼저 내려 선발수를 줄인 뒤 IN 을 올린다 (트리거 선발5 제한 통과)
  update match_lineups set is_starter = false
    where match_id = p_match_id and team_id = p_team_id and player_id = p_out_player_id;
  update match_lineups set is_starter = true
    where match_id = p_match_id and team_id = p_team_id and player_id = p_in_player_id;

  -- 교체 이벤트 기록 (IN 선수 기준)
  insert into match_events (match_id, type, player_id, player_name, team_id, minute, half)
  values (p_match_id, 'substitution', p_in_player_id, coalesce(p_in_player_name, ''), p_team_id,
          coalesce(p_minute, 0), coalesce(p_half, 1));
end $$;

grant execute on function public.substitute_player(uuid, uuid, uuid, uuid, text, int, int) to authenticated;
