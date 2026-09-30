-- Event-day identity checks are independent of account approval and match records.
create table public.player_inspections (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  checked_at timestamptz,
  checked_by uuid references public.profiles(id) on delete set null,
  revision integer not null check (revision > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  primary key (tournament_id, player_id)
);
alter table public.player_inspections enable row level security;
-- All access goes through scoped RPCs; clients cannot forge check times/actors.
revoke all on public.player_inspections from public, anon, authenticated;
create index player_inspections_player_idx on public.player_inspections(player_id);

-- Before group assignment, all approved teams are in scope (same as entry fees).
-- Once any teams are assigned, use only those teams, never an unrelated roster.
create function public.inspection_team_in_scope(p_groups jsonb, p_team_id uuid)
returns boolean language sql immutable set search_path = '' as $$
  select not exists (
    select 1 from jsonb_array_elements(coalesce(p_groups, '[]'::jsonb)) g,
      jsonb_array_elements_text(coalesce(g->'teamIds', '[]'::jsonb)) ids
  ) or exists (
    select 1 from jsonb_array_elements(coalesce(p_groups, '[]'::jsonb)) g,
      jsonb_array_elements_text(coalesce(g->'teamIds', '[]'::jsonb)) ids
    where ids = p_team_id::text
  );
$$;
revoke all on function public.inspection_team_in_scope(jsonb, uuid) from public, anon, authenticated;

create function public.get_admin_player_inspections(p_tournament_id uuid)
returns table (
  player_id uuid, name text, number integer, number_label text,
  team_id uuid, team_name text, birth_date text, is_approved boolean,
  has_player_experience boolean, checked_at timestamptz,
  checked_by_name text, revision integer
)
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception '관리자만 검인 명단을 조회할 수 있습니다.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.tournaments where id = p_tournament_id) then
    raise exception '대회를 찾을 수 없습니다.';
  end if;
  return query
  select p.id, p.name, p.number, p.number_label, tm.id, tm.name,
    p.birth_date::text, p.is_approved, coalesce(p.has_player_experience, false),
    case when p.is_approved and not coalesce(p.has_player_experience, false) and i.team_id = p.team_id then i.checked_at end,
    actor.name, coalesce(i.revision, 0)
  from public.tournaments t
  join public.teams tm on tm.is_approved and public.inspection_team_in_scope(t.groups, tm.id)
  join public.profiles p on p.team_id = tm.id and p.role in ('player', 'captain')
  left join public.player_inspections i on i.tournament_id = t.id and i.player_id = p.id
  left join public.profiles actor on actor.id = i.checked_by
  where t.id = p_tournament_id
  order by tm.name, p.name, p.id;
end;
$$;

create function public.get_my_player_inspections()
returns table (
  tournament_id uuid, tournament_name text, tournament_date text,
  tournament_status text, team_name text, checked_at timestamptz
)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  return query
  select t.id, t.name, t.date::text, t.status::text, tm.name,
    case when p.is_approved and not coalesce(p.has_player_experience, false) and i.team_id = p.team_id then i.checked_at end
  from public.profiles p
  join public.teams tm on tm.id = p.team_id and tm.is_approved
  join public.tournaments t on public.inspection_team_in_scope(t.groups, tm.id)
  left join public.player_inspections i on i.tournament_id = t.id and i.player_id = p.id
  where p.id = auth.uid() and p.role in ('player', 'captain')
    and (t.status <> 'completed' or i.checked_at is not null)
  order by (t.status = 'ongoing') desc, t.created_at desc, t.id;
end;
$$;

create function public.set_player_inspection(
  p_tournament_id uuid, p_player_id uuid, p_checked boolean, p_expected_revision integer
)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_player public.profiles%rowtype;
  v_tournament public.tournaments%rowtype;
  v_revision integer;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception '관리자만 선수검인을 처리할 수 있습니다.' using errcode = '42501';
  end if;
  if p_checked is null or p_expected_revision is null or p_expected_revision < 0 then
    raise exception '검인 요청을 확인해주세요.';
  end if;
  select * into v_tournament from public.tournaments where id = p_tournament_id for share;
  if not found then raise exception '대회를 찾을 수 없습니다.'; end if;
  select * into v_player from public.profiles where id = p_player_id for share;
  if not found then raise exception '선수를 찾을 수 없습니다.'; end if;
  if v_player.team_id is null or v_player.role not in ('player', 'captain')
    or not public.inspection_team_in_scope(v_tournament.groups, v_player.team_id)
    or not exists (select 1 from public.teams where id = v_player.team_id and is_approved) then
    raise exception '해당 대회의 참가팀 소속 선수만 검인할 수 있습니다.';
  end if;
  if p_checked and (not v_player.is_approved or coalesce(v_player.has_player_experience, false)) then
    raise exception '가입 승인과 참가 자격을 먼저 확인해주세요.';
  end if;
  -- Serialize even the first insert. A stale operator cannot overwrite another.
  perform pg_advisory_xact_lock(hashtextextended(p_tournament_id::text || p_player_id::text, 0));
  select revision into v_revision from public.player_inspections
    where tournament_id = p_tournament_id and player_id = p_player_id;
  v_revision := coalesce(v_revision, 0);
  if v_revision <> p_expected_revision then
    raise exception '다른 관리자가 검인 결과를 변경했습니다. 최신 명단을 확인해주세요.' using errcode = '40001';
  end if;
  insert into public.player_inspections(tournament_id, player_id, team_id, checked_at, checked_by, revision, updated_by)
  values (p_tournament_id, p_player_id, v_player.team_id,
    case when p_checked then now() end, case when p_checked then auth.uid() end, v_revision + 1, auth.uid())
  on conflict (tournament_id, player_id) do update set
    team_id = excluded.team_id, checked_at = excluded.checked_at, checked_by = excluded.checked_by,
    revision = excluded.revision, updated_at = now(), updated_by = excluded.updated_by;
  return v_revision + 1;
end;
$$;

revoke all on function public.get_admin_player_inspections(uuid) from public, anon;
revoke all on function public.get_my_player_inspections() from public, anon;
revoke all on function public.set_player_inspection(uuid, uuid, boolean, integer) from public, anon;
grant execute on function public.get_admin_player_inspections(uuid) to authenticated;
grant execute on function public.get_my_player_inspections() to authenticated;
grant execute on function public.set_player_inspection(uuid, uuid, boolean, integer) to authenticated;
