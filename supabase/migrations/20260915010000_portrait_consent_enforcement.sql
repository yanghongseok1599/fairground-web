-- Personal consent is independent of a team representative's attestation.
-- Additive triggers avoid replacing the existing OAuth/profile provisioning code.
begin;

create or replace function public.enforce_personal_portrait_consent()
returns trigger language plpgsql security definer set search_path = public as $$
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
    v_card_write := coalesce(new.number, 0) > 0
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
    v_card_write := row(new.number, new.position, new.photo_url, new.profile_photo_url, new.photo_scale)
      is distinct from row(old.number, old.position, old.photo_url, old.profile_photo_url, old.photo_scale);
  end if;

  if v_card_write and new.portrait_consent_at is null then
    raise exception '초상권·촬영물 활용에 동의해야 선수카드를 만들거나 수정할 수 있습니다.' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_personal_portrait_consent() from public;
create trigger aa_enforce_personal_portrait_consent before insert or update on public.profiles
  for each row execute function public.enforce_personal_portrait_consent();

create or replace function public.require_applicant_portrait_consent()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Only a newly submitted team attestation is a tournament application.
  -- General team/profile maintenance does not imply new consent.
  if tg_op = 'UPDATE' then
    if old.portrait_consent_at is not null then
      new.portrait_consent_at := old.portrait_consent_at;
      return new;
    end if;
  end if;
  if new.portrait_consent_at is not null then
    if auth.uid() is distinct from new.captain_id or not exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.portrait_consent_at is not null
    ) then
      raise exception '대회 신청 전에 신청자 본인의 초상권 동의를 완료해주세요.' using errcode = '23514';
    end if;
    new.portrait_consent_at := clock_timestamp();
  end if;
  return new;
end;
$$;
revoke all on function public.require_applicant_portrait_consent() from public;
create trigger aa_require_applicant_portrait_consent before insert or update on public.teams
  for each row execute function public.require_applicant_portrait_consent();

commit;
