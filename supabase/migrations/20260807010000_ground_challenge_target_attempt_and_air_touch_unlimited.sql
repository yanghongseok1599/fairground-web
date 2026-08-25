-- Ground Challenge scoring update:
-- - Airball touch stores the raw summed score with no upper cap.
-- - Target shooting no longer stores a designated target number for new records.
--   It stores whether the participant succeeded, and if so the successful attempt out of 5.

alter table public.skill_challenge_records
  add column if not exists target_attempt_count integer;

alter table public.skill_challenge_records
  drop constraint if exists skill_challenge_records_touch_range;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'skill_challenge_records_touch_min'
      and conrelid = 'public.skill_challenge_records'::regclass
  ) then
    alter table public.skill_challenge_records
      add constraint skill_challenge_records_touch_min check (air_touch_score >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'skill_challenge_records_target_attempt_range'
      and conrelid = 'public.skill_challenge_records'::regclass
  ) then
    alter table public.skill_challenge_records
      add constraint skill_challenge_records_target_attempt_range
      check (target_attempt_count is null or (target_attempt_count >= 1 and target_attempt_count <= 5));
  end if;
end $$;

create index if not exists skill_challenge_records_target_attempt_idx
  on public.skill_challenge_records(event_slug, target_hit desc, target_attempt_count asc);

drop function if exists public.upsert_skill_challenge_record(
  text,
  uuid,
  date,
  numeric,
  integer,
  boolean,
  boolean,
  numeric,
  text
);

drop function if exists public.upsert_skill_challenge_record(
  text,
  uuid,
  date,
  numeric,
  boolean,
  boolean,
  integer,
  numeric,
  text
);

create function public.upsert_skill_challenge_record(
  p_event_slug text,
  p_player_id uuid,
  p_event_date date,
  p_speed_kmh numeric,
  p_target_recorded boolean,
  p_target_hit boolean,
  p_target_attempt_count integer,
  p_air_touch_score numeric,
  p_memo text default null
)
returns public.skill_challenge_records
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.profiles%rowtype;
  v_player public.profiles%rowtype;
  v_record public.skill_challenge_records%rowtype;
  v_event_slug text := coalesce(nullif(trim(p_event_slug), ''), 'mangsang-2026');
  v_speed numeric := least(130, greatest(0, coalesce(p_speed_kmh, 0)));
  v_target_hit boolean := coalesce(p_target_hit, false);
  v_target_recorded boolean := coalesce(p_target_recorded, false) or coalesce(p_target_hit, false);
  v_target_attempt_count integer := case
    when coalesce(p_target_hit, false) then least(5, greatest(1, coalesce(p_target_attempt_count, 1)))
    else null
  end;
  v_touch numeric := greatest(0, coalesce(p_air_touch_score, 0));
  v_total integer;
  v_event_badges text[] := array['그라운드 챌린저'];
  v_event_card_badge_ids text[] := array[
    'event_shooting_king',
    'event_freekick_king',
    'event_touch_king'
  ];
  v_card_badge_ids text[] := '{}'::text[];
  v_badge_id text;
  v_completed_at timestamptz;
