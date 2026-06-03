-- Store basic registration profile fields collected at sign-up.

alter table public.profiles
  add column if not exists email text,
  add column if not exists gender text,
  add column if not exists birth_date date,
  add column if not exists has_player_experience boolean not null default false;

alter table public.profiles
  drop constraint if exists profiles_gender_check;

alter table public.profiles
  add constraint profiles_gender_check
  check (gender is null or gender in ('male', 'female', 'other', 'prefer_not_to_say'));
