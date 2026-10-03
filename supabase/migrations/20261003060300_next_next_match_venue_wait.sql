-- Add a separate five-minute venue-wait notice for the fixture after the next.
-- Preserve the existing start/five-minute notices, scheduler, trigger and ACLs.
alter table public.notifications
  drop constraint notifications_ready_stage_check,
  add constraint notifications_ready_stage_check
    check (ready_stage is null or ready_stage in ('start', 'five_minutes', 'venue_wait'));

create or replace function public.emit_next_match_ready(p_match_id uuid, p_stage text)
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
  if p_stage is null or p_stage not in ('start', 'five_minutes', 'venue_wait') then
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
  if elapsed >= 720 or (p_stage in ('five_minutes', 'venue_wait') and elapsed < 420) then
    return 0;
  end if;

  -- The current single-court competition uses the established stable order.
  -- Only later scheduled fixtures count; cancelled/finished/live games do not.
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
    order by ordered.seq limit 1 offset (case when p_stage = 'venue_wait' then 1 else 0 end);
  if not found then return 0; end if;

  insert into public.notifications
    (user_id, kind, title, snippet, actor_id, team_id, match_id, ready_stage)
  select p.id, 'match_ready'::public.notification_kind_t,
    case p_stage
      when 'start' then '다음 경기 준비 안내'
      when 'five_minutes' then '경기 종료 5분 전 · 다음 팀 준비'
      else '다다음 경기 팀 · 구장 대기'
    end,
    case p_stage
      when 'venue_wait' then
        '현재 경기 종료까지 5분 이내입니다. 다다음 경기 ' ||
        coalesce(next_match.home_team_name, '홈팀') || ' vs ' ||
        coalesce(next_match.away_team_name, '원정팀') ||
        ' 선수들은 지금 구장 앞으로 이동해 대기해주세요.'
      else
        case p_stage
          when 'start' then '현재 경기가 시작되었습니다. 다음 경기 '
          else '현재 경기 종료까지 5분 이내입니다. 다음 경기 '
        end || coalesce(next_match.home_team_name, '홈팀') || ' vs ' ||
          coalesce(next_match.away_team_name, '원정팀') ||
          ' 선수들은 경기장 앞에서 장비를 확인하고 준비해주세요.'
    end,
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

create or replace function public.notify_next_match_ready_on_clock()
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
    perform public.emit_next_match_ready(new.id, 'venue_wait');
  end if;
  return null;
exception when others then
  -- Failed notices cannot reject clock updates or match finalization. The
  -- scheduled dispatcher retries the missing stages without changing clocks.
  raise warning 'next-match notice trigger failed (SQLSTATE %)', sqlstate;
  return null;
end;
$function$;

create or replace function public.dispatch_due_next_match_ready()
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_match record;
  inserted integer := 0;
  batch_count integer;
begin
  for current_match in
    select m.id from public.matches m
    where m.status = 'live' and not m.stats_applied
      and m.tournament_id is not null and m.elapsed_seconds < 720
    order by m.id
    for update of m skip locked
  loop
    begin
      batch_count := public.emit_next_match_ready(current_match.id, 'start');
      batch_count := batch_count + public.emit_next_match_ready(current_match.id, 'five_minutes');
      batch_count := batch_count + public.emit_next_match_ready(current_match.id, 'venue_wait');
      -- Increment only after all stages succeed: a failed batch rolls back its
      -- rows, whereas PL/pgSQL variables are not themselves rolled back.
      inserted := inserted + batch_count;
    exception when others then
      raise warning 'next-match notice dispatcher failed (SQLSTATE %)', sqlstate;
    end;
  end loop;
  return inserted;
end;
$function$;

notify pgrst, 'reload schema';
