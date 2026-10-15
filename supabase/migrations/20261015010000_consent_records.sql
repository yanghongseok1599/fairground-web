-- ============================================================================
-- 동의 기록 (이용약관·개인정보 수집·만 14세·초상 홍보 이용)
--
-- 기반: adding-korean-site-essentials 키트 sql/consent-records.sql
--       (legal_documents + append-only consent_records + 보존기간 파기 + 본인 열람).
-- 이 프로젝트에 맞춘 점:
--   * service_role 키를 쓰지 않는다. 세션은 브라우저(localStorage)에만 있다. 그래서
--     - 가입 동의는 auth.users INSERT 트리거가 raw_user_meta_data.consents 로 기록한다
--       (메일 인증 전이라 세션이 없어도 같은 트랜잭션에서 기록, 실패하면 가입도 실패).
--     - 로그인 후 동의(소셜 가입 완료·초상 홍보 철회)는 record_my_consents RPC 가 auth.uid() 로만 기록한다.
--   * 필수 여부는 클라이언트가 아니라 DB 가 종류로 정한다: age14·terms·privacy.
--     이 셋은 함께, 모두 동의로만 기록된다 (하나만·거부로는 기록 불가).
--   * 문서 본문·해시는 이 마이그레이션이 넣는다. 클라이언트는 (kind, version, granted) 만 보낸다.
--     문구를 고치면 새 version 으로 새 마이그레이션을 추가한다 (scripts/legal/print-legal-documents-sql.mjs,
--     tests/site-essentials.test.mjs 가 src/content 문서와 대조).
--   * 만 14세 미만 가입 차단: 생년월일을 받는 이메일 가입은 DB 가 다시 확인한다.
--   * 가입 메타데이터에 consents 가 없는 경우(소셜 가입, 배포 전 캐시된 화면)는 막지 않는다.
--     앱이 로그인 후 /auth/complete 로 보내 동의를 받는다. 배포 순서(마이그레이션 → 코드) 동안
--     가입이 끊기지 않게 하기 위함이다. 모든 클라이언트가 바뀐 뒤 엄격하게 바꿀 수 있다.
-- 적용 전 확인: 같은 Supabase 프로젝트를 쓰는 다른 앱에 public.consent_records / legal_documents 가 없는지.
-- ============================================================================
begin;

-- 1) 문서 버전과 그 순간의 원문
create table if not exists public.legal_documents (
  kind         text not null check (kind in ('terms','privacy','refund','marketing','marketing_night','portrait','age14')),
  version      text not null,
  body_hash    text not null check (body_hash ~ '^[0-9a-f]{64}$'),
  body         jsonb not null,
  effective_at date,
  created_at   timestamptz not null default clock_timestamp(),
  primary key (kind, version)
);

-- 2) 동의 기록 — 추가만 한다. 철회도 granted=false 인 새 행이다.
create table if not exists public.consent_records (
  id          uuid primary key default gen_random_uuid(),
  -- restrict: 계정을 지우기 전에 비식별화·차단을 먼저 하도록 강제한다.
  user_id     uuid not null references auth.users(id) on delete restrict,
  kind        text not null,
  version     text not null,
  required    boolean not null,
  granted     boolean not null,
  source      text not null check (source in ('signup','oauth_complete','checkout','mypage','registration','admin')),
  user_agent  text check (length(user_agent) <= 512),
  created_at  timestamptz not null default clock_timestamp(),
  foreign key (kind, version) references public.legal_documents(kind, version),
  check (not required or granted)
);
create index if not exists consent_records_user_kind_time on public.consent_records (user_id, kind, created_at desc);

alter table public.legal_documents enable row level security;
alter table public.consent_records enable row level security;
revoke all on public.legal_documents, public.consent_records from public, anon, authenticated;

-- 3) 수정 금지, 삭제는 보존기간 만료 파기 함수만
create or replace function public.consent_records_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'consent_records is append-only' using errcode = '42501';
  end if;
  if coalesce(current_setting('app.consent_purge', true), '') <> 'on' then
    raise exception 'use purge_expired_consent_records()' using errcode = '42501';
  end if;
  return old;
end $$;

