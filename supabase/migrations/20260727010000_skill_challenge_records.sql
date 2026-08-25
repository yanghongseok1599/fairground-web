-- Ground Challenge event records and automatic event badge awarding.
create table if not exists public.skill_challenge_records (
  id uuid primary key default gen_random_uuid(),
  event_slug text not null default 'mangsang-2026',
  player_id uuid not null references public.profiles(id) on delete cascade,
  event_date date not null,
  participant_name text not null,
  phone_last4 text,
  speed_kmh numeric not null default 0,
  target_number integer not null default 1,
  target_recorded boolean not null default false,
  target_hit boolean not null default false,
  air_touch_score numeric not null default 0,
  total_score integer not null default 0,
  event_badges text[] not null default '{}'::text[],
  card_badge_ids text[] not null default '{}'::text[],
  memo text,
  recorded_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint skill_challenge_records_event_player_unique unique (event_slug, player_id),
  constraint skill_challenge_records_speed_range check (speed_kmh >= 0 and speed_kmh <= 130),
  constraint skill_challenge_records_target_range check (target_number >= 1 and target_number <= 9),
  constraint skill_challenge_records_touch_range check (air_touch_score >= 0 and air_touch_score <= 10)
);

create index if not exists skill_challenge_records_event_idx
  on public.skill_challenge_records(event_slug, total_score desc);

create index if not exists skill_challenge_records_player_idx
  on public.skill_challenge_records(player_id);

create or replace function public.touch_skill_challenge_records_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists skill_challenge_records_touch_updated_at on public.skill_challenge_records;
create trigger skill_challenge_records_touch_updated_at
before update on public.skill_challenge_records
for each row execute function public.touch_skill_challenge_records_updated_at();

alter table public.skill_challenge_records enable row level security;

drop policy if exists "skill challenge records select" on public.skill_challenge_records;
create policy "skill challenge records select"
on public.skill_challenge_records
for select
using (player_id = auth.uid() or public.is_referee_or_admin());

drop policy if exists "skill challenge records insert ops" on public.skill_challenge_records;
create policy "skill challenge records insert ops"
on public.skill_challenge_records
for insert
with check (public.is_referee_or_admin());

drop policy if exists "skill challenge records update ops" on public.skill_challenge_records;
create policy "skill challenge records update ops"
on public.skill_challenge_records
for update
using (public.is_referee_or_admin())
with check (public.is_referee_or_admin());

drop policy if exists "skill challenge records delete ops" on public.skill_challenge_records;
create policy "skill challenge records delete ops"
on public.skill_challenge_records
for delete
using (public.is_referee_or_admin());

insert into public.badges (id, name, description, category, icon, max_progress, unlock_condition, image_url)
values
  (
    'event_shooting_king',
    '슈팅왕',
    '그라운드 챌린지 슈팅 스피드 기록 완료',
    'field',
    'target',
    1,
    '그라운드 챌린지 슈팅 스피드건 기록',
    '/images/badges/event_shooting_king_v2.png?v=2'
  ),
  (
    'event_freekick_king',
    '프리킥왕',
    '그라운드 챌린지 타겟 슈팅 성공',
    'field',
    'goal',
    1,
    '그라운드 챌린지 타겟 슈팅 성공',
    '/images/badges/event_freekick_king_v2.png?v=2'
  ),
  (
    'event_touch_king',
    '터치왕',
    '그라운드 챌린지 에어볼 터치 기록 완료',
    'field',
    'sparkles',
    1,
    '그라운드 챌린지 에어볼 터치 기록',
    '/images/badges/event_touch_king_v2.png?v=2'
  )
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  icon = excluded.icon,
  max_progress = excluded.max_progress,
  unlock_condition = excluded.unlock_condition,
  image_url = excluded.image_url;

create or replace function public.upsert_skill_challenge_record(
  p_event_slug text,
  p_player_id uuid,
  p_event_date date,
  p_speed_kmh numeric,
  p_target_number integer,
  p_target_recorded boolean,
  p_target_hit boolean,
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
  v_target_number integer := least(9, greatest(1, coalesce(p_target_number, 1)));
  v_target_recorded boolean := coalesce(p_target_recorded, false);
  v_target_hit boolean := coalesce(p_target_hit, false);
  v_touch numeric := least(10, greatest(0, coalesce(p_air_touch_score, 0)));
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
    v_target_number,
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
