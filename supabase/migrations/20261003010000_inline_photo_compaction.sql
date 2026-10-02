-- Preserve personal consent enforcement; permit a scoped owner-only byte compaction.
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
    -- Byte-only maintenance is allowed solely to a database-owner session, never
    -- the API authenticator/service role. The transaction must provide the exact
    -- old/new photo digests; every non-photo field (including consent) must match.
    if tg_op = 'UPDATE' and pg_has_role(session_user, 'postgres', 'MEMBER') then
      if (to_jsonb(new) - 'photo_url' - 'profile_photo_url') = (to_jsonb(old) - 'photo_url' - 'profile_photo_url')
        and (new.photo_url is not distinct from old.photo_url or (
          old.photo_url like 'data:image/%'
          and new.photo_url ~ '^data:image/webp;base64,[A-Za-z0-9+/]+={0,2}$'
          and octet_length(new.photo_url) < octet_length(old.photo_url)
          and octet_length(new.photo_url) <= 163863))
        and (new.profile_photo_url is not distinct from old.profile_photo_url or (
          old.profile_photo_url like 'data:image/%'
          and new.profile_photo_url ~ '^data:image/webp;base64,[A-Za-z0-9+/]+={0,2}$'
          and octet_length(new.profile_photo_url) < octet_length(old.profile_photo_url)
          and octet_length(new.profile_photo_url) <= 163863))
        and current_setting('app.inline_photo_compaction', true) = concat_ws(':', old.id::text,
          encode(sha256(convert_to(old.photo_url, 'UTF8')), 'hex'),
          coalesce(encode(sha256(convert_to(old.profile_photo_url, 'UTF8')), 'hex'), '-'),
          encode(sha256(convert_to(new.photo_url, 'UTF8')), 'hex'),
          coalesce(encode(sha256(convert_to(new.profile_photo_url, 'UTF8')), 'hex'), '-')) then
        return new;
      end if;
    end if;
    raise exception '초상권·촬영물 활용에 동의해야 선수카드를 만들거나 수정할 수 있습니다.' using errcode = '23514';
  end if;
  return new;
end;
$function$
;
