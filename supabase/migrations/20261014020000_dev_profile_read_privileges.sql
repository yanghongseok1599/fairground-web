-- Development-only repair of the existing public-column access contract.
-- A verified executor must set this target marker in the same transaction.
DO $guard$
BEGIN
  IF current_setting('app.fairground_security_target', true) IS DISTINCT FROM
     'fhytkbjadhnmozppolrv' THEN
    RAISE EXCEPTION 'This migration requires the verified FairGround development target';
  END IF;
END
$guard$;

-- Table-level SELECT had bypassed the existing public-column allowlist.
-- PostgreSQL also removes these roles' column SELECT grants on table REVOKE,
-- so restore the exact 20260829020000 projection plus number_label below.
-- Scoped RPCs still expose full profiles only to their authorized callers.
REVOKE SELECT ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
REVOKE SELECT (birth_date, email, gender, has_player_experience, phone,
               portrait_consent_at, team_role)
  ON TABLE public.profiles FROM PUBLIC, anon, authenticated;

GRANT SELECT (
  id, name, number, position, team_id, nationality, photo_url,
  profile_photo_url, profile_photo_locked, photo_scale, photo_offset_x,
  card_type, card_skin, card_rating, goals, assists, games, mom, badges,
  is_banned, ban_matches_remaining, season_yellow_cards, is_approved, role,
  attendance_streak, attendance_streak_best, mbti, disposition,
  personal_values, bio, created_at, number_label
) ON TABLE public.profiles TO anon, authenticated;