drop trigger if exists consent_records_guard on public.consent_records;
create trigger consent_records_guard before update or delete on public.consent_records
  for each row execute function public.consent_records_guard();

-- 4) 문서 시드 — src/content 의 문서와 바이트 단위로 같아야 한다 (tests/site-essentials.test.mjs).
--    시행일(effective_at)은 비워 둔다. 운영자가 정하면 별도 마이그레이션으로 기록한다.
insert into public.legal_documents (kind, version, body_hash, body) values
  ('age14', '2026-10-15', 'abbe544343a5574a9b6455acc296c8c1211422e03f83d560cbf8703e22b6c7a8', '{"kind":"age14","version":"2026-10-15","title":"만 14세 이상입니다","effectiveAt":"2026-10-15","sections":[{"heading":"만 14세 이상입니다","body":["만 14세 이상입니다"]}]}'::jsonb),
  ('terms', '2026-10-15', '0a96d480e48247cf11cb6ba543746b739aee0132861f83a41f5d631348dc3034', '{"kind":"terms","title":"페어그라운드(FairGround) 이용약관","version":"2026-10-15","effectiveAt":null,"sections":[{"heading":"제1조 목적","body":["이 약관은 페어그라운드(FairGround)(이하 \"서비스\")의 이용 조건과 절차, 회사와 회원의 권리·의무를 정합니다."]},{"heading":"제2조 약관의 게시와 변경","body":["회사는 이 약관을 서비스 초기화면에 게시합니다.","약관을 바꿀 때는 적용일 7일 전부터, 회원에게 불리한 변경은 30일 전부터 공지하고 개별 통지합니다.","회원은 변경된 약관에 동의하지 않으면 탈퇴할 수 있습니다."]},{"heading":"제3조 회원가입과 탈퇴","body":["이용자는 약관과 개인정보 수집·이용에 동의하고 회사가 정한 절차로 가입합니다.","만 14세 미만은 가입할 수 없습니다.","회원은 언제든지 탈퇴를 요청할 수 있습니다. 고객 문의 이메일로 요청하면 지체 없이 처리하며, 탈퇴 절차는 가입 절차보다 복잡하지 않게 운영합니다.","법령에 따라 보관해야 하는 거래 기록은 탈퇴 후에도 정해진 기간 동안 분리 보관합니다."]},{"heading":"제4조 회원의 의무","body":["회원은 자신의 계정과 비밀번호를 관리할 책임이 있으며 이를 제3자에게 이용하게 해서는 안 됩니다.","타인의 정보 도용, 서비스 운영 방해, 법령 위반 행위를 해서는 안 됩니다."]},{"heading":"제5조 서비스 이용 제한","body":["회사는 회원이 제4조를 위반하면 사전 통지 후 이용을 제한할 수 있습니다. 긴급한 경우에는 사후에 통지합니다.","회원은 이용 제한에 대해 이의를 신청할 수 있습니다."]},{"heading":"제6조 계약의 성립과 결제","body":["회원이 결제를 완료하고 회사가 승낙을 통지하면 계약이 성립합니다.","회사는 결제 전에 상품·서비스의 내용, 가격, 청약철회 조건을 알립니다."]},{"heading":"제7조 청약철회와 환불","body":["청약철회와 환불은 별도의 환불정책에 따릅니다. 환불정책은 전자상거래법이 정한 기준보다 회원에게 불리하게 정하지 않습니다."]},{"heading":"게시물","body":["회원이 올린 게시물의 저작권은 회원에게 있습니다.","회사는 서비스 운영과 홍보에 필요한 범위에서 게시물을 이용할 수 있으며, 회원은 언제든 게시물을 삭제할 수 있습니다.","타인의 권리를 침해하거나 법령에 위반되는 게시물은 사전 통지 없이 게시를 중단할 수 있습니다."]},{"heading":"선수카드와 경기 기록","body":["리그 운영을 위해 회원의 이름, 등번호, 포지션, 소속 팀, 선수카드 사진, 경기 기록은 서비스 화면에 공개됩니다.","선수카드 사진은 회원이 직접 올리며 언제든 바꾸거나 지울 수 있습니다.","대회 사진·영상과 선수카드 이미지를 서비스 밖의 홍보에 쓰는 것은 별도의 [선택] 동의를 받은 경우에만 하며, 회원은 그 동의를 언제든 철회할 수 있습니다."]},{"heading":"책임의 제한","body":["회사는 천재지변 등 불가항력으로 서비스를 제공할 수 없는 경우 책임을 지지 않습니다.","다만 회사의 고의 또는 중대한 과실로 인한 손해는 이 조항으로 면제되지 않습니다."]},{"heading":"분쟁 해결과 관할","body":["서비스 이용과 관련한 분쟁은 상호 협의로 해결하도록 노력합니다.","소송이 제기되면 민사소송법에 따른 관할 법원에서 다툽니다."]}]}'::jsonb),
  ('privacy', '2026-10-15', '17b991a53f3fb6a2aeda572d54def62f92c02ae113f4f54152a6513201f5ac3b', '{"kind":"privacy","title":"페어그라운드(FairGround) 개인정보처리방침","version":"2026-10-15","effectiveAt":null,"sections":[{"heading":"개인정보의 처리 목적, 항목, 보유기간","pending":true,"body":["회원 가입·식별·관리 — 항목: [이메일 가입] 이름(실명), 이메일 또는 아이디, 비밀번호(일방향 암호화 저장), 전화번호, 성별, 생년월일, 선수 등록 이력(선출 여부) / [카카오·Google 가입] 계정 식별자, 이메일, 이름 또는 닉네임 / 보유기간: 회원 탈퇴 시까지 / 근거: 계약 이행","만 14세 이상 확인 — 항목: 생년월일, 만 14세 이상 확인 여부 / 보유기간: 회원 탈퇴 시까지 / 근거: 법령","대회 참가 자격 확인, 선수 등록, 현장 참가자 확인 — 항목: 이름, 성별, 생년월일, 선수 등록 이력(선출 여부), 소속 팀, 현장 확인 기록, 안경 착용 경기 참가 동의서(서명자 이름, 동의 문서 버전, 서명 일시) / 보유기간: 회원 탈퇴 시까지 / 근거: 계약 이행","선수카드 제작과 리그 기록 공개 (이름, 등번호, 포지션, 소속 팀, 선수카드 사진, 경기 기록이 사이트에 공개됩니다. 사진은 본인이 올린 경우에만 쓰며 언제든 바꾸거나 지울 수 있습니다) — 항목: 이름, 등번호, 포지션, 국적, 소속 팀, 선수카드 사진, 경기 기록(득점·도움·경고 등) / 보유기간: 회원 탈퇴 시까지 / 근거: 계약 이행","팀·대회 참가 신청 접수와 참가비 입금 확인 — 항목: 팀명, 대표자 이름·연락처, 참가비 청구 금액·입금 여부 / 보유기간: 대금결제 기록 5년 (전자상거래법) / 근거: 계약 이행","게시판·팀 채팅·팀 갤러리·팀 회비 관리 등 커뮤니티 기능 제공 — 항목: 게시물, 댓글, 채팅 내용, 올린 사진, 팀 회비 납부 기록 / 보유기간: 게시물을 지우거나 회원 탈퇴 시까지 / 근거: 계약 이행","경기·대회 알림 발송 (웹 푸시, 이용자가 알림을 켠 경우) — 항목: 푸시 구독 정보(엔드포인트, 암호화 키), 브라우저 정보 / 보유기간: 알림을 끄거나 회원 탈퇴 시까지 / 근거: 동의","[선택] 대회 사진·영상과 선수카드 이미지의 홍보 이용 (동의한 경우에만) — 항목: 대회 현장에서 촬영된 본인의 사진·영상, 선수카드 이미지 / 보유기간: 동의일부터 2년. 철회하면 새로 게시하지 않고 게시물을 내리거나 가립니다 / 근거: 동의","동의 이력 보관 (어떤 문구에 언제 동의·철회했는지의 증빙) — 항목: 동의 항목, 문구 버전, 동의·철회 여부와 일시, 브라우저 정보 / 보유기간: [확정 필요] 탈퇴 후 보관 기간 / 근거: 법령","문의 응대 — 항목: 이메일 주소, 문의 내용 / 보유기간: 소비자 불만·분쟁 처리 기록 3년 (전자상거래법) / 근거: 계약 이행"]},{"heading":"개인정보의 파기 절차 및 방법","pending":false,"body":["보유기간이 지나거나 처리 목적이 달성된 개인정보는 지체 없이 파기합니다.","전자적 파일은 복구할 수 없는 방법으로 삭제하고, 종이 문서는 분쇄하거나 소각합니다.","다만 아래 기록은 법령에 따라 별도로 분리해 보관한 뒤 기간이 지나면 파기합니다.","계약 또는 청약철회 등에 관한 기록: 5년 (전자상거래법 시행령 제6조)","대금결제 및 재화 등의 공급에 관한 기록: 5년 (전자상거래법 시행령 제6조)","소비자의 불만 또는 분쟁처리에 관한 기록: 3년 (전자상거래법 시행령 제6조)","표시·광고에 관한 기록: 6개월 (전자상거래법 시행령 제6조)","웹사이트 방문 기록(접속 로그): 3개월 (통신비밀보호법 시행령 제41조)"]},{"heading":"개인정보의 제3자 제공","body":["페어그라운드(FairGround)은(는) 이용자의 개인정보를 제3자에게 제공하지 않습니다. 법령에 특별한 규정이 있는 경우는 예외입니다."]},{"heading":"개인정보 처리업무의 위탁","body":["Supabase Inc.: 회원 인증, 데이터베이스·파일 저장 (데이터베이스 서버: 서울 리전)","Vercel Inc.: 웹사이트 호스팅과 요청 처리","Telegram Messenger Inc.: 새 팀 참가 신청을 운영진에게 알리는 메시지 전송","Google LLC: 대회 사진 원본 저장(Google Drive), Google 로그인","(주)카카오: 카카오 로그인, 카카오톡 공유","위탁계약 시 개인정보 보호 관련 법령 준수, 재위탁 제한, 안전성 확보조치, 손해배상 책임을 계약서에 명시하고 수탁자를 관리·감독합니다."]},{"heading":"개인정보의 국외 이전","body":["Vercel Inc. (미국, 연락처 [확정 필요] 연락처) — 항목: 접속 기록(IP 주소, 브라우저 정보), 이용 중 주고받는 정보 / 시기·방법: 사이트를 이용할 때마다, 네트워크를 통한 전송 / 목적: 웹사이트 호스팅 / 보유기간: 위탁 계약 종료 시까지","Telegram Messenger Inc. ([확정 필요] 국가, 연락처 [확정 필요] 연락처) — 항목: 팀명, 대표자 이름·연락처 / 시기·방법: 팀 참가 신청 시, 네트워크를 통한 전송 / 목적: 운영진 신청 알림 / 보유기간: [확정 필요] 운영진 대화방 보관 기간","Google LLC (미국, 연락처 [확정 필요] 연락처) — 항목: 대회 현장 사진 원본(얼굴이 담긴 사진 포함) / 시기·방법: 사진 자료실 게시 시, 네트워크를 통한 전송 / 목적: 사진 원본 저장과 내려받기 제공 / 보유기간: 자료실 게시 종료 시까지","웹 푸시 서비스 (Google·Apple·Mozilla 등 이용자 브라우저 제조사) (미국 등, 연락처 각 브라우저 제조사) — 항목: 푸시 구독 정보, 알림 내용 / 시기·방법: 알림 발송 시, 네트워크를 통한 전송 / 목적: 웹 푸시 알림 전달 / 보유기간: 전달 후 각 서비스 정책에 따름","국외 이전을 원하지 않으시면 회원 탈퇴로 거부할 수 있습니다. 다만 서비스 제공에 필수적인 이전이므로 거부 시 서비스 이용이 어렵습니다."],"pending":true},{"heading":"정보주체와 법정대리인의 권리·의무 및 행사방법","body":["이용자는 언제든지 개인정보의 열람·정정·삭제·처리정지 및 동의 철회를 요구할 수 있습니다.","마이페이지에서 직접 처리하거나 아래 개인정보 보호책임자에게 서면·이메일로 요청할 수 있으며, 지체 없이 조치합니다."]},{"heading":"개인정보의 안전성 확보조치","body":["관리적 조치: 내부관리계획 수립·시행, 개인정보 취급자 최소화 및 정기 교육.","기술적 조치: 접근권한 관리와 접근통제, 비밀번호 일방향 암호화 저장, 전송 구간 암호화(TLS), 접속기록 보관 및 위·변조 방지.","물리적 조치: 클라우드 서비스 수탁자의 물리적 보안 통제를 계약으로 확인합니다."]},{"heading":"개인정보 자동 수집 장치의 설치·운영 및 거부","body":["로그인 유지에 필요한 쿠키 외에 행태정보를 수집하는 장치를 사용하지 않습니다."]},{"heading":"개인정보 보호책임자","pending":true,"body":["처리자: [확정 필요] 상호","개인정보 보호책임자: [확정 필요] 성명 또는 담당 부서","연락처: info@fairground-kor.com"]},{"heading":"권익침해 구제방법","body":["개인정보분쟁조정위원회 1833-6972 (www.kopico.go.kr)","개인정보침해신고센터 118 (privacy.kisa.or.kr)","대검찰청 1301 (www.spo.go.kr) · 경찰청 182 (ecrm.police.go.kr)"]},{"heading":"처리방침의 변경","pending":true,"body":["이 처리방침은 [확정 필요] 시행일부터 적용됩니다.","내용을 바꿀 때는 시행 7일 전부터, 이용자 권리에 중요한 변경은 30일 전부터 공지합니다. 이전 버전은 아래에서 열람할 수 있습니다."]}]}'::jsonb),
  ('portrait', '2026-10-15', 'fecde105bcb14278bdb0a7fbd217b020e7dba90725ca7b5b72fa675f8f615d9d', '{"kind":"portrait","version":"2026-10-15","title":"대회 사진·영상과 선수카드 이미지 홍보 이용 동의","effectiveAt":"2026-10-15","sections":[{"heading":"대회 사진·영상과 선수카드 이미지 홍보 이용 동의","body":["목적: 행사 기록과 홍보 (페어그라운드 홈페이지·공식 SNS·홍보 인쇄물·협찬 제안서). 상업 광고에는 별도 동의 없이 쓰지 않습니다.","항목: 대회 현장에서 촬영된 본인의 얼굴·모습이 담긴 사진과 영상, 본인의 선수카드 이미지","보유기간: 동의일부터 2년. 이후 새로 게시하지 않으며, 철회하시면 지체 없이 게시물을 내리거나 가립니다.","거부권: 동의하지 않아도 참가할 수 있습니다. 철회 방법: 마이페이지의 초상권 동의 화면에서 철회하거나 info@fairground-kor.com 로 요청"]}]}'::jsonb)
