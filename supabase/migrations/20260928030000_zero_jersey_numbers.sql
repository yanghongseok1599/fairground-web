-- Preserve the existing numeric column and distinguish explicit 0 / 00 from an unset legacy zero.
alter table public.profiles add column number_label text;
alter table public.profiles add constraint profiles_zero_number_label check (number_label is null or (number=0 and number_label in ('0','00')));
grant select(number_label) on public.profiles to anon, authenticated;
-- Match lineups keep the shirt label used for that match, even if the profile later changes.
alter table public.match_lineups add column jersey_number_label text;
alter table public.match_lineups add constraint lineups_zero_number_label check (jersey_number_label is null or (jersey_number is not null and jersey_number=0 and jersey_number_label in ('0','00')));
create or replace view public.public_player_profiles as  SELECT id,
    name,
    number,
    "position",
    team_id,
    nationality,
    photo_url,
    profile_photo_url,
    profile_photo_locked,
    photo_scale,
    photo_offset_x,
    card_type,
    card_skin,
    card_rating,
    goals,
    assists,
    games,
    mom,
    badges,
    is_banned,
    ban_matches_remaining,
    season_yellow_cards,
    is_approved,
    role,
    attendance_streak,
    attendance_streak_best,
    mbti,
    disposition,
    personal_values,
    bio,
    created_at,
    profiles.number_label
   FROM profiles
  WHERE is_approved = true AND is_banned = false;
create or replace view public.team_member_player_profiles as  SELECT id,
    name,
    number,
    "position",
    team_id,
    nationality,
    photo_url,
    profile_photo_url,
    profile_photo_locked,
    photo_scale,
    photo_offset_x,
    card_type,
    card_skin,
    card_rating,
    goals,
    assists,
    games,
    mom,
    badges,
    is_banned,
    ban_matches_remaining,
    season_yellow_cards,
    is_approved,
    role,
    team_role,
    attendance_streak,
    attendance_streak_best,
    mbti,
    disposition,
    personal_values,
    bio,
    created_at,
    profiles.number_label
   FROM profiles
  WHERE is_approved = true AND is_banned = false;
CREATE OR REPLACE FUNCTION public.enforce_personal_portrait_consent()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_signup_consent boolean := false;
  v_card_write boolean := false;
begin
  if tg_op = 'INSERT' then
    select coalesce(u.raw_user_meta_data->'portrait_consent' = 'true'::jsonb, false)
      into v_signup_consent from auth.users u where u.id = new.id;
    if coalesce(v_signup_consent, false) then
      new.portrait_consent_at := clock_timestamp();
    elsif new.portrait_consent_at is not null then
      if auth.uid() is distinct from new.id then
        raise exception '초상권 동의는 본인만 저장할 수 있습니다.' using errcode = '42501';
      end if;
      new.portrait_consent_at := clock_timestamp();
    end if;
    v_card_write := (coalesce(new.number, 0) > 0 or new.number_label is not null)
      or nullif(btrim(new.photo_url), '') is not null
      or nullif(btrim(new.profile_photo_url), '') is not null;
  else
    if old.portrait_consent_at is not null then
      new.portrait_consent_at := old.portrait_consent_at;
    elsif new.portrait_consent_at is not null then
      if auth.uid() is distinct from new.id then
        raise exception '초상권 동의는 본인만 저장할 수 있습니다.' using errcode = '42501';
      end if;
      new.portrait_consent_at := clock_timestamp();
    end if;
    v_card_write := row(new.number, new.number_label, new.position, new.photo_url, new.profile_photo_url, new.photo_scale)
      is distinct from row(old.number, old.number_label, old.position, old.photo_url, old.profile_photo_url, old.photo_scale);
  end if;

  if v_card_write and new.portrait_consent_at is null then
    raise exception '초상권·촬영물 활용에 동의해야 선수카드를 만들거나 수정할 수 있습니다.' using errcode = '23514';
  end if;
  return new;
end;
$function$
;
