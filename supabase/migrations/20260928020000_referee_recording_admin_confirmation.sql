-- Requires 20260928010000. Pending production approval; rehearse on a restored schema.
alter table public.matches
  add column primary_referee_id uuid references public.profiles(id),
  add column assistant_referee_id uuid references public.profiles(id),
  add column clock_operator_id uuid references public.profiles(id),
  add column recording_revision integer not null default 0,
  add column confirmed_by uuid references public.profiles(id),
  add column confirmed_at timestamptz,
  add constraint different_match_referees check (primary_referee_id is distinct from assistant_referee_id or primary_referee_id is null);

alter table public.match_events
  add column goal_event_id uuid references public.match_events(id),
  add column assist_checked boolean not null default false,
  add column recorded_by uuid references public.profiles(id),
  add column recorded_by_name text,
  add column cancelled_by uuid references public.profiles(id),
  add column request_id uuid,
  add column request_payload jsonb;
create unique index match_event_request_once on public.match_events(match_id, request_id) where request_id is not null;
create unique index match_goal_one_active_assist on public.match_events(goal_event_id) where type = 'assist' and not is_cancelled;

create table public.match_recording_audit (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.matches(id),
  actor_id uuid references public.profiles(id),
  actor_name text,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.match_recording_audit enable row level security;
create policy recording_audit_staff_read on public.match_recording_audit for select to authenticated using (public.is_referee_or_admin());
revoke all on public.match_recording_audit from public, anon, authenticated;
grant select on public.match_recording_audit to authenticated;

create function public.assert_match_recorder(p_match_id uuid, p_action text) returns void
language plpgsql security definer set search_path = public as $$
declare m matches%rowtype; v_id uuid := auth.uid();
begin
  if v_id is null or not exists (select 1 from profiles where id=v_id and (role='admin' or (role='referee' and is_approved))) then
    raise exception '승인된 심판 또는 관리자만 기록할 수 있습니다.' using errcode='42501';
  end if;
  select * into m from matches where id=p_match_id for update;
  if not found then raise exception '경기를 찾을 수 없습니다.'; end if;
  if p_action = 'timer' then
    if m.clock_operator_id is distinct from v_id then raise exception '다른 담당자가 경기 시간을 관리하고 있습니다.' using errcode='42501'; end if;
  elsif is_admin() then return;
  elsif p_action='assist' and m.assistant_referee_id=v_id then return;
  elsif p_action in ('record','clock') and m.primary_referee_id=v_id then return;
  else raise exception '이 작업의 담당자가 아닙니다. 수정·확정은 관리자에게 확인해주세요.' using errcode='42501';
  end if;
end $$;
revoke all on function public.assert_match_recorder(uuid,text) from public, anon, authenticated;

create function public.claim_match_recording_role(p_match_id uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
declare m matches%rowtype; v_id uuid:=auth.uid();
begin
  if v_id is null or not exists(select 1 from profiles where id=v_id and role='referee' and is_approved) then
    raise exception '승인된 심판 계정으로 담당을 선택해주세요.' using errcode='42501';
  end if;
  select * into m from matches where id=p_match_id for update;
  if not found or m.status not in ('scheduled','live') or m.stats_applied then raise exception '담당을 선택할 수 없는 경기입니다.'; end if;
  if p_role='primary' then
    if (m.primary_referee_id is not null and m.primary_referee_id<>v_id) or m.assistant_referee_id=v_id then raise exception '이미 다른 담당자가 있거나 부심으로 참여 중입니다.'; end if;
    update matches set primary_referee_id=v_id where id=p_match_id;
  elsif p_role='assistant' then
    if (m.assistant_referee_id is not null and m.assistant_referee_id<>v_id) or m.primary_referee_id=v_id then raise exception '이미 다른 담당자가 있거나 주심으로 참여 중입니다.'; end if;
    update matches set assistant_referee_id=v_id where id=p_match_id;
  else raise exception '주심 또는 부심을 선택해주세요.'; end if;
  insert into match_recording_audit(match_id,actor_id,actor_name,action,details)
    select p_match_id,v_id,name,'claim_role',jsonb_build_object('role',p_role) from profiles where id=v_id;
end $$;

-- All event writes use validated RPCs. Raw REST writes must not bypass attribution,
-- role separation, cancellation history, goal links or result confirmation.
drop policy p_events_write on public.match_events;
drop policy p_matches_write on public.matches;
create policy matches_admin_create on public.matches for insert to authenticated
  with check (is_admin() and status='scheduled' and not stats_applied and home_score=0 and away_score=0
    and primary_referee_id is null and assistant_referee_id is null and confirmed_by is null and confirmed_at is null);
create policy matches_admin_remove_scheduled on public.matches for delete to authenticated
  using (is_admin() and status='scheduled');

create function public.stamp_match_record() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    new.recorded_by:=auth.uid();
    select name into new.recorded_by_name from profiles where id=auth.uid();
  elsif new.is_cancelled and not old.is_cancelled then new.cancelled_by:=auth.uid(); end if;
  return new;
end $$;
create trigger stamp_match_record before insert or update on public.match_events for each row execute function public.stamp_match_record();

create function public.track_match_record() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  update matches set recording_revision=recording_revision+1 where id=new.match_id;
  insert into match_recording_audit(match_id,actor_id,actor_name,action,details)
    select new.match_id,auth.uid(),name,case when tg_op='INSERT' then 'record' else 'update_record' end,
      jsonb_build_object('event_id',new.id,'type',new.type,'player_id',new.player_id,'goal_event_id',new.goal_event_id,'is_cancelled',new.is_cancelled,'assist_checked',new.assist_checked)
    from profiles where id=auth.uid();
  return new;
end $$;
create trigger track_match_record after insert or update on public.match_events for each row execute function public.track_match_record();

create function public.record_match_event(p_match_id uuid, p_request_id uuid, p_type match_event_t,
  p_player_id uuid, p_player_name text, p_team_id uuid, p_minute integer, p_half integer,
  p_goal_event_id uuid default null, p_actor_id uuid default null) returns uuid
language plpgsql security definer set search_path=public as $$
declare m matches%rowtype; g match_events%rowtype; e match_events%rowtype; v_id uuid; payload jsonb;
begin
  -- A receipt can be recovered after finalization, but never by another account.
  if p_actor_id is not null and p_actor_id is distinct from auth.uid() then raise exception '입력한 계정으로 다시 로그인해주세요.' using errcode='42501'; end if;
  if not is_referee_or_admin() then raise exception '심판 또는 관리자만 기록할 수 있습니다.' using errcode='42501'; end if;
  select * into m from matches where id=p_match_id for update;
  if not found or p_request_id is null then raise exception '경기와 요청 ID를 확인해주세요.'; end if;
  payload:=jsonb_build_object('type',p_type,'player',p_player_id,'name',p_player_name,'team',p_team_id,'minute',p_minute,'half',p_half,'goal',p_goal_event_id);
  select * into e from match_events where match_id=p_match_id and request_id=p_request_id;
  if found then
    if e.recorded_by is distinct from auth.uid() or e.request_payload is distinct from payload then raise exception '같은 요청 ID의 기록 내용이 다릅니다.'; end if;
    return e.id;
  end if;
  perform assert_match_recorder(p_match_id,case when p_type='assist' then 'assist' else 'record' end);
  if p_type not in ('goal','assist','foul','yellow_card','red_card') then raise exception '지원하지 않는 기록입니다.'; end if;
  if p_type='assist' then
    select * into g from match_events where id=p_goal_event_id and match_id=p_match_id and type='goal' and not is_cancelled;
    if not found or g.team_id is distinct from p_team_id or g.player_id=p_player_id then raise exception '해당 골과 같은 팀의 다른 어시스트 선수를 선택해주세요.'; end if;
    if g.assist_checked then raise exception '이 골의 어시스트는 이미 확인되었습니다. 정정은 관리자에게 확인해주세요.'; end if;
  elsif p_goal_event_id is not null then raise exception '어시스트에만 득점을 연결할 수 있습니다.'; end if;
  v_id:=add_match_event(p_match_id,p_type,p_player_id,p_player_name,p_team_id,
    case when p_type='assist' then g.minute else p_minute end,case when p_type='assist' then g.half else p_half end);
  update match_events set request_id=p_request_id,request_payload=payload,goal_event_id=p_goal_event_id where id=v_id;
  if p_type='assist' then update match_events set assist_checked=true where id=g.id; end if;
  return v_id;
end $$;

create function public.check_goal_without_assist(p_match_id uuid, p_goal_event_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare m matches%rowtype;
begin
  perform assert_match_recorder(p_match_id,'assist');
  select * into m from matches where id=p_match_id;
  if m.status<>'live' or m.stats_applied then raise exception '이미 확정된 경기입니다.'; end if;
  if exists(select 1 from match_events where goal_event_id=p_goal_event_id and not is_cancelled) then raise exception '이미 어시스트가 기록되어 있습니다.'; end if;
  update match_events set assist_checked=true where id=p_goal_event_id and match_id=p_match_id and type='goal' and not is_cancelled;
  if not found then raise exception '유효한 득점을 선택해주세요.'; end if;
end $$;

create function public.reopen_goal_assist(p_match_id uuid,p_goal_event_id uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  perform assert_match_recorder(p_match_id,'correct');
  if not exists(select 1 from matches where id=p_match_id and status='live' and not stats_applied) then raise exception '이미 확정된 경기입니다.'; end if;
  if exists(select 1 from match_events where goal_event_id=p_goal_event_id and not is_cancelled) then raise exception '기존 어시스트를 취소한 뒤 수정해주세요.'; end if;
  update match_events set assist_checked=false where id=p_goal_event_id and match_id=p_match_id and type='goal' and not is_cancelled;
  if not found then raise exception '유효한 득점을 선택해주세요.'; end if;
end $$;

create function public.confirm_match_recording(p_match_id uuid,p_expected_revision integer,p_mom_player_id uuid default null) returns void
language plpgsql security definer set search_path=public as $$
declare m matches%rowtype;
begin
  perform assert_match_recorder(p_match_id,'confirm');
  select * into m from matches where id=p_match_id;
  if m.status='finished' and m.stats_applied and m.confirmed_at is not null then return; end if;
  if m.status<>'live' or m.is_running then raise exception '경기 시간을 멈춘 뒤 최종 확인해주세요.'; end if;
  if p_expected_revision is null or m.recording_revision<>p_expected_revision then raise exception '다른 기록이 추가·수정되었습니다. 최신 기록을 다시 확인해주세요.'; end if;
  if exists(select 1 from match_events where match_id=p_match_id and type='goal' and not is_cancelled and not assist_checked) then raise exception '모든 골의 어시스트 또는 어시스트 없음을 확인해주세요.'; end if;
  if exists(select 1 from match_events where match_id=p_match_id and type='assist' and not is_cancelled and goal_event_id is null) then raise exception '득점에 연결되지 않은 어시스트를 정정해주세요.'; end if;
  if m.home_score<>(select count(*) from match_events where match_id=p_match_id and type='goal' and not is_cancelled and team_id=m.home_team_id)
    or m.away_score<>(select count(*) from match_events where match_id=p_match_id and type='goal' and not is_cancelled and team_id=m.away_team_id) then raise exception '스코어와 득점 기록이 일치하지 않습니다.'; end if;
  if p_mom_player_id is not null then perform set_match_mom(p_match_id,p_mom_player_id);
  else update matches set mom_player_id=null where id=p_match_id; end if;
  perform end_match(p_match_id);
  update matches set confirmed_by=auth.uid(),confirmed_at=now() where id=p_match_id;
  insert into match_recording_audit(match_id,actor_id,actor_name,action,details)
    select p_match_id,auth.uid(),name,'confirm',jsonb_build_object('revision',p_expected_revision,'home_score',m.home_score,'away_score',m.away_score) from profiles where id=auth.uid();
end $$;

revoke all on function public.add_match_event(uuid,match_event_t,uuid,text,uuid,integer,integer) from public, anon, authenticated;
revoke all on function public.end_match(uuid) from public, anon, authenticated;
revoke all on function public.stamp_match_record() from public, anon, authenticated;
revoke all on function public.track_match_record() from public, anon, authenticated;
revoke all on function public.claim_match_recording_role(uuid,text) from public, anon;
revoke all on function public.record_match_event(uuid,uuid,match_event_t,uuid,text,uuid,integer,integer,uuid,uuid) from public, anon;
revoke all on function public.check_goal_without_assist(uuid,uuid) from public, anon;
revoke all on function public.reopen_goal_assist(uuid,uuid) from public, anon;
revoke all on function public.confirm_match_recording(uuid,integer,uuid) from public, anon;
grant execute on function public.claim_match_recording_role(uuid,text),public.record_match_event(uuid,uuid,match_event_t,uuid,text,uuid,integer,integer,uuid,uuid),public.check_goal_without_assist(uuid,uuid),public.reopen_goal_assist(uuid,uuid),public.confirm_match_recording(uuid,integer,uuid) to authenticated;

-- Preserve existing eligibility/lineup/lifecycle validation; add recording duties.
CREATE OR REPLACE FUNCTION public.start_match(p_match_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  m public.matches%rowtype;
begin
  perform public.assert_match_recorder(p_match_id, 'clock');
  update public.matches set clock_operator_id=auth.uid() where id=p_match_id;
  if not public.is_referee_or_admin() then
    raise exception 'only referee/admin may start a match' using errcode = '42501';
  end if;

  select * into m from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'match % not found', p_match_id;
  end if;
  if m.stats_applied or m.status = 'finished' then
    raise exception 'match % already finalized', p_match_id;
  end if;

  update public.matches set
    status = 'live',
    current_half = 1,
    elapsed_seconds = case when m.status = 'live' then elapsed_seconds else 0 end,
    is_running = true
  where id = p_match_id;
end;
$function$;
CREATE OR REPLACE FUNCTION public.pause_match(p_match_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  m public.matches%rowtype;
begin
  perform public.assert_match_recorder(p_match_id, 'clock');
  if not public.is_referee_or_admin() then
    raise exception 'only referee/admin may pause a match' using errcode = '42501';
  end if;

  select * into m from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'match % not found', p_match_id;
  end if;
  if m.status <> 'live' or m.stats_applied then
    raise exception 'match % is not live', p_match_id;
  end if;

  update public.matches set is_running = false where id = p_match_id;
end;
$function$;
CREATE OR REPLACE FUNCTION public.resume_match(p_match_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  m public.matches%rowtype;
begin
  perform public.assert_match_recorder(p_match_id, 'clock');
  update public.matches set clock_operator_id=auth.uid() where id=p_match_id;
  if not public.is_referee_or_admin() then
    raise exception 'only referee/admin may resume a match' using errcode = '42501';
  end if;

  select * into m from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'match % not found', p_match_id;
  end if;
  if m.status <> 'live' or m.stats_applied then
    raise exception 'match % is not live', p_match_id;
  end if;

  update public.matches set is_running = true where id = p_match_id;
end;
$function$;
CREATE OR REPLACE FUNCTION public.update_match_timer(p_match_id uuid, p_elapsed_seconds integer, p_current_half integer DEFAULT 1)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  m public.matches%rowtype;
begin
  perform public.assert_match_recorder(p_match_id, 'timer');
  if not public.is_referee_or_admin() then
    raise exception 'only referee/admin may update match timer' using errcode = '42501';
  end if;

  select * into m from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'match % not found', p_match_id;
  end if;
  if m.status <> 'live' or m.stats_applied then
    raise exception 'match % is not live', p_match_id;
  end if;

  update public.matches set
    elapsed_seconds = least(720, greatest(0, coalesce(p_elapsed_seconds, 0))),
    current_half = greatest(1, least(2, coalesce(p_current_half, 1)))
  where id = p_match_id;
end;
$function$;
CREATE OR REPLACE FUNCTION public.set_match_mom(p_match_id uuid, p_player_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  m matches%rowtype;
  v_has_lineup boolean;
begin
  perform public.assert_match_recorder(p_match_id, 'correct');
  if not is_referee_or_admin() then
    raise exception 'only referee/admin may set match MOM' using errcode = '42501';
  end if;

  select * into m from matches where id = p_match_id for update;
  if not found then
    raise exception 'match % not found', p_match_id;
  end if;
  if m.status <> 'live' or m.stats_applied then
    raise exception 'match % is not editable (status=%)', p_match_id, m.status;
  end if;

  select exists(select 1 from match_lineups where match_id = p_match_id) into v_has_lineup;
  if v_has_lineup then
    if not exists (
      select 1 from match_lineups
      where match_id = p_match_id
        and player_id = p_player_id
        and team_id in (m.home_team_id, m.away_team_id)
    ) then
      raise exception 'player % is not in match lineup', p_player_id;
    end if;
  elsif not exists (
    select 1 from profiles
    where id = p_player_id
      and team_id in (m.home_team_id, m.away_team_id)
  ) then
    raise exception 'player % is not part of match teams', p_player_id;
  end if;

  update matches set mom_player_id = p_player_id, recording_revision=recording_revision+1 where id = p_match_id;
end $function$;
CREATE OR REPLACE FUNCTION public.forfeit_match(p_match_id uuid, p_forfeit_team_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  m public.matches%rowtype;
  v_home_score integer;
  v_away_score integer;
begin
  perform public.assert_match_recorder(p_match_id, 'confirm');
  if not public.is_referee_or_admin() then
    raise exception 'only referee/admin may forfeit a match' using errcode = '42501';
  end if;

  select * into m from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'match % not found', p_match_id;
  end if;
  if p_forfeit_team_id <> m.home_team_id and p_forfeit_team_id <> m.away_team_id then
    raise exception 'forfeit team % not in match %', p_forfeit_team_id, p_match_id;
  end if;
  if m.stats_applied or m.status = 'finished' then
    raise exception 'match % already finalized', p_match_id;
  end if;

  perform set_config('app.in_end_match', '1', true);

  v_home_score := case when m.home_team_id = p_forfeit_team_id then 0 else 3 end;
  v_away_score := case when m.away_team_id = p_forfeit_team_id then 0 else 3 end;

  if m.home_team_id is not null then
    update public.teams set
      season_stats = public.team_stats_with_result(
        coalesce(season_stats::jsonb, '{}'::jsonb),
        case when v_home_score > v_away_score then 3 else 0 end,
        case when v_home_score > v_away_score then 1 else 0 end,
        0,
        case when v_home_score < v_away_score then 1 else 0 end,
        v_home_score,
        v_away_score
      )
    where id = m.home_team_id;
  end if;

  if m.away_team_id is not null then
    update public.teams set
      season_stats = public.team_stats_with_result(
        coalesce(season_stats::jsonb, '{}'::jsonb),
        case when v_away_score > v_home_score then 3 else 0 end,
        case when v_away_score > v_home_score then 1 else 0 end,
        0,
        case when v_away_score < v_home_score then 1 else 0 end,
        v_away_score,
        v_home_score
      )
    where id = m.away_team_id;
  end if;

  update public.matches set
    home_score = v_home_score,
    away_score = v_away_score,
    status = 'finished',
    is_running = false,
    stats_applied = true, confirmed_by=auth.uid(), confirmed_at=now()
  where id = p_match_id;

  perform public.recompute_team_ranks();
end;
$function$;
CREATE OR REPLACE FUNCTION public.cancel_match_event(p_match_id uuid, p_event_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  m matches%rowtype;
  evt match_events%rowtype;
begin
  perform public.assert_match_recorder(p_match_id, 'correct');
  if not is_referee_or_admin() then
    raise exception 'only referee/admin may cancel match events' using errcode = '42501';
  end if;

  select * into m from matches where id = p_match_id for update;
  if not found then
    raise exception 'match % not found', p_match_id;
  end if;
  if m.status <> 'live' or m.stats_applied then
    raise exception 'match % is not editable (status=%)', p_match_id, m.status;
  end if;

  select * into evt
  from match_events
  where id = p_event_id and match_id = p_match_id
  for update;

  if not found or evt.is_cancelled then
    return;
  end if;

  update match_events set is_cancelled = true where id = p_event_id;

  -- Only reverse expulsions linked to a second yellow; a direct red stays valid.
  if evt.type = 'yellow_card'::match_event_t and (
    select count(*) from match_events
    where match_id = p_match_id and player_id = evt.player_id
      and type = 'yellow_card'::match_event_t and not is_cancelled
  ) < 2 then
    update match_events set is_cancelled = true
    where match_id = p_match_id and player_id = evt.player_id
      and type = 'red_card'::match_event_t and not is_cancelled
      and source_yellow_event_id is not null;
  end if;

  if evt.type = 'goal'::match_event_t then
    update matches set
      home_score = case when evt.team_id = home_team_id then greatest(0, coalesce(home_score, 0) - 1) else home_score end,
      away_score = case when evt.team_id = away_team_id then greatest(0, coalesce(away_score, 0) - 1) else away_score end
    where id = p_match_id;
  end if;
  -- Cancelling a goal also cancels its linked assist; originals remain auditable.
  if evt.type='goal' then
    update match_events set is_cancelled=true where goal_event_id=p_event_id and not is_cancelled;
  elsif evt.type='assist' and evt.goal_event_id is not null then
    update match_events set assist_checked=false where id=evt.goal_event_id;
  end if;
end $function$;
