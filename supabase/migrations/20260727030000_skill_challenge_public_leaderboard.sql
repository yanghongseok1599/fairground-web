-- Public, sanitized Ground Challenge leaderboard for event and ranking pages.
-- Keeps operator-only fields such as phone_last4 and memo out of public reads.
create or replace function public.get_skill_challenge_leaderboard(
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

update public.site_popups
set
  cta_label = '그라운드 챌린지 보기',
  cta_href = '/skill-challenge',
  secondary_label = '이벤트 선수카드 만들기',
  secondary_href = '/register?event=ground-challenge',
  dismiss_version = greatest(dismiss_version, 1)
where placement = 'home'
  and name = '망상 그라운드 챌린지';