on conflict (kind, version) do nothing;

-- 5) 기록 공통부 — 직접 호출 불가. 아래 RPC 와 가입 트리거만 부른다.
--    p_items: [{ "kind": "terms", "version": "2026-10-15", "granted": true }, ...]
create or replace function public.insert_consent_items(
  p_user uuid, p_source text, p_user_agent text, p_items jsonb
) returns integer language plpgsql security definer set search_path = '' as $$
declare
  item jsonb;
  n integer := 0;
begin
  if p_user is null or jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) not between 1 and 10 then
    raise exception 'invalid_request' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_items) x
             where jsonb_typeof(x) <> 'object' or jsonb_typeof(x->'granted') is distinct from 'boolean'
                or jsonb_typeof(x->'kind') is distinct from 'string' or jsonb_typeof(x->'version') is distinct from 'string') then
    raise exception 'invalid_request' using errcode = '22023';
  end if;
  -- 필수 묶음(age14·terms·privacy)은 셋 다, 모두 동의로만 들어온다.
  if exists (select 1 from jsonb_array_elements(p_items) x where x->>'kind' in ('age14','terms','privacy'))
     and (select count(distinct x->>'kind') from jsonb_array_elements(p_items) x
          where x->>'kind' in ('age14','terms','privacy') and x->'granted' = 'true'::jsonb) <> 3 then
    raise exception 'required_consent_missing' using errcode = '22023';
  end if;
  for item in select * from jsonb_array_elements(p_items) loop
    -- (kind, version) 이 legal_documents 에 없으면 외래키가 거부한다.
    insert into public.consent_records (user_id, kind, version, required, granted, source, user_agent)
      values (p_user, item->>'kind', item->>'version', item->>'kind' in ('age14','terms','privacy'),
              (item->>'granted')::boolean, p_source, left(p_user_agent, 512));
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.insert_consent_items(uuid, text, text, jsonb) from public, anon, authenticated;

