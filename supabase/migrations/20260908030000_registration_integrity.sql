-- Team creation, ownership changes and registration history are transactional.
-- Apply only after the repository's production migration gate is satisfied.
begin;

create or replace function public.preserve_registration_consent()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.portrait_consent_at is not null then new.portrait_consent_at := old.portrait_consent_at; end if;
  return new;
end;
$$;
revoke all on function public.preserve_registration_consent() from public;
create trigger preserve_registration_consent before update on public.profiles
  for each row execute function public.preserve_registration_consent();
create trigger preserve_registration_consent before update on public.teams
  for each row execute function public.preserve_registration_consent();

create table public.registration_history (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default clock_timestamp(),
  actor_id uuid,
  entity_type text not null check (entity_type in ('team', 'player', 'join_request')),
  entity_id uuid not null,
  operation text not null,
  before_values jsonb,
  after_values jsonb
);
alter table public.registration_history enable row level security;
revoke all on public.registration_history from anon, authenticated;
grant select on public.registration_history to authenticated;
create policy registration_history_admin_read on public.registration_history
  for select to authenticated using (public.is_admin());

create or replace function public.record_registration_history()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_keys text[];
  v_type text;
begin
  if tg_table_name = 'teams' then
    v_type := 'team';
    v_keys := array['name','captain_id','is_approved','team_type','founded_year','intro_subtitle','description','portrait_consent_at'];
  elsif tg_table_name = 'profiles' then
    v_type := 'player';
    v_keys := array['name','number','position','team_id','team_role','role','is_approved','portrait_consent_at'];
  else
    v_type := 'join_request';
    v_keys := array['team_id','player_id','status'];
  end if;
  if tg_op <> 'INSERT' then
    select jsonb_object_agg(key,value) into v_before from jsonb_each(to_jsonb(old)) where key = any(v_keys);
  end if;
  if tg_op <> 'DELETE' then
    select jsonb_object_agg(key,value) into v_after from jsonb_each(to_jsonb(new)) where key = any(v_keys);
  end if;
  if tg_op <> 'UPDATE' or v_before is distinct from v_after then
    insert into public.registration_history(actor_id,entity_type,entity_id,operation,before_values,after_values)
    values (auth.uid(),v_type,coalesce(new.id,old.id),tg_op,v_before,v_after);
  end if;
  return coalesce(new,old);
end;
$$;
revoke all on function public.record_registration_history() from public;
create trigger registration_history_teams after insert or update or delete on public.teams
  for each row execute function public.record_registration_history();
create trigger registration_history_profiles after insert or update or delete on public.profiles
  for each row execute function public.record_registration_history();
create trigger registration_history_join_requests after insert or update or delete on public.team_join_requests
  for each row execute function public.record_registration_history();

