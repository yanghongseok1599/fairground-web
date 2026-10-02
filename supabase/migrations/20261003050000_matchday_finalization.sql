-- Match-day controls retain final observed time and acknowledge superseded clock actions.
-- This migration changes no historical event, result, profile, or team values.
alter table public.match_recording_receipts add column outcome text not null default 'applied'
  constraint match_recording_receipts_outcome_check check (outcome in ('applied','superseded'));

create or replace function public.get_match_recording_snapshot(p_match_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role in ('referee','admin') and is_approved) then
    raise exception 'only approved referee/admin may record' using errcode='42501';
  end if;
  -- One SQL statement gives records, acknowledgements and revision the same MVCC view.
  return (select jsonb_build_object(
    'match',to_jsonb(m),'serverRevision',coalesce(s.revision,0),
    'clock',jsonb_build_object('version',coalesce(s.clock_version,0),'ownerId',s.clock_owner_id,
      'deviceId',s.clock_device_id,'ownerName',coalesce(p.name,'')),
    'appliedOperationIds',coalesce((select jsonb_agg(operation_id) from match_recording_receipts where match_id=m.id and actor_id=auth.uid()),'[]'::jsonb),
    'supersededOperationIds',coalesce((select jsonb_agg(operation_id) from match_recording_receipts where match_id=m.id and actor_id=auth.uid() and outcome='superseded'),'[]'::jsonb),
    'lineups',coalesce((select jsonb_agg(to_jsonb(l)) from match_lineups l where l.match_id=m.id),'[]'::jsonb),
    'eventOperations',coalesce((select jsonb_object_agg(event_id::text,operation_id::text) from match_recording_receipts where match_id=m.id and actor_id=auth.uid() and event_id is not null and kind='event'),'{}'::jsonb),
    'eventAuthors',coalesce((select jsonb_object_agg(r.event_id::text,jsonb_build_object('id',r.actor_id,'name',coalesce(a.name,'기록자'))) from match_recording_receipts r left join profiles a on a.id=r.actor_id where r.match_id=m.id and r.event_id is not null and r.kind='event'),'{}'::jsonb),
    'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at,e.id) from match_events e where e.match_id=m.id),'[]'::jsonb))
    from matches m left join match_recording_state s on s.match_id=m.id left join profiles p on p.id=s.clock_owner_id where m.id=p_match_id);
end $$;

create or replace function public.apply_match_recording_operation(p_operation_id uuid,p_match_id uuid,p_kind text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  prior public.match_recording_receipts%rowtype;
  m public.matches%rowtype;
  eid uuid;
  state public.match_recording_state%rowtype;
  control boolean;
  noop boolean := false;
  superseded boolean := false;
  observed_seconds integer;
  observed_half integer;
  device text := nullif(p_payload->>'_deviceId','');
begin
  if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role in ('referee','admin') and is_approved) then
    raise exception 'only approved referee/admin may record' using errcode='42501';
  end if;
  if p_operation_id is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>8192 then
    raise exception 'invalid recording operation';
  end if;
  -- All finalizers take this lock before operation and match row locks.
  -- This prevents two matches holding different team rows while recomputing ranks.
  if p_kind in ('end','forfeit') then
    perform pg_advisory_xact_lock(hashtextextended('fairground-match-finalization',0));
  end if;
  -- Serialize even conflicting uses of an ID across matches before taking the row lock.
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,0));
  select * into prior from public.match_recording_receipts where operation_id=p_operation_id;
  if found then
    if prior.actor_id<>auth.uid() or prior.match_id<>p_match_id or prior.kind<>p_kind or prior.payload<>p_payload then
      raise exception 'recording operation ID conflict' using errcode='22023';
    end if;
    return public.get_match_recording_snapshot(p_match_id);
  end if;
  select * into m from public.matches where id=p_match_id for update;
  if not found then raise exception 'match not found'; end if;
  insert into match_recording_state(match_id) values(p_match_id) on conflict do nothing;
  select * into state from match_recording_state where match_id=p_match_id for update;
  control:=p_kind in ('start','pause','resume','end','forfeit');
  -- An old clock writer must not resurrect or advance a transferred/paused clock.
  if p_kind='timer' and (m.status<>'live' or not m.is_running or
    (state.clock_owner_id is not null and (state.clock_owner_id<>auth.uid() or state.clock_device_id is distinct from device)) or
    (p_payload ? '_clockVersion' and (p_payload->>'_clockVersion')::integer<>state.clock_version)) then
    noop:=true;
  end if;
  if control then
    noop:=(p_kind='start' and m.status='live') or (p_kind='pause' and m.status='live' and not m.is_running)
      or (p_kind='resume' and m.status='live' and m.is_running) or (p_kind='end' and m.status='finished');
    if p_payload ? '_clockVersion' and (p_payload->>'_clockVersion')::integer<>state.clock_version then
      if p_kind in ('pause','resume') then
        -- Preserve the original operation as superseded and let later records sync.
        -- A delayed device must not undo a newer operator's clock decision.
        noop:=true; superseded:=true;
      elsif not noop then
        raise exception 'clock control changed; review pending control' using errcode='22023';
      end if;
    end if;
  end if;
  if noop then
    insert into match_recording_receipts(operation_id,actor_id,match_id,kind,payload,outcome)
      values(p_operation_id,auth.uid(),p_match_id,p_kind,p_payload,case when superseded then 'superseded' else 'applied' end);
    return public.get_match_recording_snapshot(p_match_id);
  end if;
  if m.status in ('finished','cancelled') or m.stats_applied then
    raise exception 'match already closed; review pending records' using errcode='22023';
  end if;
  if p_kind in ('pause','end') and p_payload ? '_elapsedSeconds' then
    observed_seconds:=(p_payload->>'_elapsedSeconds')::integer;
    observed_half:=(p_payload->>'_half')::integer;
    if observed_seconds is null or observed_seconds not between 0 and 720 or observed_half is null or observed_half not in (1,2) then
      raise exception 'invalid observed match clock' using errcode='22023';
    end if;
    -- Explicit approved operator takeover keeps the last visible seconds.
    -- Periodic timer ownership remains unchanged.
    perform public.update_match_timer(p_match_id,greatest(m.elapsed_seconds,observed_seconds),greatest(m.current_half,observed_half));
  end if;
  case p_kind
    when 'start' then
      if m.status<>'scheduled' then raise exception 'match already started; review pending records' using errcode='22023'; end if;
      perform public.start_match(p_match_id);
    when 'pause' then perform public.pause_match(p_match_id);
    when 'resume' then
      if m.elapsed_seconds>=720 then raise exception 'regulation time completed'; end if;
      perform public.resume_match(p_match_id);
    when 'timer' then
      perform public.update_match_timer(p_match_id,greatest(m.elapsed_seconds,(p_payload->>'seconds')::integer),(p_payload->>'half')::integer);
    when 'event' then
      eid:=public.add_match_event(p_match_id,(p_payload->>'type')::public.match_event_t,(p_payload->>'playerId')::uuid,
        p_payload->>'playerName',(p_payload->>'teamId')::uuid,(p_payload->>'minute')::integer,(p_payload->>'half')::integer);
    when 'cancel' then
      if p_payload ? 'eventOperationId' then
        select event_id into eid from public.match_recording_receipts
          where operation_id=(p_payload->>'eventOperationId')::uuid and match_id=p_match_id and kind='event' and actor_id=auth.uid();
      else eid:=(p_payload->>'eventId')::uuid; end if;
      if eid is null or not exists(select 1 from public.match_events where id=eid and match_id=p_match_id) then
        raise exception 'event not found in match';
      end if;
      perform public.cancel_match_event(p_match_id,eid);
    when 'mom' then perform public.set_match_mom(p_match_id,(p_payload->>'playerId')::uuid);
    when 'end' then perform public.end_match(p_match_id);
    when 'forfeit' then perform public.forfeit_match(p_match_id,(p_payload->>'teamId')::uuid);
    when 'substitute' then perform public.substitute_player(p_match_id,(p_payload->>'teamId')::uuid,(p_payload->>'outId')::uuid,
      (p_payload->>'inId')::uuid,p_payload->>'inName',(p_payload->>'minute')::integer,(p_payload->>'half')::integer);
    else raise exception 'unknown recording operation';
  end case;
  if control then
    update match_recording_state set clock_version=clock_version+1,clock_owner_id=auth.uid(),clock_device_id=device,
      revision=revision+1 where match_id=p_match_id;
  end if;
  insert into public.match_recording_receipts(operation_id,actor_id,match_id,kind,payload,event_id)
    values(p_operation_id,auth.uid(),p_match_id,p_kind,p_payload,eid);
  return public.get_match_recording_snapshot(p_match_id);
