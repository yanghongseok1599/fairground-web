-- Harden the full team onboarding flow.
--
-- 1) A newly-created team can bind its creator as the team's pending coach
--    through claim_team_coach() without a direct self team_role update.
-- 2) Team join request policies must compare against the outer request row's
--    team_id explicitly.
-- 3) Dues reads should require approved team membership, and existing dues
--    periods should get payment rows when a member is approved later.

create or replace function public.is_team_member(p_team_id uuid)
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
    select 1 from public.profiles me
    where me.id = auth.uid()
      and me.is_approved = true
      and me.team_id = p_team_id
  )
  or exists (
    select 1
    from public.teams t
    join public.profiles me on me.id = auth.uid()
    where t.id = p_team_id
      and t.captain_id = auth.uid()
      and me.is_approved = true
  );
$$;

create or replace function public.guard_team_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_team uuid;
  actor_team_role team_role_t;
begin
  if new.team_role is not distinct from old.team_role
     and new.is_approved is not distinct from old.is_approved then
    return new;
  end if;

  if is_admin() then return new; end if;
  if current_setting('app.in_end_match', true) = '1' then return new; end if;
  if current_setting('app.in_set_team_member_role', true) = '1' then return new; end if;
  if current_setting('app.applying_team_join_request', true) = '1' then return new; end if;

  if current_setting('app.claiming_team_coach', true) = '1'
     and new.id = auth.uid()
     and new.is_approved is not distinct from old.is_approved
     and new.team_role = 'coach'
     and (old.team_id is null or old.team_id is not distinct from new.team_id)
     and exists (
       select 1
       from public.teams t
       where t.id = new.team_id
         and t.captain_id = auth.uid()
     ) then
    return new;
  end if;

  select team_id, team_role into actor_team, actor_team_role
    from public.profiles where id = auth.uid();

  if new.id = auth.uid() and new.team_role is distinct from old.team_role then
    raise exception 'cannot change own team_role';
  end if;

  if new.team_role = 'coach' and (old.team_role is distinct from 'coach') then
    raise exception 'only admin can assign coach';
  end if;

  if actor_team_role = 'coach' and actor_team is not null
     and new.team_id is not distinct from actor_team
     and old.team_id is not distinct from actor_team
     and new.team_role in ('member','captain','manager') then
    return new;
  end if;

  raise exception 'insufficient permission to change team_role / is_approved';
end;
$$;

create or replace function public.claim_team_coach(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor public.profiles%rowtype;
  v_team public.teams%rowtype;
  v_is_current_owner boolean := false;
  v_can_claim_orphan boolean := false;
begin
  if v_actor_id is null then
    raise exception '로그인이 필요합니다';
  end if;

  select * into v_actor
  from public.profiles
  where id = v_actor_id;

  if not found then
    raise exception '현재 사용자를 찾을 수 없습니다';
  end if;

  select * into v_team
  from public.teams
  where id = p_team_id
  for update;

  if not found then
    raise exception '팀을 찾을 수 없습니다';
  end if;

  if v_actor.team_id is not null and v_actor.team_id is distinct from p_team_id then
    raise exception '이미 다른 팀에 소속되어 있습니다';
  end if;

  v_is_current_owner := v_team.captain_id = v_actor_id;
  v_can_claim_orphan :=
    v_team.captain_id is null
    and v_actor.team_id is not distinct from p_team_id
    and v_actor.is_approved = true;

  if v_team.captain_id is not null and not v_is_current_owner then
    raise exception '이미 등록된 팀 감독이 있습니다';
  end if;

  if not (v_is_current_owner or v_can_claim_orphan) then
    raise exception '팀 생성자 또는 승인된 팀 멤버만 감독으로 등록할 수 있습니다';
  end if;

  perform set_config('app.claiming_team_coach', '1', true);

  if v_team.captain_id is null then
    update public.teams
      set captain_id = v_actor_id
      where id = p_team_id;
  end if;

  update public.profiles
    set team_id = p_team_id,
        team_role = 'coach'
    where id = v_actor_id;
end;
$$;

revoke all on function public.claim_team_coach(uuid) from public;
grant execute on function public.claim_team_coach(uuid) to authenticated;

drop policy if exists "team_join_requests_select" on public.team_join_requests;
create policy "team_join_requests_select"
  on public.team_join_requests
  for select
  using (
    auth.uid() = player_id
    or exists (
      select 1 from public.profiles me
      where me.id = auth.uid() and me.role = 'admin'
    )
    or public.is_team_director(public.team_join_requests.team_id)
  );

drop policy if exists "team_join_requests_update_director" on public.team_join_requests;
create policy "team_join_requests_update_director"
  on public.team_join_requests
  for update
  using (public.is_team_director(public.team_join_requests.team_id))
  with check (public.is_team_director(public.team_join_requests.team_id));

drop policy if exists "team_join_requests_delete" on public.team_join_requests;
create policy "team_join_requests_delete"
  on public.team_join_requests
  for delete
  using (
    (auth.uid() = player_id and status = 'pending')
    or exists (
      select 1 from public.profiles me
      where me.id = auth.uid() and me.role = 'admin'
    )
    or public.is_team_director(public.team_join_requests.team_id)
  );

create or replace function public.backfill_team_dues_payments_for_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.team_id is not null
     and new.is_approved = true
     and (
       tg_op = 'INSERT'
       or old.team_id is distinct from new.team_id
       or old.is_approved is distinct from true
     ) then
    insert into public.team_dues_payments (period_id, player_id, status)
    select p.id, new.id, 'unpaid'
    from public.team_dues_periods p
    where p.team_id = new.team_id
    on conflict (period_id, player_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_backfill_team_dues_payments_for_member on public.profiles;
create trigger trg_backfill_team_dues_payments_for_member
  after insert or update of team_id, is_approved on public.profiles
  for each row execute function public.backfill_team_dues_payments_for_member();
