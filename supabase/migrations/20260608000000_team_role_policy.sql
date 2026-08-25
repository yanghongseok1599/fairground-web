-- Team role policy cleanup.
--
-- Canonical team roles:
--   coach   = 감독. Player guidance and match authority, with top-level role assignment.
--   manager = 매니저. Team operations, excluding 감독 assignment/removal.
--   captain = 캡틴. Match/lineup helper, not a team administration role.
--   member  = regular team member.

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
    select 1 from public.teams t
    where t.id = p_team_id and t.captain_id = auth.uid()
  )
  or exists (
    select 1 from public.profiles me
    where me.id = auth.uid()
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
    select 1 from public.teams t
    where t.id = p_team_id and t.captain_id = auth.uid()
  )
  or exists (
    select 1 from public.profiles me
    where me.id = auth.uid()
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
    select 1 from public.teams t
    where t.id = p_team_id and t.captain_id = auth.uid()
  )
  or exists (
    select 1 from public.profiles me
    where me.id = auth.uid()
      and me.team_id = p_team_id
      and me.team_role in ('coach', 'captain')
  );
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
    or v_is_owner
    or (
      v_actor.team_id = v_target.team_id
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

  update public.profiles
    set team_role = p_team_role,
        is_approved = true
    where id = p_player_id;
end;
$$;

revoke all on function public.set_team_member_role(uuid, public.team_role_t) from public;
grant execute on function public.set_team_member_role(uuid, public.team_role_t) to authenticated;

-- New team registration should bind the creator as the team's owner/감독 when
-- the client supplies captain_id = auth.uid(). Anonymous/legacy inserts can
-- still submit a pending team without an owner and use the in-product recovery
-- path after review.
drop policy if exists "Allow public pending team registration" on public.teams;

create policy "Allow public pending team registration"
on public.teams
for insert
to anon, authenticated
with check (
  coalesce(is_approved, false) = false
  and (
    captain_id is null
    or captain_id = auth.uid()
  )
);
