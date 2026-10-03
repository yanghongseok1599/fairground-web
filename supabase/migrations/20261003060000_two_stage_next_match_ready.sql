-- Automatic next-team notices use the same clock and notification delivery
-- path as match recording. Existing notification rows and match values stay intact.
alter table public.notifications
  add column ready_stage text,
  add constraint notifications_ready_stage_check
    check (ready_stage is null or ready_stage in ('start', 'five_minutes'));

drop index public.notifications_match_ready_once_idx;
create unique index notifications_match_ready_once_idx
  on public.notifications (user_id, match_id, (coalesce(ready_stage, 'start')))
  where kind = 'match_ready'::public.notification_kind_t and match_id is not null;

-- Internal only: callers hold/reacquire the current match row lock before
-- selecting the next fixture, so timer writes and scheduled checks serialize.
create function public.emit_next_match_ready(p_match_id uuid, p_stage text)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_match public.matches%rowtype;
  next_match public.matches%rowtype;
  saved_at timestamptz;
  elapsed integer;
  inserted integer := 0;
begin
  if p_stage is null or p_stage not in ('start', 'five_minutes') then
    raise exception 'invalid next-match notice stage' using errcode = '22023';
  end if;

  select * into current_match from public.matches where id = p_match_id for update;
  if not found or current_match.status <> 'live' or current_match.stats_applied
    or current_match.tournament_id is null then
    return 0;
  end if;

  elapsed := greatest(0, current_match.elapsed_seconds);
  if current_match.is_running then
    select s.clock_saved_at into saved_at
      from public.match_recording_state s where s.match_id = p_match_id;
    if saved_at is not null then
      elapsed := least(720, elapsed + greatest(0,
        floor(extract(epoch from (clock_timestamp() - saved_at)))::integer));
    end if;
  end if;
  if elapsed >= 720 or (p_stage = 'five_minutes' and elapsed < 420) then
    return 0;
  end if;

  -- Keep the established ordering for the single-court competition. Cancelled,
  -- finished and already-live fixtures cannot become the next waiting teams.
  with ordered_matches as (
    select m.*, row_number() over (order by
      coalesce(m.scheduled_at, m.created_at), m.round, m.created_at, m.id) as seq
    from public.matches m where m.tournament_id = current_match.tournament_id
  ), current_order as (
    select seq from ordered_matches where id = p_match_id
  )
  select ordered.* into next_match
    from ordered_matches ordered, current_order current_position
    where ordered.seq > current_position.seq and ordered.status = 'scheduled'
    order by ordered.seq limit 1;
  if not found then return 0; end if;

  insert into public.notifications
    (user_id, kind, title, snippet, actor_id, team_id, match_id, ready_stage)
  select p.id, 'match_ready'::public.notification_kind_t,
    case p_stage when 'start' then '다음 경기 준비 안내' else '다음 경기 5분 전 안내' end,
    case p_stage
      when 'start' then '현재 경기가 시작되었습니다. 다음 경기 '
      else '현재 경기 종료까지 5분 이내입니다. 다음 경기 '
    end || coalesce(next_match.home_team_name, '홈팀') || ' vs ' ||
      coalesce(next_match.away_team_name, '원정팀') ||
      ' 선수들은 경기장 앞에서 장비를 확인하고 준비해주세요.',
    auth.uid(), p.team_id, next_match.id, p_stage
  from public.profiles p
  join public.teams team on team.id = p.team_id and team.is_approved = true
  where p.is_approved = true and p.role in ('player', 'captain')
    and p.team_id in (next_match.home_team_id, next_match.away_team_id)
  on conflict do nothing;
  get diagnostics inserted = row_count;
  return inserted;
end;
$function$;
revoke all on function public.emit_next_match_ready(uuid, text)
  from public, anon, authenticated, service_role;

-- Old consoles may still call this RPC after two minutes. It shares the start
-- stage key with the automatic notice and cannot send an extra first notice.
create or replace function public.notify_next_match_ready(p_match_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_approved = true and p.role in ('referee', 'admin')
  ) then
    raise exception 'only approved referee/admin may notify next match readiness'
      using errcode = '42501';
  end if;
  return public.emit_next_match_ready(p_match_id, 'start');
end;
$function$;
revoke all on function public.notify_next_match_ready(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.notify_next_match_ready(uuid) to authenticated;

create function public.notify_next_match_ready_on_clock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.status = 'scheduled' and new.status = 'live' then
    perform public.emit_next_match_ready(new.id, 'start');
  end if;
  if new.status = 'live' and not new.stats_applied
    and new.elapsed_seconds >= 420 and new.elapsed_seconds < 720 then
    perform public.emit_next_match_ready(new.id, 'five_minutes');
  end if;
  return null;
exception when others then
  -- A notice failure cannot reject a valid kickoff, clock save or match result.
  -- The scheduled dispatcher retries unrecorded stages on its next run.
  raise warning 'next-match notice trigger failed (SQLSTATE %)', sqlstate;
  return null;
end;
$function$;
revoke all on function public.notify_next_match_ready_on_clock()
  from public, anon, authenticated, service_role;
create trigger next_match_ready_after_clock
  after update of status, elapsed_seconds, is_running on public.matches
  for each row execute function public.notify_next_match_ready_on_clock();

-- A DB scheduler calls this without an open referee browser. No match/clock
-- updates are performed; row locks avoid racing a pause, finalization or timer.
create function public.dispatch_due_next_match_ready()
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_match record;
  inserted integer := 0;
begin
  for current_match in
    select m.id from public.matches m
    where m.status = 'live' and not m.stats_applied
      and m.tournament_id is not null and m.elapsed_seconds < 720
    order by m.id
    for update of m skip locked
  loop
    begin
      inserted := inserted + public.emit_next_match_ready(current_match.id, 'start');
      inserted := inserted + public.emit_next_match_ready(current_match.id, 'five_minutes');
    exception when others then
      raise warning 'next-match notice dispatcher failed (SQLSTATE %)', sqlstate;
    end;
  end loop;
  return inserted;
end;
$function$;
revoke all on function public.dispatch_due_next_match_ready()
  from public, anon, authenticated, service_role;

notify pgrst, 'reload schema';
