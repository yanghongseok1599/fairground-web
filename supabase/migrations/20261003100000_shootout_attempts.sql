-- Per-kick shootout history is independent of regulation events and statistics.
-- Legacy totals retain NULL histories; historical kicks must never be inferred.
alter table public.matches
  add column home_shootout_attempts jsonb,
  add column away_shootout_attempts jsonb,
  drop constraint matches_shootout_score_check;

alter table public.matches
  add constraint matches_shootout_score_check check (
    (home_shootout_score is null and away_shootout_score is null and
     home_shootout_attempts is null and away_shootout_attempts is null) or
    (home_shootout_score is not null and away_shootout_score is not null and
     home_shootout_score between 0 and 99 and away_shootout_score between 0 and 99 and
     ((home_shootout_attempts is null and away_shootout_attempts is null and
       home_shootout_score<>away_shootout_score) or
      (home_shootout_attempts is not null and away_shootout_attempts is not null and
       (status<>'finished' or home_shootout_score<>away_shootout_score))))
  ),
  add constraint matches_shootout_attempts_check check (
    case
      when home_shootout_attempts is null and away_shootout_attempts is null then true
      when jsonb_typeof(home_shootout_attempts)='array' and jsonb_typeof(away_shootout_attempts)='array' then
        jsonb_array_length(home_shootout_attempts)<=99 and jsonb_array_length(away_shootout_attempts)<=99 and
        jsonb_array_length(home_shootout_attempts)+jsonb_array_length(away_shootout_attempts)>0 and
        not jsonb_path_exists(home_shootout_attempts,'strict $[*] ? (@.type() != "boolean")') and
        not jsonb_path_exists(away_shootout_attempts,'strict $[*] ? (@.type() != "boolean")') and
        home_shootout_score=jsonb_array_length(jsonb_path_query_array(home_shootout_attempts,'strict $[*] ? (@ == true)')) and
        away_shootout_score=jsonb_array_length(jsonb_path_query_array(away_shootout_attempts,'strict $[*] ? (@ == true)'))
      else false
    end
  );

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
  shootout_home integer;
  shootout_away integer;
  shootout_attempts boolean;
  home_attempts jsonb;
  away_attempts jsonb;
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
  if m.status='cancelled' or (p_kind<>'shootout' and (m.status='finished' or m.stats_applied)) then
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
    when 'shootout' then
      if m.group_id is not null or coalesce(m.round,0)<13 or m.status not in ('live','finished') or m.home_score<>m.away_score then
        raise exception 'shootout is only available for tied placement matches' using errcode='22023';
      end if;
      if m.status='live' and m.is_running then
        raise exception 'pause the match before recording shootout' using errcode='22023';
      end if;
      if jsonb_typeof(p_payload->'homeScore') is distinct from 'number' or
         jsonb_typeof(p_payload->'awayScore') is distinct from 'number' or
         coalesce(p_payload->>'homeScore','') !~ '^[0-9]{1,2}$' or
         coalesce(p_payload->>'awayScore','') !~ '^[0-9]{1,2}$' then
        raise exception 'shootout scores must be integers from 0 to 99' using errcode='22023';
      end if;
      shootout_home:=(p_payload->>'homeScore')::integer;
      shootout_away:=(p_payload->>'awayScore')::integer;
      shootout_attempts:=p_payload ? 'homeAttempts' or p_payload ? 'awayAttempts';
      if shootout_attempts then
        home_attempts:=p_payload->'homeAttempts';
        away_attempts:=p_payload->'awayAttempts';
        if jsonb_typeof(home_attempts) is distinct from 'array' or
           jsonb_typeof(away_attempts) is distinct from 'array' then
          raise exception 'shootout attempts must be two boolean arrays' using errcode='22023';
        end if;
        if jsonb_array_length(home_attempts)+jsonb_array_length(away_attempts)=0 then
          raise exception 'shootout attempts require at least one recorded kick' using errcode='22023';
        end if;
        if jsonb_array_length(home_attempts)>99 or jsonb_array_length(away_attempts)>99 or
           jsonb_path_exists(home_attempts,'strict $[*] ? (@.type() != "boolean")') or
           jsonb_path_exists(away_attempts,'strict $[*] ? (@.type() != "boolean")') then
          raise exception 'shootout attempts must contain at most 99 goal/no-goal values' using errcode='22023';
        end if;
        if shootout_home<>jsonb_array_length(jsonb_path_query_array(home_attempts,'strict $[*] ? (@ == true)')) or
           shootout_away<>jsonb_array_length(jsonb_path_query_array(away_attempts,'strict $[*] ? (@ == true)')) then
          raise exception 'shootout scores must match recorded attempts' using errcode='22023';
        end if;
        if not (p_payload ? '_shootoutHomeAttemptsBefore' and p_payload ? '_shootoutAwayAttemptsBefore') then
          raise exception 'shootout previous scores required; review pending result' using errcode='22023';
        end if;
        if p_payload->'_shootoutHomeAttemptsBefore' is distinct from coalesce(m.home_shootout_attempts,'null'::jsonb) or
           p_payload->'_shootoutAwayAttemptsBefore' is distinct from coalesce(m.away_shootout_attempts,'null'::jsonb) then
          raise exception 'shootout result changed; review pending result' using errcode='22023';
        end if;
      elsif m.home_shootout_attempts is not null or m.away_shootout_attempts is not null then
        -- An older pending totals-only command cannot erase a newer attempt history.
        -- Already-applied UUID replays returned above remain compatible.
        raise exception 'shootout result changed; review pending result' using errcode='22023';
      end if;
      if shootout_home=shootout_away and (not shootout_attempts or m.status='finished') then
        raise exception 'shootout result must determine a winner' using errcode='22023';
      end if;
      if jsonb_typeof(p_payload->'_shootoutHomeBefore') is distinct from 'number' or
         jsonb_typeof(p_payload->'_shootoutAwayBefore') is distinct from 'number' or
         coalesce(p_payload->>'_shootoutHomeBefore','') !~ '^(-1|[0-9]{1,2})$' or
         coalesce(p_payload->>'_shootoutAwayBefore','') !~ '^(-1|[0-9]{1,2})$' then
        raise exception 'shootout previous scores required; review pending result' using errcode='22023';
      end if;
      if (p_payload->>'_shootoutHomeBefore')::integer<>coalesce(m.home_shootout_score,-1) or
         (p_payload->>'_shootoutAwayBefore')::integer<>coalesce(m.away_shootout_score,-1) or
         (p_payload ? '_serverRevision' and (p_payload->>'_serverRevision')::bigint<>state.revision) then
        raise exception 'shootout result changed; review pending result' using errcode='22023';
      end if;
      update public.matches set home_shootout_score=shootout_home,away_shootout_score=shootout_away,
        home_shootout_attempts=case when shootout_attempts then home_attempts else home_shootout_attempts end,
        away_shootout_attempts=case when shootout_attempts then away_attempts else away_shootout_attempts end
      where id=p_match_id;
    when 'end' then
      if m.group_id is null and coalesce(m.round,0)>=13 and m.home_score=m.away_score and
         (m.home_shootout_score is null or m.away_shootout_score is null or m.home_shootout_score=m.away_shootout_score) then
        raise exception '동점 경기입니다. 승부차기 결과를 저장한 뒤 종료해 주세요.' using errcode='22023';
      end if;
      perform public.end_match(p_match_id);
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

notify pgrst, 'reload schema';
