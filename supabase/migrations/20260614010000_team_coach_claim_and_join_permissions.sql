-- Fix team coach authority recovery and team join request processing.
--
-- Problems addressed:
-- 1) Orphan teams with captain_id = null could not be claimed by an approved
--    member because the team/profile guard triggers blocked the self-repair UI.
-- 2) team_join_requests approvals by a team director could be blocked by
--    profile privileged-column guards.
-- 3) DB-level team director checks did not consistently require approved
--    team membership.

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
    select 1
    from public.teams t
    join public.profiles me on me.id = auth.uid()
    where t.id = p_team_id
      and t.captain_id = auth.uid()
      and me.is_approved = true
  )
  or exists (
    select 1 from public.profiles me
    where me.id = auth.uid()
      and me.is_approved = true
      and me.team_id = p_team_id
      and me.team_role in ('coach', 'manager')
  );
$$;

create or replace function public.is_team_coach(p_team_id uuid)
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
    select 1
    from public.teams t
    join public.profiles me on me.id = auth.uid()
    where t.id = p_team_id
      and t.captain_id = auth.uid()
      and me.is_approved = true
  )
  or exists (
    select 1 from public.profiles me
    where me.id = auth.uid()
      and me.is_approved = true
      and me.team_id = p_team_id
      and me.team_role = 'coach'
  );
$$;

create or replace function public.is_team_manager(p_team_id uuid)
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
    select 1
    from public.teams t
    join public.profiles me on me.id = auth.uid()
    where t.id = p_team_id
      and t.captain_id = auth.uid()
      and me.is_approved = true
  )
  or exists (
    select 1 from public.profiles me
    where me.id = auth.uid()
      and me.is_approved = true
      and me.team_id = p_team_id
      and me.team_role in ('coach', 'manager')
  );
$$;

create or replace function public.is_team_match_staff(p_team_id uuid)
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
    select 1
    from public.teams t
    join public.profiles me on me.id = auth.uid()
    where t.id = p_team_id
      and t.captain_id = auth.uid()
      and me.is_approved = true
  )
  or exists (
    select 1 from public.profiles me
    where me.id = auth.uid()
      and me.is_approved = true
      and me.team_id = p_team_id
      and me.team_role in ('coach', 'captain')
  );
$$;

create or replace function public.guard_privileged_profile_cols()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_admin()
     or current_setting('app.in_end_match', true) = '1'
     or current_setting('app.in_set_team_member_role', true) = '1'
     or current_setting('app.applying_team_join_request', true) = '1'
     or current_setting('app.claiming_team_coach', true) = '1' then
    return new;
  end if;

  if new.role                is distinct from old.role
  or new.is_approved         is distinct from old.is_approved
  or new.card_rating         is distinct from old.card_rating
  or new.goals               is distinct from old.goals
  or new.assists             is distinct from old.assists
  or new.games               is distinct from old.games
  or new.mom                 is distinct from old.mom
  or new.season_yellow_cards is distinct from old.season_yellow_cards
  or new.is_banned           is distinct from old.is_banned
  or new.ban_matches_remaining is distinct from old.ban_matches_remaining
  or new.attendance_streak       is distinct from old.attendance_streak
  or new.attendance_streak_best  is distinct from old.attendance_streak_best then
    raise exception 'privileged columns can only be changed by admin or end_match()';
  end if;
  return new;
end;
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
     and old.is_approved = true
     and new.is_approved is not distinct from old.is_approved
     and new.team_id is not distinct from old.team_id
     and old.team_id is not null
     and new.team_role = 'coach' then
    return new;
  end if;

  select team_id, team_role into actor_team, actor_team_role
    from profiles where id = auth.uid();

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

create or replace function public.guard_team_privileged_cols()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_admin() or is_referee_or_admin() then
    return new;
  end if;

  if current_setting('app.claiming_team_coach', true) = '1'
     and old.captain_id is null
     and new.captain_id = auth.uid()
     and exists (
       select 1 from public.profiles me
       where me.id = auth.uid()
         and me.team_id = new.id
         and me.is_approved = true
     ) then
    return new;
  end if;

  if new.is_approved is distinct from old.is_approved
  or new.captain_id is distinct from old.captain_id then
    raise exception 'is_approved/captain_id can only be changed by referee/admin';
  end if;
  return new;
end;
$$;

