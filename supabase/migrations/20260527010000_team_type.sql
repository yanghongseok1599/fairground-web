-- Team type — 동호회(community) vs 클럽(club).
--
-- community : 모든 팀원에게 회비 장부(period/payment/expense) 가 투명 공개.
--             현재 RLS 가 그대로 적용된다 (member 가 전체 read).
-- club      : 개인 운영자가 수익화 목적으로 굴리는 클럽. 멤버는 본인이 낸
--             내역만 보이고, 전체 장부(다른 멤버 납부/지출/잔액)는 디렉터만.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'team_type_t') then
    create type team_type_t as enum ('community', 'club');
  end if;
end$$;

alter table public.teams
  add column if not exists team_type team_type_t not null default 'community';

-- payments SELECT 재정의: club 인 팀은 본인 행만 보이게 한다. community 는 기존
-- 행위 유지(전체 read). 정책 자체를 갈아끼우는 방식 — 기존 select 정책 drop 후
-- 새 정책 1개로 일원화.
drop policy if exists "team_dues_payments_select_member"
  on public.team_dues_payments;

create policy "team_dues_payments_select"
  on public.team_dues_payments for select
  using (
    -- 본인 행은 항상 보임
    auth.uid() = player_id
    or exists (
      select 1
        from public.team_dues_periods p
        join public.teams t on t.id = p.team_id
       where p.id = period_id
         and (
           -- 디렉터/admin 은 전체 read (team_type 무관)
           public.is_team_director(p.team_id)
           -- 일반 멤버는 community 일 때만 전체 read
           or (
             t.team_type = 'community'
             and public.is_team_member(p.team_id)
           )
         )
    )
  );

-- expenses SELECT 재정의: club 은 멤버 비공개(디렉터 전용). community 는 전체 공개.
drop policy if exists "team_dues_expenses_select_member"
  on public.team_dues_expenses;

create policy "team_dues_expenses_select"
  on public.team_dues_expenses for select
  using (
    exists (
      select 1 from public.teams t
       where t.id = team_id
         and (
           public.is_team_director(team_id)
           or (
             t.team_type = 'community'
             and public.is_team_member(team_id)
           )
         )
    )
  );

-- periods SELECT 재정의도 동일 패턴. 멤버에게 본인이 속한 period 의 존재는
-- 무조건 보여야(본인 row를 가져오려면 periods join 가능해야 함) 하므로 club
-- 에서도 period 자체는 공개. 금액(monthly_amount)만 club 이면 노출 안 하고
-- 싶다면 별도 view 가 필요하지만, 단순화를 위해 현 단계에서는 period 메타는
-- 공개 유지.
-- → 기존 정책 그대로 둔다 (drop 하지 않음).
