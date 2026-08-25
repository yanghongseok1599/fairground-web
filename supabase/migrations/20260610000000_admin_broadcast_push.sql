-- 관리자 푸시 브로드캐스트
-- 기존 web-push 인프라(push_subscriptions + app_push_config + push-dispatch 엣지펑션)를
-- 그대로 활용한다. notifications insert → trg_push_dispatch(AFTER INSERT) → push-dispatch 가
-- 대상 user 의 구독으로 web push 를 발송한다.
--
-- enum 값 추가는 트랜잭션 제약(ADD VALUE 후 같은 트랜잭션에서 사용 불가) 때문에
-- 별도 마이그레이션(20260610000000_*)으로 분리한다. (실 적용은 두 단계로 수행됨)

-- 1) notification_kind_t 에 admin_broadcast 추가
ALTER TYPE public.notification_kind_t ADD VALUE IF NOT EXISTS 'admin_broadcast';

-- 2) 대상 user_id 해석 — {"type":"all"|"role"|"team"|"user","value": text|null}
--    all/role/team 은 승인(is_approved) 회원만, user 는 명시 지정이므로 무조건.
create or replace function public.admin_broadcast_recipient_ids(p_target jsonb)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.profiles p
  where
    case coalesce(p_target->>'type','all')
      when 'all'  then coalesce(p.is_approved, false) = true
      when 'role' then p.role::text = (p_target->>'value') and coalesce(p.is_approved, false) = true
      when 'team' then p.team_id::text = (p_target->>'value') and coalesce(p.is_approved, false) = true
      when 'user' then p.id::text = (p_target->>'value')
      else false
    end;
$$;

-- 3) 발송 전 수신자 수 미리보기 (admin 전용)
create or replace function public.admin_broadcast_count(p_target jsonb)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select count(*) into v_count from public.admin_broadcast_recipient_ids(p_target);
  return v_count;
end;
$$;

-- 4) 브로드캐스트 발송 (admin 전용) — 대상별 notification insert → 트리거가 push 발사.
--    notifications 에 INSERT RLS 정책이 없어 일반 클라이언트는 insert 불가하므로
--    SECURITY DEFINER 로 우회하되 is_admin() 으로 강제한다.
create or replace function public.admin_broadcast_push(p_title text, p_body text, p_target jsonb)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(btrim(p_title), '') = '' then
    raise exception 'title_required';
  end if;

  insert into public.notifications (user_id, kind, title, snippet, actor_id)
  select rid, 'admin_broadcast'::public.notification_kind_t, p_title, nullif(btrim(p_body), ''), auth.uid()
  from public.admin_broadcast_recipient_ids(p_target) as rid;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.admin_broadcast_recipient_ids(jsonb) from public, anon, authenticated;
grant execute on function public.admin_broadcast_count(jsonb) to authenticated;
grant execute on function public.admin_broadcast_push(text, text, jsonb) to authenticated;
