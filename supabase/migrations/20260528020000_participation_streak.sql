-- 승강 모델 재설계 — "3 크레딧 자동승급" 폐기 → 성적(상위2/하위2) 단일 트랙 +
-- 연속참여 보너스 승점.
--
-- 연속참여 보너스: streak 2회=+1, 3회=+2, 4회=+3 (최대 3점, min(streak-1,3)).
--   보너스는 시즌 순위표 승점에 가산(클라이언트 계산), 시즌 종료 시 리셋.
-- streak 리셋: 승급 시 / 불참(연속 끊김) 시.
-- 승급: 시즌 종료 시 리그 상위 2팀(운영자 정산) → 한 단계 위 + streak 0.
-- 강등: 하위 2팀 → 한 단계 아래.

-- promotion_credits → participation_streak (0–4) 로 rename + 범위 확대.
alter table public.teams drop constraint if exists teams_promotion_credits_check;
alter table public.teams rename column promotion_credits to participation_streak;
alter table public.teams
  add constraint teams_participation_streak_check
  check (participation_streak >= 0 and participation_streak <= 4);

-- 기존 자동승급 함수 제거.
drop function if exists public.award_participation_credit(uuid);

-- 대회 참가 기록 — 연속 streak +1 (최대 4). 자동승급 없음. admin 전용.
create or replace function public.record_participation(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.role = 'admin'
  ) then
    raise exception 'not authorized';
  end if;

  update public.teams
    set participation_streak = least(participation_streak + 1, 4)
    where id = p_team_id;
end;
$$;

-- 연속 끊김(불참) — streak 0 리셋. admin 전용.
create or replace function public.reset_participation_streak(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.role = 'admin'
  ) then
    raise exception 'not authorized';
  end if;

  update public.teams set participation_streak = 0 where id = p_team_id;
end;
$$;

-- 승급 — 한 단계 위(premium 은 유지) + streak 0 리셋. 시즌 상위 2팀 정산용. admin.
create or replace function public.promote_team(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier league_tier_t;
  v_next league_tier_t;
begin
  if not exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.role = 'admin'
  ) then
    raise exception 'not authorized';
  end if;

  select league_tier into v_tier from public.teams where id = p_team_id for update;
  if v_tier is null then
    raise exception 'team not found';
  end if;

  v_next := case v_tier
    when 'bronze' then 'silver'
    when 'silver' then 'gold'
    when 'gold' then 'premium'
    else 'premium'
  end;

  update public.teams
    set league_tier = v_next, participation_streak = 0
    where id = p_team_id;
end;
$$;

-- 강등 — 한 단계 아래(bronze 는 유지). 시즌 하위 2팀 정산용. (streak 는 유지)
create or replace function public.relegate_team(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier league_tier_t;
  v_prev league_tier_t;
begin
  if not exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.role = 'admin'
  ) then
    raise exception 'not authorized';
  end if;

  select league_tier into v_tier from public.teams where id = p_team_id for update;
  if v_tier is null then
    raise exception 'team not found';
  end if;

  v_prev := case v_tier
    when 'premium' then 'gold'
    when 'gold' then 'silver'
    when 'silver' then 'bronze'
    else 'bronze'
  end;

  update public.teams set league_tier = v_prev where id = p_team_id;
end;
$$;

grant execute on function public.record_participation(uuid) to authenticated;
grant execute on function public.reset_participation_streak(uuid) to authenticated;
grant execute on function public.promote_team(uuid) to authenticated;
grant execute on function public.relegate_team(uuid) to authenticated;
notify pgrst, 'reload schema';
