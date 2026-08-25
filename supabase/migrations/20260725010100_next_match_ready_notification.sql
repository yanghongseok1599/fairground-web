-- 다음 경기 준비 알림.
-- 현재 경기 종료 10분 전, 운영 콘솔이 이 RPC를 호출하면 같은 대회에서
-- 현재 경기 바로 다음 순서의 scheduled 경기 양 팀 승인 선수에게 web push 알림을 만든다.

alter table public.notifications
  add column if not exists match_id uuid references public.matches(id) on delete cascade;

create unique index if not exists notifications_match_ready_once_idx
  on public.notifications(user_id, match_id)
  where kind = 'match_ready'::public.notification_kind_t and match_id is not null;

create index if not exists notifications_match_id_idx
  on public.notifications(match_id);

create or replace function public.notify_next_match_ready(p_match_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $function$
declare
  v_current public.matches%rowtype;
  v_next public.matches%rowtype;
  v_count integer := 0;
begin
  if not public.is_referee_or_admin() then
    raise exception 'only referee/admin may notify next match readiness';
  end if;

  select * into v_current
  from public.matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'match % not found', p_match_id;
  end if;

  if v_current.tournament_id is null then
    return 0;
  end if;

  -- 같은 대회 경기들을 실제 운영 순서로 정렬한 뒤 현재 경기의 다음 경기만 선택한다.
  -- scheduled_at 이 비어 있는 과거 데이터는 created_at 으로 안정 정렬한다.
  with ordered_matches as (
    select
      m.*,
      row_number() over (
        order by
          coalesce(m.scheduled_at, m.created_at) asc,
          m.round asc,
          m.created_at asc,
          m.id asc
      ) as seq
    from public.matches m
    where m.tournament_id = v_current.tournament_id
  ),
  current_order as (
    select seq from ordered_matches where id = p_match_id
  )
  select om.* into v_next
  from ordered_matches om, current_order co
  where om.seq > co.seq
    and om.status = 'scheduled'
  order by om.seq asc
  limit 1;

  if not found or v_next.id is null then
    return 0;
  end if;

  insert into public.notifications (
    user_id,
    kind,
    title,
    snippet,
    actor_id,
    team_id,
    match_id
  )
  select
    p.id,
    'match_ready'::public.notification_kind_t,
    '다음 경기 준비 알림',
    coalesce(v_next.home_team_name, '홈팀') || ' vs ' ||
      coalesce(v_next.away_team_name, '원정팀') ||
      ' 경기가 곧 시작됩니다. 해당 경기장에서 준비해주세요.',
    auth.uid(),
    p.team_id,
    v_next.id
  from public.profiles p
  where coalesce(p.is_approved, false) = true
    and p.team_id in (v_next.home_team_id, v_next.away_team_id)
    and not exists (
      select 1
      from public.notifications n
      where n.user_id = p.id
        and n.kind = 'match_ready'::public.notification_kind_t
        and n.match_id = v_next.id
    )
  on conflict do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

revoke all on function public.notify_next_match_ready(uuid) from public, anon, authenticated;
grant execute on function public.notify_next_match_ready(uuid) to authenticated;

notify pgrst, 'reload schema';
