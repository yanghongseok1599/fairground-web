-- 징계 자동화 — 공식 규정 v2.4 제12조 / 대회규정 v1.2 제8·9조 동기화.
--  (1) 레드카드(퇴장) → 이후 2경기 출장정지
--  (2) 누적 경고 5회마다 1경기 출장정지 + 누적 초기화(제12조⑦)
--  (3) 출장정지 소비: 팀이 경기를 치르고 해당 선수가 결장하면 잔여 -1
--  (4) forfeit_match: 몰수패 공식 기록 3:0 (제13조 / 대회규정 제9조)
-- end_match 는 기존 통계·streak 로직을 보존하고 징계 블록만 추가한다.

CREATE OR REPLACE FUNCTION public.end_match(p_match_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  m matches%rowtype;
  r record;
  has_lineup boolean;
  team_record record;
  prev_match_id uuid;
  current_player uuid;
begin
  if not is_referee_or_admin() then
    raise exception 'only referee/admin may end a match';
  end if;
  select * into m from matches where id = p_match_id for update;
  if not found then
    raise exception 'match % not found', p_match_id;
  end if;
  if m.stats_applied or m.status = 'finished' then
    return;
  end if;

  perform set_config('app.in_end_match', '1', true);

  select exists(select 1 from match_lineups where match_id = p_match_id) into has_lineup;

  if has_lineup then
    -- 통계 누적 (라인업 기반)
    for r in
      select ml.player_id,
             coalesce(stat.g, 0) as g,
             coalesce(stat.a, 0) as a,
             coalesce(stat.y, 0) as y,
             (m.mom_player_id is not null and m.mom_player_id = ml.player_id) as got_mom
      from match_lineups ml
      left join (
        select e.player_id,
               count(*) filter (where e.type = 'goal')        as g,
               count(*) filter (where e.type = 'assist')      as a,
               count(*) filter (where e.type = 'yellow_card') as y
        from match_events e
        where e.match_id = p_match_id and not e.is_cancelled and e.player_id is not null
        group by e.player_id
      ) stat on stat.player_id = ml.player_id
      where ml.match_id = p_match_id
    loop
      update profiles set
        games = games + 1,
        goals = goals + r.g,
        assists = assists + r.a,
        mom = mom + (case when r.got_mom then 1 else 0 end),
        season_yellow_cards = season_yellow_cards + r.y
      where id = r.player_id;
    end loop;

    -- streak 갱신 (각 팀별)
    if m.tournament_id is not null then
      for team_record in
        select unnest(array[m.home_team_id, m.away_team_id]) as team_id
      loop
        if team_record.team_id is null then continue; end if;

        select id into prev_match_id from matches
          where tournament_id = m.tournament_id
            and (home_team_id = team_record.team_id or away_team_id = team_record.team_id)
            and status = 'finished'
            and id <> p_match_id
          order by created_at desc
          limit 1;

        if prev_match_id is not null then
          for current_player in
            select player_id from match_lineups
            where match_id = prev_match_id and team_id = team_record.team_id
              and player_id not in (
                select player_id from match_lineups
                where match_id = p_match_id and team_id = team_record.team_id
              )
          loop
            update profiles set attendance_streak = 0
            where id = current_player and attendance_streak > 0;
          end loop;
        end if;

        for current_player in
          select player_id from match_lineups
          where match_id = p_match_id and team_id = team_record.team_id
        loop
          update profiles set
            attendance_streak = attendance_streak + 1,
            attendance_streak_best = greatest(attendance_streak_best, attendance_streak + 1)
          where id = current_player;
        end loop;
      end loop;
    end if;
  else
    -- 라인업 없는 legacy 흐름 (streak 미갱신)
    for r in
      select e.player_id,
             count(*) filter (where e.type = 'goal')        as g,
             count(*) filter (where e.type = 'assist')      as a,
             count(*) filter (where e.type = 'yellow_card') as y,
             bool_or(e.player_id = m.mom_player_id) as got_mom
      from match_events e
      where e.match_id = p_match_id and not e.is_cancelled and e.player_id is not null
      group by e.player_id
    loop
      update profiles set
        games = games + 1,
        goals = goals + r.g,
        assists = assists + r.a,
        mom = mom + (case when r.got_mom then 1 else 0 end),
        season_yellow_cards = season_yellow_cards + r.y
      where id = r.player_id;
    end loop;
  end if;

  -- ===== 징계 자동화 (규정 제12조 / 대회규정 제8조) =====

  -- (1) 레드카드(퇴장) → 이후 2경기 출장정지
  for current_player in
    select distinct e.player_id
    from match_events e
    where e.match_id = p_match_id and not e.is_cancelled
      and e.type = 'red_card' and e.player_id is not null
  loop
    update profiles set
      ban_matches_remaining = ban_matches_remaining + 2,
      is_banned = true
    where id = current_player;
  end loop;

  -- (2) 누적 경고 5회마다 1경기 출장정지 + 누적 초기화(제12조⑦)
  for current_player in
    select distinct e.player_id
    from match_events e
    where e.match_id = p_match_id and not e.is_cancelled
      and e.type = 'yellow_card' and e.player_id is not null
  loop
    update profiles set
      ban_matches_remaining = ban_matches_remaining + (season_yellow_cards / 5),
      is_banned = case when (ban_matches_remaining + (season_yellow_cards / 5)) > 0 then true else is_banned end,
      season_yellow_cards = season_yellow_cards % 5
    where id = current_player and season_yellow_cards >= 5;
  end loop;

  -- (3) 출장정지 소비: 이번 경기 팀 소속이나 라인업에 없던(결장) 출장정지 선수 → 잔여 -1
  --     라인업 제출 경기에서만 적용(legacy 무라인업 경기는 결장 판별 불가).
  if has_lineup then
    for current_player in
      select p.id from profiles p
      where p.team_id in (m.home_team_id, m.away_team_id)
        and p.ban_matches_remaining > 0
        and p.id not in (select player_id from match_lineups where match_id = p_match_id)
    loop
      update profiles set
        ban_matches_remaining = greatest(0, ban_matches_remaining - 1),
        is_banned = (ban_matches_remaining - 1) > 0
      where id = current_player;
    end loop;
  end if;

  update matches set
    status = 'finished',
    is_running = false,
    stats_applied = true
  where id = p_match_id;
end $function$;

-- 몰수패 처리 — 공식 기록 3:0 (몰수 팀 0, 상대 3). 개인 통계는 누적하지 않는다.
CREATE OR REPLACE FUNCTION public.forfeit_match(p_match_id uuid, p_forfeit_team_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  m matches%rowtype;
begin
  if not is_referee_or_admin() then
    raise exception 'only referee/admin may forfeit a match';
  end if;
  select * into m from matches where id = p_match_id for update;
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

  update matches set
    home_score = case when home_team_id = p_forfeit_team_id then 0 else 3 end,
    away_score = case when away_team_id = p_forfeit_team_id then 0 else 3 end,
    status = 'finished',
    is_running = false,
    stats_applied = true
  where id = p_match_id;
end $function$;

GRANT EXECUTE ON FUNCTION public.forfeit_match(uuid, uuid) TO authenticated;
