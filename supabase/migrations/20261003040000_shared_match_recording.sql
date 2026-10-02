-- Shared snapshots retain pending device records while incorporating other writers.
create table public.match_recording_state (
  match_id uuid primary key references public.matches(id) on delete cascade,
  revision bigint not null default 0,
  clock_version integer not null default 0,
  clock_owner_id uuid references auth.users(id) on delete set null,
  clock_device_id text,
  clock_saved_at timestamptz not null default now()
);
alter table public.match_recording_state enable row level security;
revoke all on public.match_recording_state from public, anon, authenticated;

create function public.bump_match_recording_revision() returns trigger
language plpgsql security definer set search_path=public as $$
declare mid uuid; clock_changed boolean := false;
begin
  if TG_TABLE_NAME='matches' then
    mid:=new.id;
    if TG_OP='INSERT' then clock_changed:=true;
    else clock_changed:=new.elapsed_seconds is distinct from old.elapsed_seconds or new.is_running is distinct from old.is_running;
    end if;
  else
    if TG_OP='DELETE' then mid:=old.match_id; else mid:=new.match_id; end if;
  end if;
  perform 1 from public.matches where id=mid for update;
  if found then
    insert into public.match_recording_state(match_id,revision) values(mid,1)
    on conflict(match_id) do update set revision=match_recording_state.revision+1,
      clock_saved_at=case when clock_changed then clock_timestamp() else match_recording_state.clock_saved_at end;
  end if;
  return null;
end $$;
revoke all on function public.bump_match_recording_revision() from public,anon,authenticated;
create trigger match_recording_match_revision after insert or update on public.matches
for each row execute function public.bump_match_recording_revision();
create trigger match_recording_event_revision after insert or update or delete on public.match_events
for each row execute function public.bump_match_recording_revision();
create trigger match_recording_lineup_revision after insert or update or delete on public.match_lineups
for each row execute function public.bump_match_recording_revision();

create or replace function public.get_match_recording_snapshot(p_match_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or not public.is_referee_or_admin() then
    raise exception 'only approved referee/admin may record' using errcode='42501';
  end if;
  -- One SQL statement gives records, acknowledgements and revision the same MVCC view.
  return (select jsonb_build_object(
    'match',to_jsonb(m),'serverRevision',coalesce(s.revision,0),
    'clock',jsonb_build_object('version',coalesce(s.clock_version,0),'ownerId',s.clock_owner_id,
      'deviceId',s.clock_device_id,'ownerName',coalesce(p.name,'')),
    'appliedOperationIds',coalesce((select jsonb_agg(operation_id) from match_recording_receipts where match_id=m.id and actor_id=auth.uid()),'[]'::jsonb),
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
  device text := nullif(p_payload->>'_deviceId','');
begin
  if auth.uid() is null or not public.is_referee_or_admin() then
    raise exception 'only approved referee/admin may record' using errcode='42501';
  end if;
  if p_operation_id is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>8192 then
    raise exception 'invalid recording operation';
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
    if not noop and p_payload ? '_clockVersion' and (p_payload->>'_clockVersion')::integer<>state.clock_version then
      raise exception 'clock control changed; review pending control' using errcode='22023';
    end if;
  end if;
  if noop then
    insert into match_recording_receipts(operation_id,actor_id,match_id,kind,payload)
      values(p_operation_id,auth.uid(),p_match_id,p_kind,p_payload);
    return public.get_match_recording_snapshot(p_match_id);
  end if;
  if m.status in ('finished','cancelled') or m.stats_applied then
    raise exception 'match already closed; review pending records' using errcode='22023';
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