begin
  select *
  into v_actor
  from public.profiles
  where id = auth.uid();

  if v_actor.id is null or not (v_actor.role = 'admin' or (v_actor.role = 'referee' and v_actor.is_approved = true)) then
    raise exception 'Only approved operators can record skill challenge results.';
  end if;

  select *
  into v_player
  from public.profiles
  where id = p_player_id;

  if v_player.id is null then
    raise exception 'Player not found.';
  end if;

  if v_speed > 0 then
    v_event_badges := array_append(v_event_badges, '스피드캐논');
    v_card_badge_ids := array_append(v_card_badge_ids, 'event_shooting_king');
  end if;

  if v_target_recorded and v_target_hit then
    v_event_badges := array_append(v_event_badges, '타겟스나이퍼');
    v_card_badge_ids := array_append(v_card_badge_ids, 'event_freekick_king');
  end if;

  if v_touch > 0 then
    v_event_badges := array_append(v_event_badges, '에어터치마스터');
    v_card_badge_ids := array_append(v_card_badge_ids, 'event_touch_king');
  end if;

  v_total :=
    round(v_speed * 5)::integer
    + case when v_target_hit then 300 else 0 end
    + round(v_touch * 50)::integer
    + case when v_speed > 0 and v_target_recorded and v_touch > 0 then 100 else 0 end;

  if v_speed > 0 and v_target_recorded and v_touch > 0 then
    v_completed_at := now();
  else
    v_completed_at := null;
  end if;

  insert into public.skill_challenge_records (
    event_slug,
    player_id,
    event_date,
    participant_name,
    phone_last4,
    speed_kmh,
    target_number,
    target_attempt_count,
    target_recorded,
    target_hit,
    air_touch_score,
    total_score,
    event_badges,
    card_badge_ids,
    memo,
    recorded_by,
    completed_at
  )
  values (
    v_event_slug,
    p_player_id,
    p_event_date,
    coalesce(nullif(trim(v_player.name), ''), '이름 없음'),
    right(regexp_replace(coalesce(v_player.phone, ''), '\D', '', 'g'), 4),
    v_speed,
    1,
    v_target_attempt_count,
    v_target_recorded,
    v_target_hit,
    v_touch,
    v_total,
    v_event_badges,
    v_card_badge_ids,
    nullif(trim(coalesce(p_memo, '')), ''),
    v_actor.id,
    v_completed_at
  )
  on conflict (event_slug, player_id) do update
  set
    event_date = excluded.event_date,
    participant_name = excluded.participant_name,
    phone_last4 = excluded.phone_last4,
    speed_kmh = excluded.speed_kmh,
    target_number = excluded.target_number,
    target_attempt_count = excluded.target_attempt_count,
    target_recorded = excluded.target_recorded,
    target_hit = excluded.target_hit,
    air_touch_score = excluded.air_touch_score,
    total_score = excluded.total_score,
    event_badges = excluded.event_badges,
    card_badge_ids = excluded.card_badge_ids,
    memo = excluded.memo,
    recorded_by = excluded.recorded_by,
    completed_at = excluded.completed_at
  returning * into v_record;

  update public.player_badges
  set
    is_earned = false,
    progress = 0,
    earned_at = null
  where player_id = p_player_id
    and badge_id = any(v_event_card_badge_ids)
    and not (badge_id = any(v_card_badge_ids));

  foreach v_badge_id in array v_card_badge_ids loop
    update public.player_badges
    set
      is_earned = true,
      progress = greatest(progress, 1),
      earned_at = coalesce(earned_at, now())
    where player_id = p_player_id
      and badge_id = v_badge_id;

    if not found then
      insert into public.player_badges (player_id, badge_id, is_earned, progress, earned_at)
      values (p_player_id, v_badge_id, true, 1, now());
    end if;
  end loop;

  update public.profiles profile
  set badges = array(
    select existing.badge_id
    from unnest(coalesce(profile.badges, '{}'::text[])) as existing(badge_id)
    where not (
      existing.badge_id = any(v_event_card_badge_ids)
      and not (existing.badge_id = any(v_card_badge_ids))
    )
  )
  where profile.id = p_player_id;

  if array_length(v_card_badge_ids, 1) is not null then
    update public.profiles profile
    set badges = coalesce((
      select array_agg(deduped.badge_id order by deduped.first_seen)
      from (
        select badge_id, min(ord) as first_seen
        from unnest(coalesce(profile.badges, '{}'::text[]) || v_card_badge_ids) with ordinality as merged(badge_id, ord)
        where badge_id <> ''
        group by badge_id
        order by min(ord)
        limit 4
      ) deduped
    ), '{}'::text[])
    where profile.id = p_player_id;
  end if;

  return v_record;
end;
$$;

grant execute on function public.upsert_skill_challenge_record(
  text,
  uuid,
  date,
  numeric,
  boolean,
  boolean,
  integer,
  numeric,
  text
) to authenticated;

drop function if exists public.get_skill_challenge_leaderboard(text, integer);

create function public.get_skill_challenge_leaderboard(
  p_event_slug text default 'mangsang-2026',
  p_limit integer default 100
)
returns table (
  id uuid,
  event_slug text,
  player_id uuid,
  participant_name text,
  player_number integer,
  player_position text,
  photo_url text,
  profile_photo_url text,
  event_date date,
  speed_kmh numeric,
  target_number integer,
  target_attempt_count integer,
  target_recorded boolean,
  target_hit boolean,
  air_touch_score numeric,
  total_score integer,
  event_badges text[],
  card_badge_ids text[],
  completed_at timestamptz,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    records.id,
    records.event_slug,
    records.player_id,
    records.participant_name,
    profiles.number as player_number,
    profiles.position as player_position,
    profiles.photo_url,
    profiles.profile_photo_url,
    records.event_date,
    records.speed_kmh,
    records.target_number,
    records.target_attempt_count,
    records.target_recorded,
    records.target_hit,
    records.air_touch_score,
    records.total_score,
    records.event_badges,
    records.card_badge_ids,
    records.completed_at,
    records.created_at
  from public.skill_challenge_records records
  left join public.profiles profiles on profiles.id = records.player_id
  where records.event_slug = coalesce(nullif(trim(p_event_slug), ''), 'mangsang-2026')
  order by
    records.total_score desc,
    records.speed_kmh desc,
    records.air_touch_score desc,
    records.created_at asc
  limit least(greatest(coalesce(p_limit, 100), 1), 1000);
$$;

grant execute on function public.get_skill_challenge_leaderboard(text, integer) to anon, authenticated;