-- Match ownership transfer's team -> profile lock order and validate membership
-- only after locking the profile, so concurrent joins cannot be overwritten.
CREATE OR REPLACE FUNCTION "public"."claim_team_coach"("p_team_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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

  select * into v_team
  from public.teams
  where id = p_team_id
  for update;

  if not found then
    raise exception '팀을 찾을 수 없습니다';
  end if;

  select * into v_actor
  from public.profiles
  where id = v_actor_id
  for update;

  if not found then
    raise exception '현재 사용자를 찾을 수 없습니다';
  end if;

  if v_actor.team_id is not null and v_actor.team_id is distinct from p_team_id then
    raise exception '이미 다른 팀에 소속되어 있습니다';
  end if;

  v_is_current_owner := coalesce(v_team.captain_id = v_actor_id, false);
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

-- A stable client request ID recovers a committed write when its response was lost.
-- A per-actor transaction lock also serializes separate tabs with different IDs.
create or replace function public.register_team(
  p_request_id uuid,
  p_name text,
  p_logo text default '',
  p_founded_year integer default null,
  p_team_type text default 'community',
  p_portrait_consent_at timestamptz default null
) returns public.teams
language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_profile public.profiles;
  v_team public.teams;
begin
  if v_actor is null then raise exception '로그인이 필요합니다'; end if;
  if p_request_id is null then raise exception '등록 요청 번호가 필요합니다'; end if;
  if p_name is null or length(btrim(p_name)) not between 1 and 100 then
    raise exception '팀 이름은 1~100자로 입력해주세요';
  end if;
  if p_team_type is null or p_team_type not in ('community','club') then raise exception '팀 운영 형태를 확인해주세요'; end if;
  if p_founded_year is not null and p_founded_year not between 1900 and 2100 then raise exception '창단 연도를 확인해주세요'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_actor::text, 731));

  select * into v_profile from public.profiles where id = v_actor;
  if not found then raise exception '선수 프로필을 먼저 등록해주세요'; end if;
  select * into v_team from public.teams where id = p_request_id for update;
  if found then
    if v_team.captain_id is distinct from v_actor then raise exception '다른 등록 요청 번호를 사용해주세요'; end if;
    if v_team.name is distinct from btrim(p_name)
      or v_team.logo is distinct from coalesce(p_logo,'')
      or v_team.founded_year is distinct from p_founded_year
      or v_team.team_type::text is distinct from p_team_type then
      raise exception '이미 등록된 팀이 있습니다. 입력을 유지한 채 내 팀에서 기존 등록 결과를 확인해주세요';
    end if;
    if v_team.portrait_consent_at is null and p_portrait_consent_at is not null then
      update public.teams set portrait_consent_at = p_portrait_consent_at where id = v_team.id returning * into v_team;
    end if;
    perform public.claim_team_coach(v_team.id);
    return v_team;
  end if;
  -- Recover older partially completed registrations instead of adding a duplicate.
  select * into v_team from public.teams where captain_id = v_actor order by created_at limit 1 for update;
  if found then
    if v_team.name is distinct from btrim(p_name)
      or v_team.logo is distinct from coalesce(p_logo,'')
      or v_team.founded_year is distinct from p_founded_year
      or v_team.team_type::text is distinct from p_team_type then
      raise exception '이미 등록된 팀이 있습니다. 입력을 유지한 채 내 팀에서 기존 등록 결과를 확인해주세요';
    end if;
    if v_team.portrait_consent_at is null and p_portrait_consent_at is not null then
      update public.teams set portrait_consent_at = p_portrait_consent_at where id = v_team.id returning * into v_team;
    end if;
    perform public.claim_team_coach(v_team.id);
    return v_team;
  end if;
  if v_profile.team_id is not null then raise exception '이미 팀에 소속되어 있습니다. 내 팀을 확인해주세요'; end if;

  insert into public.teams(id,name,logo,captain_id,founded_year,team_type,is_approved,portrait_consent_at,member_count)
  values (p_request_id,btrim(p_name),coalesce(p_logo,''),v_actor,p_founded_year,p_team_type::public.team_type_t,false,p_portrait_consent_at,1)
  returning * into v_team;
  -- Any failure here rolls back the team, membership and history together.
  perform public.claim_team_coach(v_team.id);
  select * into v_team from public.teams where id = v_team.id;
  return v_team;
end;
$$;
revoke all on function public.register_team(uuid,text,text,integer,text,timestamptz) from public;
grant execute on function public.register_team(uuid,text,text,integer,text,timestamptz) to authenticated;

-- Lock before checking ownership: two requests by the previous owner must not
-- both pass authorization. NULL ownership must never bypass the check.
create or replace function public.transfer_team_ownership(p_team_id uuid,p_new_owner_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_team public.teams;
  v_new public.profiles;
begin
  if v_actor is null then raise exception '로그인이 필요합니다'; end if;
  select * into v_team from public.teams where id = p_team_id for update;
  if not found then raise exception '팀을 찾을 수 없습니다'; end if;
  if v_team.captain_id is distinct from v_actor and not public.is_admin() then
    raise exception '팀 소유자만 소유권을 이전할 수 있습니다';
  end if;
  select * into v_new from public.profiles where id = p_new_owner_id for update;
  if not found then raise exception '대상 멤버를 찾을 수 없습니다'; end if;
  if v_new.team_id is distinct from p_team_id or not coalesce(v_new.is_approved,false) then
    raise exception '새 소유자는 이 팀의 승인된 멤버여야 합니다';
  end if;
  if v_new.id = v_team.captain_id then return; end if;
  perform set_config('app.transferring_ownership','1',true);
  update public.teams set captain_id = p_new_owner_id where id = p_team_id;
  -- Audit history is mandatory; a notification is best effort, as before.
  begin
    insert into public.notifications(user_id,kind,title,snippet,actor_id,team_id)
    values(p_new_owner_id,'team_role_changed','팀 소유권을 넘겨받았어요',
      coalesce(v_team.name,'팀') || '의 소유자가 되었습니다. 팀 정보·운영형태를 변경할 수 있어요.',v_actor,p_team_id);
  exception when others then raise warning '[notify transfer] %',sqlerrm;
  end;
end;
$$;
revoke all on function public.transfer_team_ownership(uuid,uuid) from public;
grant execute on function public.transfer_team_ownership(uuid,uuid) to authenticated;
commit;
