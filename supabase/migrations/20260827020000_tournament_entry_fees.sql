-- 참가비 수납 관리.
--
-- 참가비는 팀 단위로 한 번 낸다(얼리버드 40만원 / 일반 45만원). 팀 테이블에
-- 컬럼을 붙이면 팀 정체성과 특정 대회의 납부 사실이 섞이므로, 대회×팀 단위의
-- 별도 테이블로 둔다. 다음 대회에도 그대로 쓸 수 있다.

create table if not exists public.tournament_entry_fees (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  team_id       uuid not null references public.teams(id) on delete cascade,
  amount        integer not null default 0,
  status        text not null default 'unpaid'
                check (status in ('unpaid', 'partial', 'paid')),
  paid_at       timestamptz,
  memo          text,
  updated_by    uuid references public.profiles(id) on delete set null,
  updated_at    timestamptz not null default now(),
  unique (tournament_id, team_id)
);

create index if not exists idx_entry_fees_tournament
  on public.tournament_entry_fees (tournament_id);

alter table public.tournament_entry_fees enable row level security;

-- 참가비 내역은 운영 정보다. 다른 팀의 납부 여부가 보이면 안 되므로
-- 관리자에게만 연다. (비관리자 읽기 0건 / 쓰기 42501 로 검증)
drop policy if exists entry_fees_admin_all on public.tournament_entry_fees;
create policy entry_fees_admin_all on public.tournament_entry_fees
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create or replace function public.touch_entry_fee_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_touch_entry_fee on public.tournament_entry_fees;
create trigger trg_touch_entry_fee
  before update on public.tournament_entry_fees
  for each row execute function public.touch_entry_fee_updated_at();
