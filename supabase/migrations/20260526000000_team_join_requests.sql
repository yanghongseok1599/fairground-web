-- Team join-request flow.
--
-- A logged-in user (any player) can submit a request to join an approved
-- team. The team's directors (manager/coach team_role, or admin) review the
-- queue in /teams/[id]/admin and approve or reject.
--
-- Final state ("approved") is materialised by the trigger: it sets
-- profiles.team_id = team_id for the requester and stamps processed_at.

-- enum: CREATE TYPE has no IF NOT EXISTS in PostgreSQL, so guard with DO.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'team_join_status_t') then
    create type team_join_status_t as enum ('pending', 'approved', 'rejected');
  end if;
end$$;

create table if not exists public.team_join_requests (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  message text,
  status team_join_status_t not null default 'pending',
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by uuid references public.profiles(id) on delete set null
);

-- Only one *pending* request per (team, player). Approved/rejected rows can
-- accumulate as history. A regular unique constraint on (team_id, player_id,
-- status) would block re-application after rejection — we want that to stay
-- possible — so use a partial unique index instead.
create unique index if not exists team_join_requests_unique_pending_idx
  on public.team_join_requests (team_id, player_id)
  where status = 'pending';

create index if not exists team_join_requests_team_status_idx
  on public.team_join_requests (team_id, status, created_at desc);

create index if not exists team_join_requests_player_idx
  on public.team_join_requests (player_id, status, created_at desc);

alter table public.team_join_requests enable row level security;

-- INSERT: the requester is the authenticated user; can only request when
-- they have no team yet (matches the UX gate) and the target team is approved.
create policy "team_join_requests_insert_own"
  on public.team_join_requests
  for insert
  with check (
    auth.uid() = player_id
    and status = 'pending'
    and exists (
      select 1 from public.teams t
      where t.id = team_id and t.is_approved
    )
    and not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.team_id is not null
    )
  );

-- SELECT: the requester, the team's directors (manager/coach team_role on
-- this team, or its captainId), or league admin.
create policy "team_join_requests_select"
  on public.team_join_requests
  for select
  using (
    auth.uid() = player_id
    or exists (
      select 1 from public.profiles me
      where me.id = auth.uid() and me.role = 'admin'
    )
    or exists (
      select 1 from public.teams t
      where t.id = team_id and t.captain_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles me
      where me.id = auth.uid()
        and me.team_id = team_id
        and me.team_role in ('manager', 'coach')
    )
  );

-- UPDATE: directors flip status (approve/reject). The requester cannot
-- mutate their own row once submitted.
create policy "team_join_requests_update_director"
  on public.team_join_requests
  for update
  using (
    exists (
      select 1 from public.profiles me
      where me.id = auth.uid() and me.role = 'admin'
    )
    or exists (
      select 1 from public.teams t
      where t.id = team_id and t.captain_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles me
      where me.id = auth.uid()
        and me.team_id = team_id
        and me.team_role in ('manager', 'coach')
    )
  );

-- DELETE: requester can cancel their own pending request; directors can
-- prune approved/rejected rows. We keep history by default — directors
-- rarely need to delete, but we allow it for cleanup.
create policy "team_join_requests_delete"
  on public.team_join_requests
  for delete
  using (
    (auth.uid() = player_id and status = 'pending')
    or exists (
      select 1 from public.profiles me
      where me.id = auth.uid() and me.role = 'admin'
    )
    or exists (
      select 1 from public.teams t
      where t.id = team_id and t.captain_id = auth.uid()
    )
  );

-- Trigger: when a request transitions to 'approved', set the requester's
-- team_id and stamp processing metadata.
create or replace function public.apply_team_join_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved' and (old.status is null or old.status <> 'approved') then
    update public.profiles
      set team_id = new.team_id,
          is_approved = true
      where id = new.player_id;
    new.processed_at = now();
    new.processed_by = auth.uid();
  elsif new.status = 'rejected' and (old.status is null or old.status <> 'rejected') then
    new.processed_at = now();
    new.processed_by = auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_apply_team_join_request on public.team_join_requests;
create trigger trg_apply_team_join_request
  before update on public.team_join_requests
  for each row execute function public.apply_team_join_request();
