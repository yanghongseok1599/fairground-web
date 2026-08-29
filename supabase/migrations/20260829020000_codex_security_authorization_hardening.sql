-- Codex Security remediation:
-- 1) keep authorization-bearing profile membership fields server-owned,
-- 2) process join requests through one locked SECURITY DEFINER command,
-- 3) expose public player cards through a least-privilege projection, and
-- 4) remove obsolete anonymous registration writes.

begin;

-- ---------------------------------------------------------------------------
-- Profile membership is an authorization claim, not ordinary profile data.
-- Pending onboarding may still choose an initial team, but an approved profile
-- can move only through the audited join/claim/admin contexts below.
-- ---------------------------------------------------------------------------
create or replace function public.guard_privileged_profile_cols()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin()
     or current_setting('app.in_end_match', true) = '1'
     or current_setting('app.in_set_team_member_role', true) = '1'
     or current_setting('app.applying_team_join_request', true) = '1'
     or current_setting('app.claiming_team_coach', true) = '1' then
    return new;
  end if;

  if new.team_id is distinct from old.team_id
     and (coalesce(old.is_approved, false) or coalesce(new.is_approved, false)) then
    raise exception 'approved profile team membership can only be changed by an authorized workflow';
  end if;

  if new.role                     is distinct from old.role
  or new.is_approved              is distinct from old.is_approved
  or new.card_rating              is distinct from old.card_rating
  or new.goals                    is distinct from old.goals
  or new.assists                  is distinct from old.assists
  or new.games                    is distinct from old.games
  or new.mom                      is distinct from old.mom
  or new.season_yellow_cards      is distinct from old.season_yellow_cards
  or new.is_banned                is distinct from old.is_banned
  or new.ban_matches_remaining    is distinct from old.ban_matches_remaining
  or new.attendance_streak        is distinct from old.attendance_streak
  or new.attendance_streak_best   is distinct from old.attendance_streak_best then
    raise exception 'privileged profile columns can only be changed by an authorized workflow';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_privileged_profile_cols on public.profiles;
create trigger trg_guard_privileged_profile_cols
  before update on public.profiles
  for each row execute function public.guard_privileged_profile_cols();

-- The function already exists in the team-role migrations, but its trigger is
-- made explicit here so a rebuilt database cannot silently omit the guard.
drop trigger if exists trg_guard_team_role_change on public.profiles;
create trigger trg_guard_team_role_change
  before update on public.profiles
  for each row execute function public.guard_team_role_change();

-- ---------------------------------------------------------------------------
-- Join-request decisions are commands. Direct row UPDATE is removed so the
-- stored applicant/team identity cannot be retargeted by a modified browser.
-- ---------------------------------------------------------------------------
drop trigger if exists trg_apply_team_join_request on public.team_join_requests;
drop policy if exists "team_join_requests_update_director" on public.team_join_requests;
revoke update on public.team_join_requests from anon, authenticated;

