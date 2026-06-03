-- 리그 단계 2단계(upper/lower) → 4단계(bronze/silver/gold/premium) 확장.
-- 선수 카드 등급(브론즈~프리미엄) 과 톤 통일. 신규 팀은 bronze 시작.
--
-- 승업: 3 크레딧 → 한 단계 위(bronze→silver→gold→premium), 크레딧 0 리셋.
--       premium(최상위)에서는 단계 유지하고 크레딧만 리셋.
-- 강등: 한 단계 아래(premium→gold→silver→bronze), bronze(최하위)는 유지.

-- 기존 enum 을 새 4단계 enum 으로 교체 (lower→bronze, upper→silver 매핑).
alter type league_tier_t rename to league_tier_t_old;
create type league_tier_t as enum ('bronze', 'silver', 'gold', 'premium');

alter table public.teams alter column league_tier drop default;
alter table public.teams
  alter column league_tier type league_tier_t
  using (
    case league_tier::text
      when 'lower' then 'bronze'
      when 'upper' then 'silver'
      else 'bronze'
    end::league_tier_t
  );
alter table public.teams alter column league_tier set default 'bronze';

drop type league_tier_t_old;

-- 승업 RPC 재작성 — 3 크레딧 도달 시 한 단계 승급.
create or replace function public.award_participation_credit(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credits integer;
  v_tier league_tier_t;
  v_next league_tier_t;
begin
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
    -- 한 단계 위로(이미 premium 이면 유지), 크레딧 리셋.
    v_next := case v_tier
      when 'bronze' then 'silver'
      when 'silver' then 'gold'
      when 'gold' then 'premium'
      else 'premium'
    end;
    update public.teams
      set promotion_credits = 0, league_tier = v_next
      where id = p_team_id;
  else
    update public.teams
      set promotion_credits = v_credits + 1
      where id = p_team_id;
  end if;
end;
$$;

-- 강등 RPC 재작성 — 한 단계 아래로(bronze 는 유지).
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

grant execute on function public.award_participation_credit(uuid) to authenticated;
grant execute on function public.relegate_team(uuid) to authenticated;
notify pgrst, 'reload schema';
