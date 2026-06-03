-- 리그 승강 시스템 (꾸준한 참가 → 승업 / 성적 하위 → 강등).
--
-- 2단계 리그(upper/lower), 운영자 수동 운영. 총 6팀 미만이면 분리 없이 단일
-- 통합 대회로 진행(이 경우 tier 구분은 표시상 의미 없음, 크레딧은 계속 누적).
--
-- 승업: 대회(시즌) 완료 = promotion_credits +1. 3 도달 시 upper 로 승급 + 0 리셋.
-- 강등: 시즌 종료 시 소속 리그 최하위 2팀 → lower 로. (운영자 정산)

do $$
begin
  if not exists (select 1 from pg_type where typname = 'league_tier_t') then
    create type league_tier_t as enum ('upper', 'lower');
  end if;
end$$;

alter table public.teams
  add column if not exists league_tier league_tier_t not null default 'lower';

alter table public.teams
  add column if not exists promotion_credits integer not null default 0
    check (promotion_credits >= 0 and promotion_credits <= 2);

-- 참가 크레딧 적립 RPC — 시즌 완료 팀에 +1. 3 도달 시 upper 승급 후 0 으로.
-- 디렉터/admin 권한은 호출 측(RLS·UI)에서 통제. SECURITY DEFINER 로 일관 처리.
create or replace function public.award_participation_credit(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credits integer;
  v_tier league_tier_t;
begin
  -- 호출자 권한: league admin 만 정산 가능.
  if not exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.role = 'admin'
  ) then
    raise exception 'not authorized';
  end if;

  select promotion_credits, league_tier into v_credits, v_tier
  from public.teams where id = p_team_id for update;

  if v_credits is null then
    raise exception 'team not found';
  end if;

  if v_credits + 1 >= 3 then
    -- 승업: upper 로 올리고 카운터 리셋. 이미 upper 면 크레딧만 리셋(상한 도달).
    update public.teams
      set promotion_credits = 0,
          league_tier = 'upper'
      where id = p_team_id;
  else
    update public.teams
      set promotion_credits = v_credits + 1
      where id = p_team_id;
  end if;
end;
$$;

-- 강등 RPC — 최하위 팀을 lower 로. admin 전용.
create or replace function public.relegate_team(p_team_id uuid)
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

  update public.teams set league_tier = 'lower' where id = p_team_id;
end;
$$;

-- supabase.rpc()(PostgREST) 경로에서 호출 가능하도록 authenticated 역할에 EXECUTE 부여.
-- (권한 검증은 함수 내부 admin 체크가 담당 — grant 는 API 노출용)
grant execute on function public.award_participation_credit(uuid) to authenticated;
grant execute on function public.relegate_team(uuid) to authenticated;
