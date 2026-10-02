-- Durable client commands use a receipt in the SAME transaction as the match write.
create table public.match_recording_receipts (
  operation_id uuid primary key,
  actor_id uuid not null references auth.users(id),
  match_id uuid not null references public.matches(id),
  kind text not null,
  payload jsonb not null,
  event_id uuid,
  created_at timestamptz not null default now()
);
alter table public.match_recording_receipts enable row level security;
revoke all on public.match_recording_receipts from public, anon, authenticated;
create index match_recording_receipts_match_idx on public.match_recording_receipts(match_id);

create function public.get_match_recording_snapshot(p_match_id uuid) returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_referee_or_admin() then
    raise exception 'only approved referee/admin may record' using errcode='42501';
  end if;
  return (select jsonb_build_object('match',to_jsonb(m),'lineups',coalesce((select jsonb_agg(to_jsonb(l)) from public.match_lineups l where l.match_id=m.id),'[]'::jsonb),'eventOperations',coalesce((select jsonb_object_agg(event_id::text,operation_id::text) from public.match_recording_receipts where match_id=m.id and actor_id=auth.uid() and event_id is not null and kind='event'),'{}'::jsonb),'events',
    coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at,e.id) from public.match_events e where e.match_id=m.id),'[]'::jsonb))
    from public.matches m where m.id=p_match_id);
end $$;
revoke all on function public.get_match_recording_snapshot(uuid) from public,anon;
grant execute on function public.get_match_recording_snapshot(uuid) to authenticated;

create function public.apply_match_recording_operation(p_operation_id uuid,p_match_id uuid,p_kind text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  prior public.match_recording_receipts%rowtype;
  m public.matches%rowtype;
  eid uuid;
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
  insert into public.match_recording_receipts(operation_id,actor_id,match_id,kind,payload,event_id)
    values(p_operation_id,auth.uid(),p_match_id,p_kind,p_payload,eid);
  return public.get_match_recording_snapshot(p_match_id);
end $$;
revoke all on function public.apply_match_recording_operation(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.apply_match_recording_operation(uuid,uuid,text,jsonb) to authenticated;