create or replace function public.process_team_join_request(
  p_request_id uuid,
  p_status public.team_join_status_t
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.team_join_requests%rowtype;
  v_profile public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다';
  end if;

  if p_status not in ('approved'::public.team_join_status_t, 'rejected'::public.team_join_status_t) then
    raise exception '승인 또는 거절만 처리할 수 있습니다';
  end if;

  select * into v_request
  from public.team_join_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception '가입 신청을 찾을 수 없습니다';
  end if;

  if v_request.status <> 'pending'::public.team_join_status_t then
    raise exception '대기 중인 가입 신청만 처리할 수 있습니다';
  end if;

  if not public.is_team_director(v_request.team_id) then
    raise exception '가입 신청 처리 권한이 없습니다';
  end if;

  if p_status = 'approved'::public.team_join_status_t then
    select * into v_profile
    from public.profiles
    where id = v_request.player_id
    for update;

    if not found then
      raise exception '가입 신청 선수를 찾을 수 없습니다';
    end if;

    if v_profile.team_id is not null
       and v_profile.team_id is distinct from v_request.team_id then
      raise exception '이미 다른 팀에 소속된 선수입니다';
    end if;

    perform set_config('app.applying_team_join_request', '1', true);

    update public.profiles
      set team_id = v_request.team_id,
          is_approved = true,
          team_role = coalesce(team_role, 'member'::public.team_role_t)
      where id = v_request.player_id;
  end if;

  update public.team_join_requests
    set status = p_status,
        processed_at = now(),
        processed_by = auth.uid()
    where id = v_request.id;

  if p_status = 'approved'::public.team_join_status_t then
    begin
      insert into public.notifications (user_id, kind, title, snippet, actor_id, team_id)
      select v_request.player_id,
             'player_approved',
             '팀 가입이 승인되었어요',
             coalesce(t.name, '팀') || ' 가입이 승인되었습니다.',
             auth.uid(),
             v_request.team_id
      from public.teams t
      where t.id = v_request.team_id;
    exception when others then
      raise warning '[notify join] %', sqlerrm;
    end;
  end if;
end;
$$;

revoke all on function public.process_team_join_request(uuid, public.team_join_status_t) from public;
grant execute on function public.process_team_join_request(uuid, public.team_join_status_t) to authenticated;

-- ---------------------------------------------------------------------------
-- Public player projection. It intentionally omits contact, birth, gender,
-- eligibility, portrait-consent, and team-role fields.
-- ---------------------------------------------------------------------------
create or replace view public.public_player_profiles
with (security_barrier = true, security_invoker = true)
as
select
  id,
  name,
  number,
  position,
  team_id,
  nationality,
  photo_url,
  profile_photo_url,
  profile_photo_locked,
  photo_scale,
  photo_offset_x,
  card_type,
  card_skin,
  card_rating,
  goals,
  assists,
  games,
  mom,
  badges,
  is_banned,
  ban_matches_remaining,
  season_yellow_cards,
  is_approved,
  role,
  attendance_streak,
  attendance_streak_best,
  mbti,
  disposition,
  personal_values,
  bio,
  created_at
from public.profiles
where is_approved = true
  and is_banned = false;

-- Approved team members may see roster roles, but not one another's contact,
-- birth, eligibility, or consent metadata.
create or replace view public.team_member_player_profiles
with (security_barrier = true, security_invoker = true)
as
select
  id,
  name,
  number,
  position,
  team_id,
  nationality,
  photo_url,
  profile_photo_url,
  profile_photo_locked,
  photo_scale,
  photo_offset_x,
  card_type,
  card_skin,
  card_rating,
  goals,
  assists,
  games,
  mom,
  badges,
  is_banned,
  ban_matches_remaining,
  season_yellow_cards,
  is_approved,
  role,
  team_role,
  attendance_streak,
  attendance_streak_best,
  mbti,
  disposition,
  personal_values,
  bio,
  created_at
from public.profiles
where is_approved = true
  and is_banned = false;

revoke all on public.public_player_profiles from public, anon, authenticated;
grant select on public.public_player_profiles to anon, authenticated;
revoke all on public.team_member_player_profiles from public, anon, authenticated;

-- security_invoker views need underlying column privileges. Revoke broad base
-- table reads for both API roles, then restore only public projection columns.
-- Full rows are available solely through the scoped functions below.
revoke select on public.profiles from anon, authenticated;
grant select (
  id, name, number, position, team_id, nationality, photo_url,
  profile_photo_url, profile_photo_locked, photo_scale, photo_offset_x,
  card_type, card_skin, card_rating, goals, assists, games, mom, badges,
  is_banned, ban_matches_remaining, season_yellow_cards, is_approved, role,
  attendance_streak, attendance_streak_best, mbti, disposition,
  personal_values, bio, created_at
) on public.profiles to anon, authenticated;

create or replace function public.get_my_profile()
returns setof public.profiles
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다';
  end if;
  return query
    select p.* from public.profiles p where p.id = auth.uid();
end;
$$;

create or replace function public.get_admin_profiles()
returns setof public.profiles
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception '관리자 권한이 필요합니다';
  end if;
  return query select p.* from public.profiles p;
end;
$$;

create or replace function public.get_team_admin_profiles(p_team_id uuid)
returns setof public.profiles
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_team_director(p_team_id) then
    raise exception '팀 운영 권한이 필요합니다';
  end if;
  return query
    select p.* from public.profiles p where p.team_id = p_team_id;
end;
$$;

create or replace function public.get_team_join_request_profiles(p_team_id uuid)
returns setof public.profiles
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_team_director(p_team_id) then
    raise exception '가입 신청 조회 권한이 필요합니다';
  end if;
  return query
    select p.*
    from public.profiles p
    where exists (
      select 1
      from public.team_join_requests r
      where r.player_id = p.id
        and r.team_id = p_team_id
    );
end;
$$;

create or replace function public.get_team_member_profiles(p_team_id uuid)
returns setof public.team_member_player_profiles
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_team_member(p_team_id) then
    raise exception '팀 멤버 권한이 필요합니다';
  end if;
  return query
    select p.*
    from public.team_member_player_profiles p
    where p.team_id = p_team_id;
end;
$$;

revoke all on function public.get_my_profile() from public;
revoke all on function public.get_admin_profiles() from public;
revoke all on function public.get_team_admin_profiles(uuid) from public;
revoke all on function public.get_team_join_request_profiles(uuid) from public;
revoke all on function public.get_team_member_profiles(uuid) from public;
grant execute on function public.get_my_profile() to authenticated;
grant execute on function public.get_admin_profiles() to authenticated;
grant execute on function public.get_team_admin_profiles(uuid) to authenticated;
grant execute on function public.get_team_join_request_profiles(uuid) to authenticated;
grant execute on function public.get_team_member_profiles(uuid) to authenticated;

drop policy if exists "profiles_anon_public_rows_guard" on public.profiles;
create policy "profiles_anon_public_rows_guard"
  on public.profiles
  as restrictive
  for select
  to anon
  using (is_approved = true and is_banned = false);

-- ---------------------------------------------------------------------------
-- Registration now starts with Supabase Auth. Keep only authenticated, self-
-- bound recovery inserts and authenticated team applications.
-- ---------------------------------------------------------------------------
drop policy if exists "Allow public pending player registration" on public.profiles;
create policy "Allow authenticated pending player registration"
  on public.profiles
  for insert
  to authenticated
  with check (
    id = auth.uid()
    and coalesce(is_approved, false) = false
    and coalesce(role, 'player'::public.player_role_t) in (
      'player'::public.player_role_t,
      'captain'::public.player_role_t,
      'referee'::public.player_role_t
    )
    and team_role is null
    and coalesce(card_type, 'gold'::public.card_type_t) = 'gold'::public.card_type_t
    and coalesce(card_rating, 70) = 70
    and coalesce(goals, 0) = 0
    and coalesce(assists, 0) = 0
    and coalesce(games, 0) = 0
    and coalesce(mom, 0) = 0
    and coalesce(is_banned, false) = false
    and coalesce(ban_matches_remaining, 0) = 0
    and coalesce(season_yellow_cards, 0) = 0
  );

revoke insert on public.profiles from anon;
grant insert on public.profiles to authenticated;

drop policy if exists "Allow public pending team registration" on public.teams;
create policy "Allow authenticated pending team registration"
  on public.teams
  for insert
  to authenticated
  with check (
    captain_id = auth.uid()
    and coalesce(is_approved, false) = false
    and char_length(btrim(name)) between 1 and 100
  );

revoke insert on public.teams from anon;
grant insert on public.teams to authenticated;

-- Legacy/service inserts without a bound captain must never fan out to the
-- operator notification channel.
drop trigger if exists trg_notify_new_team_telegram on public.teams;
create trigger trg_notify_new_team_telegram
  after insert on public.teams
  for each row
  when (new.captain_id is not null)
  execute function public.notify_new_team_telegram();

commit;
