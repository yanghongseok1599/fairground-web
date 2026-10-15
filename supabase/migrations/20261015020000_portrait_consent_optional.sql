-- ============================================================================
-- 초상권 동의를 [선택] 홍보 이용 동의로 바꾸고 철회를 허용한다.
--
-- 이전 (20260915010000 → 20260928030000 → 20261003010000, 20260908030000):
--   * 선수카드 생성·수정이 profiles.portrait_consent_at 을 요구했다 (동의 안 하면 서비스 이용 불가).
--   * 한 번 기록된 portrait_consent_at 은 두 트리거(aa_enforce_personal_portrait_consent,
--     preserve_registration_consent)가 되돌려 놓아 철회가 구조적으로 불가능했다.
-- 이후:
--   * 선수카드(사진 포함) 저장은 동의와 무관하다. 리그 화면에 선수카드를 보여주는 것은 서비스 자체이고,
--     약관·처리방침으로 고지한다. 서비스 밖 홍보 이용만 이 동의가 필요하다.
--   * 동의·철회의 증빙은 consent_records(kind='portrait') 다. 새 행이 들어오면 아래 트리거가
--     profiles.portrait_consent_at 을 맞춘다: 동의 → 서버 시각, 철회 → null.
--   * 철회해도 선수카드와 사진은 지우지 않는다(서비스). 운영진이 새 홍보 게시를 멈추고 기존 게시물을
--     내리거나 가린다 — 관리자 선수 목록의 촬영동의 표시가 사라지는 것으로 확인한다.
--   * profiles.portrait_consent_at 을 직접 바꾸는 것은 지금처럼 "본인이 처음 동의" 만 허용한다
--     (배포 전에 캐시된 화면 호환). 직접 철회·덮어쓰기는 무시된다 — 철회는 record_my_consents 로만.
--   * teams.portrait_consent_at(팀 대표의 대리 동의)은 바꾸지 않는다. 앱은 더 이상 보내지 않는다.
-- 기존 동의 행(portrait_consent_at 이 있는 회원)은 그대로 둔다. 그 동의는 개정 전 문구에 대한 것이고
-- consent_records 에 증빙 행이 없다 — 받지 않은 동의를 만들어내지 않기 위해 백필하지 않는다.
-- 의존: 20261015010000_consent_records.sql
-- ============================================================================
begin;

create or replace function public.enforce_personal_portrait_consent()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_signup_consent boolean;
begin
  if tg_op = 'INSERT' then
    -- 가입 메타데이터: 새 화면은 consents 배열, 배포 전 화면은 portrait_consent=true.
    select coalesce(u.raw_user_meta_data->'consents' @> '[{"kind":"portrait","granted":true}]'::jsonb,
                    u.raw_user_meta_data->'portrait_consent' = 'true'::jsonb)
      into v_signup_consent from auth.users u where u.id = new.id;
    if coalesce(v_signup_consent, false) then
      new.portrait_consent_at := clock_timestamp();
    elsif new.portrait_consent_at is not null then
      if auth.uid() is distinct from new.id then
        raise exception '초상권 동의는 본인만 저장할 수 있습니다.' using errcode = '42501';
      end if;
      new.portrait_consent_at := clock_timestamp();
    end if;
    return new;
  end if;

  if new.portrait_consent_at is not distinct from old.portrait_consent_at then return new; end if;
  -- consent_records 동기화(아래 sync_portrait_consent)만 동의·철회 상태를 바꾼다.
  if coalesce(current_setting('app.portrait_consent_sync', true), '') = 'on' then return new; end if;
  if old.portrait_consent_at is not null then
    new.portrait_consent_at := old.portrait_consent_at;
  else
    if auth.uid() is distinct from new.id then
      raise exception '초상권 동의는 본인만 저장할 수 있습니다.' using errcode = '42501';
    end if;
    new.portrait_consent_at := clock_timestamp();
  end if;
  return new;
end $$;
revoke all on function public.enforce_personal_portrait_consent() from public;

create or replace function public.preserve_registration_consent()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_table_name = 'profiles' and coalesce(current_setting('app.portrait_consent_sync', true), '') = 'on' then
    return new;
  end if;
  if old.portrait_consent_at is not null then new.portrait_consent_at := old.portrait_consent_at; end if;
  return new;
end $$;
revoke all on function public.preserve_registration_consent() from public;

create or replace function public.sync_portrait_consent()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('app.portrait_consent_sync', 'on', true);
  update public.profiles
    set portrait_consent_at = case when new.granted then clock_timestamp() else null end
    where id = new.user_id;
  perform set_config('app.portrait_consent_sync', 'off', true);
  return new;
end $$;
revoke all on function public.sync_portrait_consent() from public, anon, authenticated;
drop trigger if exists sync_portrait_consent on public.consent_records;
create trigger sync_portrait_consent after insert on public.consent_records
  for each row when (new.kind = 'portrait') execute function public.sync_portrait_consent();

comment on column public.profiles.portrait_consent_at is
  '대회 사진·영상과 선수카드 이미지의 서비스 밖 홍보 이용에 지금 동의한 시각. NULL = 동의 없음 또는 철회. 증빙은 consent_records(kind=portrait).';

commit;