end $$;
revoke all on function public.apply_match_recording_operation(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.apply_match_recording_operation(uuid,uuid,text,jsonb) to authenticated;

-- Existing finalization body preserved except consistent lock ordering.
CREATE OR REPLACE FUNCTION public.end_match(p_match_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  m public.matches%rowtype;
  r record;
  has_lineup boolean;
  team_record record;
  prev_match_id uuid;
  current_player uuid;
  home_points integer;
  away_points integer;
  home_wins integer;
  away_wins integer;
  home_draws integer;
  away_draws integer;
  home_losses integer;
  away_losses integer;
begin
  if not public.is_referee_or_admin() then
    raise exception 'only referee/admin may end a match' using errcode = '42501';
  end if;

  -- Match lock must follow the shared finalization lock (also acquired by outbox).
  perform pg_advisory_xact_lock(hashtextextended('fairground-match-finalization',0));
  select * into m from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'match % not found', p_match_id;
  end if;
  if m.stats_applied or m.status = 'finished' then
    return;
  end if;
  if m.status <> 'live' then
    raise exception 'match % must be live before finalization', p_match_id;
  end if;

  perform set_config('app.in_end_match', '1', true);

  select exists(select 1 from public.match_lineups where match_id = p_match_id) into has_lineup;

  if has_lineup then
    for r in
      select ml.player_id,
             coalesce(stat.g, 0) as g,
             coalesce(stat.a, 0) as a,
             coalesce(stat.y, 0) as y,
             (m.mom_player_id is not null and m.mom_player_id = ml.player_id) as got_mom
      from public.match_lineups ml
      left join (
        select e.player_id,
               (count(*) filter (where e.type = 'goal'))::integer        as g,
               (count(*) filter (where e.type = 'assist'))::integer      as a,
               (count(*) filter (where e.type = 'yellow_card'))::integer as y
        from public.match_events e
        where e.match_id = p_match_id and not e.is_cancelled and e.player_id is not null
        group by e.player_id
      ) stat on stat.player_id = ml.player_id
      where ml.match_id = p_match_id
    loop
      update public.profiles set
        games = games + 1,
        goals = goals + r.g,
        assists = assists + r.a,
        mom = mom + (case when r.got_mom then 1 else 0 end),
        card_rating = public.compute_card_rating(
          goals + r.g,
          assists + r.a,
          mom + (case when r.got_mom then 1 else 0 end)
        ),
        season_yellow_cards = season_yellow_cards + r.y
      where id = r.player_id;
    end loop;

    if m.tournament_id is not null then
      for team_record in
        select unnest(array[m.home_team_id, m.away_team_id]) as team_id
      loop
        if team_record.team_id is null then continue; end if;

        select id into prev_match_id from public.matches
          where tournament_id = m.tournament_id
            and (home_team_id = team_record.team_id or away_team_id = team_record.team_id)
            and status = 'finished'
            and id <> p_match_id
          order by created_at desc
          limit 1;

        if prev_match_id is not null then
          for current_player in
            select player_id from public.match_lineups
            where match_id = prev_match_id and team_id = team_record.team_id
              and player_id not in (
                select player_id from public.match_lineups
                where match_id = p_match_id and team_id = team_record.team_id
              )
          loop
            update public.profiles set attendance_streak = 0
            where id = current_player and attendance_streak > 0;
          end loop;
        end if;

        for current_player in
          select player_id from public.match_lineups
          where match_id = p_match_id and team_id = team_record.team_id
        loop
          update public.profiles set
            attendance_streak = attendance_streak + 1,
            attendance_streak_best = greatest(attendance_streak_best, attendance_streak + 1)
          where id = current_player;
        end loop;
      end loop;
    end if;
  else
    for r in
      select participants.player_id,
             (count(*) filter (where e.type = 'goal'))::integer as g,
             (count(*) filter (where e.type = 'assist'))::integer as a,
             (count(*) filter (where e.type = 'yellow_card'))::integer as y,
             coalesce(participants.player_id = m.mom_player_id, false) as got_mom
      from (
        select player_id from public.match_events
        where match_id = p_match_id and not is_cancelled and player_id is not null
        union
        select m.mom_player_id where m.mom_player_id is not null
      ) participants
      left join public.match_events e
        on e.match_id = p_match_id and e.player_id = participants.player_id and not e.is_cancelled
      group by participants.player_id
    loop
      update public.profiles set
        games = games + 1,
        goals = goals + r.g,
        assists = assists + r.a,
        mom = mom + (case when r.got_mom then 1 else 0 end),
        card_rating = public.compute_card_rating(
          goals + r.g,
          assists + r.a,
          mom + (case when r.got_mom then 1 else 0 end)
        ),
        season_yellow_cards = season_yellow_cards + r.y
      where id = r.player_id;
    end loop;
  end if;

  home_points := case
    when m.home_score > m.away_score then 3
    when m.home_score = m.away_score then 1
    else 0
  end;
  away_points := case
    when m.away_score > m.home_score then 3
    when m.away_score = m.home_score then 1
    else 0
  end;
  home_wins := case when m.home_score > m.away_score then 1 else 0 end;
  away_wins := case when m.away_score > m.home_score then 1 else 0 end;
  home_draws := case when m.home_score = m.away_score then 1 else 0 end;
  away_draws := home_draws;
  home_losses := case when m.home_score < m.away_score then 1 else 0 end;
  away_losses := case when m.away_score < m.home_score then 1 else 0 end;

  if m.home_team_id is not null then
    update public.teams set
      season_stats = public.team_stats_with_result(
        coalesce(season_stats::jsonb, '{}'::jsonb),
        home_points,
        home_wins,
        home_draws,
        home_losses,
        m.home_score,
        m.away_score
      )
    where id = m.home_team_id;
  end if;

  if m.away_team_id is not null then
    update public.teams set
      season_stats = public.team_stats_with_result(
        coalesce(season_stats::jsonb, '{}'::jsonb),
        away_points,
        away_wins,
        away_draws,
        away_losses,
        m.away_score,
        m.home_score
      )
    where id = m.away_team_id;
  end if;

  for current_player in
    select distinct e.player_id
    from public.match_events e
    where e.match_id = p_match_id and not e.is_cancelled
      and e.type = 'red_card' and e.player_id is not null
  loop
    update public.profiles set
      ban_matches_remaining = ban_matches_remaining + 2,
      is_banned = true
    where id = current_player;
  end loop;

  for current_player in
    select distinct e.player_id
    from public.match_events e
    where e.match_id = p_match_id and not e.is_cancelled
      and e.type = 'yellow_card' and e.player_id is not null
  loop
    update public.profiles set
      ban_matches_remaining = ban_matches_remaining + (season_yellow_cards / 5),
      is_banned = case when (ban_matches_remaining + (season_yellow_cards / 5)) > 0 then true else is_banned end,
      season_yellow_cards = season_yellow_cards % 5
    where id = current_player and season_yellow_cards >= 5;
  end loop;

  if has_lineup then
    for current_player in
      select p.id from public.profiles p
      where p.team_id in (m.home_team_id, m.away_team_id)
        and p.ban_matches_remaining > 0
        and p.id not in (select player_id from public.match_lineups where match_id = p_match_id)
    loop
      update public.profiles set
        ban_matches_remaining = greatest(0, ban_matches_remaining - 1),
        is_banned = (ban_matches_remaining - 1) > 0
      where id = current_player;
    end loop;
  end if;

  update public.matches set
    status = 'finished',
    is_running = false,
    stats_applied = true
  where id = p_match_id;

  perform public.recompute_team_ranks();
end;
$function$
;

-- Existing finalization body preserved except consistent lock ordering.
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
  if not public.is_referee_or_admin() then
    raise exception 'only referee/admin may forfeit a match' using errcode = '42501';
  end if;

  -- Match lock must follow the shared finalization lock (also acquired by outbox).
  perform pg_advisory_xact_lock(hashtextextended('fairground-match-finalization',0));
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
    stats_applied = true
  where id = p_match_id;

  perform public.recompute_team_ranks();
end;
$function$
;

notify pgrst, 'reload schema';
