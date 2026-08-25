-- Backfill auth users that were created before or outside the profile trigger.
-- Existing profiles are never overwritten.

insert into public.profiles (
  id,
  name,
  phone,
  email,
  gender,
  birth_date,
  has_player_experience,
  team_id,
  card_skin
)
select
  users.id,
  coalesce(
    nullif(users.raw_user_meta_data->>'name', ''),
    nullif(users.raw_user_meta_data->>'full_name', ''),
    nullif(split_part(coalesce(users.email, ''), '@', 1), ''),
    '회원'
  ) as name,
  nullif(users.raw_user_meta_data->>'phone', '') as phone,
  users.email,
  case
    when users.raw_user_meta_data->>'gender' in ('male', 'female', 'other', 'prefer_not_to_say')
      then users.raw_user_meta_data->>'gender'
    else null
  end as gender,
  case
    when nullif(users.raw_user_meta_data->>'birth_date', '') ~ '^\d{4}-\d{2}-\d{2}$'
      then nullif(users.raw_user_meta_data->>'birth_date', '')::date
    else null
  end as birth_date,
  case
    when lower(nullif(users.raw_user_meta_data->>'has_player_experience', '')) in ('true', 't', '1', 'yes')
      then true
    else false
  end as has_player_experience,
  case
    when nullif(users.raw_user_meta_data->>'team_id', '') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      then nullif(users.raw_user_meta_data->>'team_id', '')::uuid
    else null
  end as team_id,
  case
    when users.raw_user_meta_data->>'card_skin' = 'hologram' then 'hologram'
    else 'standard'
  end as card_skin
from auth.users users
left join public.profiles profiles on profiles.id = users.id
where profiles.id is null
on conflict (id) do nothing;
