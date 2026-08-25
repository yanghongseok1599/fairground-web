alter table public.profiles
  add column if not exists profile_photo_locked boolean not null default false;

comment on column public.profiles.profile_photo_locked is
  'When true, keep profile_photo_url separate from the player card photo_url.';