create or replace function public.set_team_member_role(
  p_player_id uuid,
  p_team_role public.team_role_t
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor public.profiles%rowtype;
  v_target public.profiles%rowtype;
  v_is_owner boolean := false;
begin
  if v_actor_id is null then
    raise exception '로그인이 필요합니다';
  end if;

  if p_team_role is null then
    raise exception '팀 역할이 필요합니다';
  end if;

  select * into v_actor
  from public.profiles
  where id = v_actor_id;

  if not found then
    raise exception '현재 사용자를 찾을 수 없습니다';
  end if;

  select * into v_target
  from public.profiles
  where id = p_player_id;

  if not found then
    raise exception '대상 멤버를 찾을 수 없습니다';
  end if;

  if v_target.team_id is null then
    raise exception '대상 멤버가 팀에 속해 있지 않습니다';
  end if;

  if v_actor_id = p_player_id then
    raise exception '본인 역할은 직접 변경할 수 없습니다';
  end if;

  select exists (
    select 1 from public.teams t
    where t.id = v_target.team_id and t.captain_id = v_actor_id
  ) into v_is_owner;

  if not (
    v_actor.role = 'admin'
    or (v_actor.is_approved = true and v_is_owner)
    or (
      v_actor.is_approved = true
      and v_actor.team_id = v_target.team_id
      and v_actor.team_role in ('coach', 'manager')
    )
  ) then
    raise exception '팀 역할 변경 권한이 없습니다';
  end if;

  if v_actor.role <> 'admin' and not v_is_owner and v_actor.team_id <> v_target.team_id then
    raise exception '다른 팀 멤버의 역할은 변경할 수 없습니다';
  end if;

  if v_actor.role <> 'admin'
     and not v_is_owner
     and v_actor.team_role = 'manager'
     and (p_team_role = 'coach' or v_target.team_role = 'coach') then
    raise exception '매니저는 감독 권한을 부여하거나 회수할 수 없습니다';
  end if;

  perform set_config('app.in_set_team_member_role', '1', true);

  update public.profiles
    set team_role = p_team_role,
        is_approved = true
    where id = p_player_id;
end;
$$;

revoke all on function public.set_team_member_role(uuid, public.team_role_t) from public;
grant execute on function public.set_team_member_role(uuid, public.team_role_t) to authenticated;

create or replace function public.apply_team_join_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved' and (old.status is null or old.status <> 'approved') then
    perform set_config('app.applying_team_join_request', '1', true);

    update public.profiles
      set team_id = new.team_id,
          is_approved = true,
          team_role = coalesce(team_role, 'member'::public.team_role_t)
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

  if v_actor.team_id is distinct from p_team_id or v_actor.is_approved is distinct from true then
    raise exception '승인된 팀 멤버만 감독으로 등록할 수 있습니다';
  end if;

  select * into v_team
  from public.teams
  where id = p_team_id
  for update;

  if not found then
    raise exception '팀을 찾을 수 없습니다';
  end if;

  if v_team.captain_id is not null and v_team.captain_id <> v_actor_id then
    raise exception '이미 등록된 팀 감독이 있습니다';
  end if;

  perform set_config('app.claiming_team_coach', '1', true);

  update public.teams
    set captain_id = v_actor_id
    where id = p_team_id;

  update public.profiles
    set team_role = 'coach'
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
    or exists (
      select 1
      from public.teams t
      join public.profiles me on me.id = auth.uid()
      where t.id = team_id
        and t.captain_id = auth.uid()
        and me.is_approved = true
    )
    or exists (
      select 1 from public.profiles me
      where me.id = auth.uid()
        and me.is_approved = true
        and me.team_id = team_id
        and me.team_role in ('manager', 'coach')
    )
  );

drop policy if exists "team_join_requests_update_director" on public.team_join_requests;
create policy "team_join_requests_update_director"
  on public.team_join_requests
  for update
  using (
    exists (
      select 1 from public.profiles me
      where me.id = auth.uid() and me.role = 'admin'
    )
    or exists (
      select 1
      from public.teams t
      join public.profiles me on me.id = auth.uid()
      where t.id = team_id
        and t.captain_id = auth.uid()
        and me.is_approved = true
    )
    or exists (
      select 1 from public.profiles me
      where me.id = auth.uid()
        and me.is_approved = true
        and me.team_id = team_id
        and me.team_role in ('manager', 'coach')
    )
  );

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
    or exists (
      select 1
      from public.teams t
      join public.profiles me on me.id = auth.uid()
      where t.id = team_id
        and t.captain_id = auth.uid()
        and me.is_approved = true
    )
  );
