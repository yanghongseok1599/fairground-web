-- Team dues (월별 회비) — 3-table model:
--   team_dues_periods  : a billable monthly cycle (team + month + amount)
--   team_dues_payments : per-member status for one period
--   team_dues_expenses : free-form spending against the team's balance
--
-- Balance = sum(payments.amount_paid) − sum(expenses.amount). Reads are open
-- to roster members (and admins); mutations are director-only via RLS.

-- payment status enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'team_dues_payment_status_t') then
    create type team_dues_payment_status_t as enum ('unpaid', 'paid', 'exempt', 'partial');
  end if;
end$$;

create table if not exists public.team_dues_periods (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  -- always first day of month; client passes YYYY-MM-01
  period_month date not null,
  monthly_amount integer not null check (monthly_amount >= 0),
  due_date date,
  memo text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  unique (team_id, period_month)
);

create index if not exists team_dues_periods_team_month_idx
  on public.team_dues_periods (team_id, period_month desc);

create table if not exists public.team_dues_payments (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.team_dues_periods(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  status team_dues_payment_status_t not null default 'unpaid',
  amount_paid integer not null default 0 check (amount_paid >= 0),
  paid_at timestamptz,
  memo text,
  recorded_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (period_id, player_id)
);

create index if not exists team_dues_payments_period_idx
  on public.team_dues_payments (period_id, status);
create index if not exists team_dues_payments_player_idx
  on public.team_dues_payments (player_id, updated_at desc);

create table if not exists public.team_dues_expenses (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  occurred_on date not null default current_date,
  category text,
  amount integer not null check (amount > 0),
  memo text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

create index if not exists team_dues_expenses_team_date_idx
  on public.team_dues_expenses (team_id, occurred_on desc);

alter table public.team_dues_periods  enable row level security;
alter table public.team_dues_payments enable row level security;
alter table public.team_dues_expenses enable row level security;

-- shared predicate: is auth.uid() a director of `team_id`?
-- director = league admin OR team's captain_id OR teamRole∈(captain|manager|coach)
create or replace function public.is_team_director(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.role = 'admin'
  )
  or exists (
    select 1 from public.teams t
    where t.id = p_team_id and t.captain_id = auth.uid()
  )
  or exists (
    select 1 from public.profiles me
    where me.id = auth.uid()
      and me.team_id = p_team_id
      and me.team_role in ('captain', 'manager', 'coach')
  );
$$;

-- shared predicate: is auth.uid() a member (or director) of `team_id`?
create or replace function public.is_team_member(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles me
    where me.id = auth.uid()
      and (me.team_id = p_team_id or me.role = 'admin')
  )
  or exists (
    select 1 from public.teams t
    where t.id = p_team_id and t.captain_id = auth.uid()
  );
$$;

-- ── periods policies ─────────────────────────────────────────────────────
create policy "team_dues_periods_select_member"
  on public.team_dues_periods for select
  using (public.is_team_member(team_id));

create policy "team_dues_periods_insert_director"
  on public.team_dues_periods for insert
  with check (public.is_team_director(team_id));

create policy "team_dues_periods_update_director"
  on public.team_dues_periods for update
  using (public.is_team_director(team_id));

create policy "team_dues_periods_delete_director"
  on public.team_dues_periods for delete
  using (public.is_team_director(team_id));

-- ── payments policies ────────────────────────────────────────────────────
-- payments belong to a period → resolve team via the period.
create policy "team_dues_payments_select_member"
  on public.team_dues_payments for select
  using (
    auth.uid() = player_id
    or exists (
      select 1 from public.team_dues_periods p
      where p.id = period_id and public.is_team_member(p.team_id)
    )
  );

create policy "team_dues_payments_insert_director"
  on public.team_dues_payments for insert
  with check (
    exists (
      select 1 from public.team_dues_periods p
      where p.id = period_id and public.is_team_director(p.team_id)
    )
  );

create policy "team_dues_payments_update_director"
  on public.team_dues_payments for update
  using (
    exists (
      select 1 from public.team_dues_periods p
      where p.id = period_id and public.is_team_director(p.team_id)
    )
  );

create policy "team_dues_payments_delete_director"
  on public.team_dues_payments for delete
  using (
    exists (
      select 1 from public.team_dues_periods p
      where p.id = period_id and public.is_team_director(p.team_id)
    )
  );

-- ── expenses policies ────────────────────────────────────────────────────
create policy "team_dues_expenses_select_member"
  on public.team_dues_expenses for select
  using (public.is_team_member(team_id));

create policy "team_dues_expenses_insert_director"
  on public.team_dues_expenses for insert
  with check (public.is_team_director(team_id));

create policy "team_dues_expenses_update_director"
  on public.team_dues_expenses for update
  using (public.is_team_director(team_id));

create policy "team_dues_expenses_delete_director"
  on public.team_dues_expenses for delete
  using (public.is_team_director(team_id));

-- ── triggers ─────────────────────────────────────────────────────────────
-- 1) Auto-seed payment rows for every current team member when a period is
--    inserted. Members who join later don't get back-billed — directors must
--    add their row manually (or future migration adds a backfill RPC).
create or replace function public.seed_team_dues_payments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.team_dues_payments (period_id, player_id, status)
  select new.id, p.id, 'unpaid'
  from public.profiles p
  where p.team_id = new.team_id
    and p.is_approved = true
  on conflict (period_id, player_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_seed_team_dues_payments on public.team_dues_periods;
create trigger trg_seed_team_dues_payments
  after insert on public.team_dues_periods
  for each row execute function public.seed_team_dues_payments();

-- 2) Stamp paid_at / recorded_by / updated_at on status transitions.
create or replace function public.stamp_team_dues_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  if new.status in ('paid', 'partial')
     and (old is null or old.status is distinct from new.status) then
    if new.paid_at is null then
      new.paid_at = now();
    end if;
    new.recorded_by = auth.uid();
  elsif new.status in ('unpaid', 'exempt')
        and (old is null or old.status is distinct from new.status) then
    new.paid_at = null;
    new.recorded_by = auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_stamp_team_dues_payment on public.team_dues_payments;
create trigger trg_stamp_team_dues_payment
  before insert or update on public.team_dues_payments
  for each row execute function public.stamp_team_dues_payment();