-- 6) 로그인한 본인의 동의·철회 기록 (소셜 가입 완료, 마이페이지 초상 홍보 동의·철회)
create or replace function public.record_my_consents(p_source text, p_user_agent text, p_items jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_source is null or p_source not in ('oauth_complete', 'mypage') then
    raise exception 'invalid_source' using errcode = '22023';
  end if;
  return public.insert_consent_items(auth.uid(), p_source, p_user_agent, p_items);
end $$;
revoke all on function public.record_my_consents(text, text, jsonb) from public, anon;
grant execute on function public.record_my_consents(text, text, jsonb) to authenticated;

-- 7) 가입 트리거 — 만 14세 미만 차단 + 메타데이터 동의 기록
create or replace function public.record_signup_consents()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_birth date;
begin
  begin v_birth := nullif(meta->>'birth_date', '')::date; exception when others then v_birth := null; end;
  if v_birth is not null
     and v_birth > ((clock_timestamp() at time zone 'Asia/Seoul')::date - interval '14 years')::date then
    raise exception 'under_14_signup_blocked' using errcode = '22023';
  end if;
  if jsonb_typeof(meta->'consents') = 'array' then
    perform public.insert_consent_items(new.id, 'signup', null, meta->'consents');
  end if;
  return new;
end $$;
revoke all on function public.record_signup_consents() from public, anon, authenticated;
-- on_auth_user_created(프로필 생성) 다음에 돈다 (같은 AFTER INSERT, 이름순).
drop trigger if exists zz_record_signup_consents on auth.users;
create trigger zz_record_signup_consents after insert on auth.users
  for each row execute function public.record_signup_consents();

-- 8) 사용자별 현재 상태 (종류별 최신 행)
create or replace view public.current_consents
with (security_invoker = true) as
  select distinct on (user_id, kind) user_id, kind, version, granted, created_at
  from public.consent_records
  order by user_id, kind, created_at desc;
revoke all on public.current_consents from public, anon, authenticated;

-- 9) 본인 동의 이력 열람 (개인정보 보호법 제35조 열람권) — 앱은 필수 동의 누락 확인에도 쓴다.
create or replace function public.my_consent_history()
returns table (kind text, version text, granted boolean, source text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select kind, version, granted, source, created_at from public.consent_records
  where user_id = auth.uid() order by created_at desc;
$$;
revoke all on function public.my_consent_history() from public, anon;
grant execute on function public.my_consent_history() to authenticated;

-- 10) 보존기간 만료 파기 — 처리방침에 적은 기간과 같은 값을 넘긴다.
--     사용자·종류별 최신 행은 절대 지우지 않는다. 그 행이 지금 유효한 동의 상태의 유일한 증빙이다
--     (예: 초상 홍보 동의 후 게시물이 남아 있으면 그 동의 행은 기간과 무관하게 남아야 한다).
--     지우는 것은 이미 다른 행으로 대체된 과거 이력뿐이다.
create or replace function public.purge_expired_consent_records(p_older_than interval)
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if p_older_than < interval '1 year' then raise exception 'retention_too_short' using errcode = '22023'; end if;
  perform set_config('app.consent_purge', 'on', true);
  delete from public.consent_records r
  where r.created_at < clock_timestamp() - p_older_than
    and exists (select 1 from public.consent_records newer
                where newer.user_id = r.user_id and newer.kind = r.kind and newer.created_at > r.created_at);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.purge_expired_consent_records(interval) from public, anon, authenticated;
grant execute on function public.purge_expired_consent_records(interval) to service_role;

commit;
