-- ============================================================================
-- 참가비 납부 기록 5년 보관 (전자상거래법 시행령 제6조: 대금결제 및 재화등의 공급에 관한 기록 5년)
--
-- 문제: tournament_entry_fees 는 teams·tournaments 를 on delete cascade 로 참조한다.
--   관리자가 팀을 지우면(src/lib/admin-actions.ts deleteTeam) 또는 대회를 지우면 납부 기록이 함께 사라졌다.
-- 해결: 삭제는 지금처럼 동작하게 두고, 부모 행이 사라지기 **전에** 납부 사실을 별도 보관함으로 옮긴다.
--   * 팀·대회 BEFORE DELETE 트리거: 그 부모의 참가비 중 납부(paid)·일부 납부(partial)·납부일 있는 행을 복사.
--     이 시점에는 팀명·대회명·대표자 이름을 아직 읽을 수 있다.
--   * 참가비 행 BEFORE DELETE 트리거: 참가비만 직접 지우는 경우. 부모 삭제로 이미 옮겨진 행은 건너뛴다(fee_id 유일).
--     cascade 로 지워질 때 부모는 이미 보이지 않으므로 이름 스냅샷은 부모 트리거가 맡는다.
--   * 미납(unpaid, 납부일 없음) 행은 거래가 없으므로 보관하지 않는다.
-- 보관 항목과 이유:
--   fee_id·tournament_id·team_id  원래 행과 대조 (부모가 지워져도 값만 남는다, 외래키 없음)
--   tournament_name·team_name     부모가 사라진 뒤에도 어떤 대회·팀의 거래였는지 식별
--   payer_name                    신청 대표자(팀 captain) 이름. 참가 신청 계약의 당사자 — 팀이 지워지면 이 이름 없이는
--                                 환불·분쟁 때 거래 상대를 특정할 수 없다. 연락처는 보관하지 않는다(최소 수집).
--   amount·status·paid_at         대금결제 기록 그 자체
--   memo                          관리 화면 안내가 "입금자명, 분할 납부 등" — 납부 사실을 적는 칸이라 함께 보관
--   cause·deleted_at·deleted_by   언제 누가 어떤 삭제로 옮겼는지
--   purge_after                   납부일(없으면 마지막 수정일) + 5년. 그 뒤 purge_expired_entry_fee_records() 가 파기
-- 접근: service_role 만. 관리 화면(authenticated)에서도 읽지 않는다 — 법정 보관 목적 외 이용 금지(분리 보관).
-- 파기 일정: pg_cron 이 있으면 월 1회 예약한다 (적용자가 별도로 실행 — 여기서 예약하지 않는다):
--   select cron.schedule('purge-entry-fee-records', '0 4 1 * *', $$select public.purge_expired_entry_fee_records()$$);
--   없으면 운영자가 같은 함수를 분기마다 service_role 로 실행한다.
-- 의존: 20261015010000_consent_records.sql (legal_documents — 처리방침 개정판 시드)
-- ============================================================================
begin;

create table if not exists public.entry_fee_payment_records (
  fee_id          uuid primary key,
  tournament_id   uuid not null,
  tournament_name text,
  team_id         uuid not null,
  team_name       text,
  payer_name      text,
  amount          integer not null,
  status          text not null check (status in ('unpaid', 'partial', 'paid')),
  paid_at         timestamptz,
  memo            text,
  cause           text not null check (cause in ('team_deleted', 'tournament_deleted', 'fee_deleted')),
  deleted_at      timestamptz not null default clock_timestamp(),
  deleted_by      uuid,
  purge_after     timestamptz not null
);
create index if not exists entry_fee_payment_records_purge on public.entry_fee_payment_records (purge_after);
alter table public.entry_fee_payment_records enable row level security;
revoke all on public.entry_fee_payment_records from public, anon, authenticated;
grant select on public.entry_fee_payment_records to service_role;

-- p_scope: 'team' | 'tournament' | 'fee' — 그 범위의 보관 대상 참가비를 옮긴다. 이미 옮긴 행은 건너뛴다.
create or replace function public.retain_entry_fee_payments(p_scope text, p_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  insert into public.entry_fee_payment_records
    (fee_id, tournament_id, tournament_name, team_id, team_name, payer_name,
     amount, status, paid_at, memo, cause, deleted_by, purge_after)
  select f.id, f.tournament_id, tr.name, f.team_id, tm.name, p.name,
         f.amount, f.status, f.paid_at, f.memo,
         case p_scope when 'team' then 'team_deleted' when 'tournament' then 'tournament_deleted' else 'fee_deleted' end,
         auth.uid(), coalesce(f.paid_at, f.updated_at) + interval '5 years'
  from public.tournament_entry_fees f
  left join public.tournaments tr on tr.id = f.tournament_id
  left join public.teams tm on tm.id = f.team_id
  left join public.profiles p on p.id = tm.captain_id
  where (f.status in ('paid', 'partial') or f.paid_at is not null)
    and case p_scope when 'team' then f.team_id = p_id
                     when 'tournament' then f.tournament_id = p_id
                     when 'fee' then f.id = p_id
                     else false end
  on conflict (fee_id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.retain_entry_fee_payments(text, uuid) from public, anon, authenticated;

create or replace function public.retain_entry_fees_before_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.retain_entry_fee_payments(tg_argv[0], old.id);
  return old;
end $$;
revoke all on function public.retain_entry_fees_before_delete() from public, anon, authenticated;

drop trigger if exists retain_entry_fees_before_team_delete on public.teams;
create trigger retain_entry_fees_before_team_delete before delete on public.teams
  for each row execute function public.retain_entry_fees_before_delete('team');
drop trigger if exists retain_entry_fees_before_tournament_delete on public.tournaments;
create trigger retain_entry_fees_before_tournament_delete before delete on public.tournaments
  for each row execute function public.retain_entry_fees_before_delete('tournament');
drop trigger if exists retain_entry_fee_before_delete on public.tournament_entry_fees;
create trigger retain_entry_fee_before_delete before delete on public.tournament_entry_fees
  for each row execute function public.retain_entry_fees_before_delete('fee');

-- 보존기간이 지난 기록만 파기한다.
create or replace function public.purge_expired_entry_fee_records()
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  delete from public.entry_fee_payment_records where purge_after < clock_timestamp();
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.purge_expired_entry_fee_records() from public, anon, authenticated;
grant execute on function public.purge_expired_entry_fee_records() to service_role;

-- 개인정보처리방침 개정판(2026-10-15.2: 위 보관 사실 명시). 가입·동의 화면은 이 버전으로 기록한다.
insert into public.legal_documents (kind, version, body_hash, body) values
  ('privacy', '2026-10-15.2', 'c9e13dec26b06ec9b7201e2b5479440c336f03a45e7e6c5e9c53317025ea9699', '{"kind":"privacy","title":"페어그라운드(FairGround) 개인정보처리방침","version":"2026-10-15.2","effectiveAt":null,"sections":[{"heading":"개인정보의 처리 목적, 항목, 보유기간","pending":true,"body":["회원 가입·식별·관리 — 항목: [이메일 가입] 이름(실명), 이메일 또는 아이디, 비밀번호(일방향 암호화 저장), 전화번호, 성별, 생년월일, 선수 등록 이력(선출 여부) / [카카오·Google 가입] 계정 식별자, 이메일, 이름 또는 닉네임 / 보유기간: 회원 탈퇴 시까지 / 근거: 계약 이행","만 14세 이상 확인 — 항목: 생년월일, 만 14세 이상 확인 여부 / 보유기간: 회원 탈퇴 시까지 / 근거: 법령","대회 참가 자격 확인, 선수 등록, 현장 참가자 확인 — 항목: 이름, 성별, 생년월일, 선수 등록 이력(선출 여부), 소속 팀, 현장 확인 기록, 안경 착용 경기 참가 동의서(서명자 이름, 동의 문서 버전, 서명 일시) / 보유기간: 회원 탈퇴 시까지 / 근거: 계약 이행","선수카드 제작과 리그 기록 공개 (이름, 등번호, 포지션, 소속 팀, 선수카드 사진, 경기 기록이 사이트에 공개됩니다. 사진은 본인이 올린 경우에만 쓰며 언제든 바꾸거나 지울 수 있습니다) — 항목: 이름, 등번호, 포지션, 국적, 소속 팀, 선수카드 사진, 경기 기록(득점·도움·경고 등) / 보유기간: 회원 탈퇴 시까지 / 근거: 계약 이행","팀·대회 참가 신청 접수와 참가비 입금 확인 — 항목: 팀명, 대표자 이름·연락처, 참가비 청구 금액·입금 여부 / 보유기간: 팀 또는 대회 정보가 삭제될 때까지. 납부(일부 납부 포함) 기록은 아래 법정 보관 기록으로 5년간 분리 보관 / 근거: 계약 이행","게시판·팀 채팅·팀 갤러리·팀 회비 관리 등 커뮤니티 기능 제공 — 항목: 게시물, 댓글, 채팅 내용, 올린 사진, 팀 회비 납부 기록 / 보유기간: 게시물을 지우거나 회원 탈퇴 시까지 / 근거: 계약 이행","경기·대회 알림 발송 (웹 푸시, 이용자가 알림을 켠 경우) — 항목: 푸시 구독 정보(엔드포인트, 암호화 키), 브라우저 정보 / 보유기간: 알림을 끄거나 회원 탈퇴 시까지 / 근거: 동의","[선택] 대회 사진·영상과 선수카드 이미지의 홍보 이용 (동의한 경우에만) — 항목: 대회 현장에서 촬영된 본인의 사진·영상, 선수카드 이미지 / 보유기간: 동의일부터 2년. 철회하면 새로 게시하지 않고 게시물을 내리거나 가립니다 / 근거: 동의","동의 이력 보관 (어떤 문구에 언제 동의·철회했는지의 증빙) — 항목: 동의 항목, 문구 버전, 동의·철회 여부와 일시, 브라우저 정보 / 보유기간: [확정 필요] 탈퇴 후 보관 기간 / 근거: 법령","문의 응대 — 항목: 이메일 주소, 문의 내용 / 보유기간: 소비자 불만·분쟁 처리 기록 3년 (전자상거래법) / 근거: 계약 이행"]},{"heading":"개인정보의 파기 절차 및 방법","pending":false,"body":["보유기간이 지나거나 처리 목적이 달성된 개인정보는 지체 없이 파기합니다.","전자적 파일은 복구할 수 없는 방법으로 삭제하고, 종이 문서는 분쇄하거나 소각합니다.","다만 아래 기록은 법령에 따라 별도로 분리해 보관한 뒤 기간이 지나면 파기합니다.","계약 또는 청약철회 등에 관한 기록: 5년 (전자상거래법 시행령 제6조)","참가비 납부 기록 — 대회명, 팀명, 신청 대표자 이름, 금액, 납부 상태·일시, 입금 메모 (팀·대회가 삭제되면 삭제 시점의 내용을 운영 데이터와 분리된 별도 보관함에 옮겨 보관하고, 보관 목적 외에는 이용하지 않습니다): 납부일부터 5년 (전자상거래법 시행령 제6조)","소비자의 불만 또는 분쟁처리에 관한 기록: 3년 (전자상거래법 시행령 제6조)","표시·광고에 관한 기록: 6개월 (전자상거래법 시행령 제6조)","웹사이트 방문 기록(접속 로그): 3개월 (통신비밀보호법 시행령 제41조)"]},{"heading":"개인정보의 제3자 제공","body":["페어그라운드(FairGround)은(는) 이용자의 개인정보를 제3자에게 제공하지 않습니다. 법령에 특별한 규정이 있는 경우는 예외입니다."]},{"heading":"개인정보 처리업무의 위탁","body":["Supabase Inc.: 회원 인증, 데이터베이스·파일 저장 (데이터베이스 서버: 서울 리전)","Vercel Inc.: 웹사이트 호스팅과 요청 처리","Telegram Messenger Inc.: 새 팀 참가 신청을 운영진에게 알리는 메시지 전송","Google LLC: 대회 사진 원본 저장(Google Drive), Google 로그인","(주)카카오: 카카오 로그인, 카카오톡 공유","위탁계약 시 개인정보 보호 관련 법령 준수, 재위탁 제한, 안전성 확보조치, 손해배상 책임을 계약서에 명시하고 수탁자를 관리·감독합니다."]},{"heading":"개인정보의 국외 이전","body":["Vercel Inc. (미국, 연락처 [확정 필요] 연락처) — 항목: 접속 기록(IP 주소, 브라우저 정보), 이용 중 주고받는 정보 / 시기·방법: 사이트를 이용할 때마다, 네트워크를 통한 전송 / 목적: 웹사이트 호스팅 / 보유기간: 위탁 계약 종료 시까지","Telegram Messenger Inc. ([확정 필요] 국가, 연락처 [확정 필요] 연락처) — 항목: 팀명, 대표자 이름·연락처 / 시기·방법: 팀 참가 신청 시, 네트워크를 통한 전송 / 목적: 운영진 신청 알림 / 보유기간: [확정 필요] 운영진 대화방 보관 기간","Google LLC (미국, 연락처 [확정 필요] 연락처) — 항목: 대회 현장 사진 원본(얼굴이 담긴 사진 포함) / 시기·방법: 사진 자료실 게시 시, 네트워크를 통한 전송 / 목적: 사진 원본 저장과 내려받기 제공 / 보유기간: 자료실 게시 종료 시까지","웹 푸시 서비스 (Google·Apple·Mozilla 등 이용자 브라우저 제조사) (미국 등, 연락처 각 브라우저 제조사) — 항목: 푸시 구독 정보, 알림 내용 / 시기·방법: 알림 발송 시, 네트워크를 통한 전송 / 목적: 웹 푸시 알림 전달 / 보유기간: 전달 후 각 서비스 정책에 따름","국외 이전을 원하지 않으시면 회원 탈퇴로 거부할 수 있습니다. 다만 서비스 제공에 필수적인 이전이므로 거부 시 서비스 이용이 어렵습니다."],"pending":true},{"heading":"정보주체와 법정대리인의 권리·의무 및 행사방법","body":["이용자는 언제든지 개인정보의 열람·정정·삭제·처리정지 및 동의 철회를 요구할 수 있습니다.","마이페이지에서 직접 처리하거나 아래 개인정보 보호책임자에게 서면·이메일로 요청할 수 있으며, 지체 없이 조치합니다."]},{"heading":"개인정보의 안전성 확보조치","body":["관리적 조치: 내부관리계획 수립·시행, 개인정보 취급자 최소화 및 정기 교육.","기술적 조치: 접근권한 관리와 접근통제, 비밀번호 일방향 암호화 저장, 전송 구간 암호화(TLS), 접속기록 보관 및 위·변조 방지.","물리적 조치: 클라우드 서비스 수탁자의 물리적 보안 통제를 계약으로 확인합니다."]},{"heading":"개인정보 자동 수집 장치의 설치·운영 및 거부","body":["로그인 유지에 필요한 쿠키 외에 행태정보를 수집하는 장치를 사용하지 않습니다."]},{"heading":"개인정보 보호책임자","pending":true,"body":["처리자: [확정 필요] 상호","개인정보 보호책임자: [확정 필요] 성명 또는 담당 부서","연락처: info@fairground-kor.com"]},{"heading":"권익침해 구제방법","body":["개인정보분쟁조정위원회 1833-6972 (www.kopico.go.kr)","개인정보침해신고센터 118 (privacy.kisa.or.kr)","대검찰청 1301 (www.spo.go.kr) · 경찰청 182 (ecrm.police.go.kr)"]},{"heading":"처리방침의 변경","pending":true,"body":["이 처리방침은 [확정 필요] 시행일부터 적용됩니다.","내용을 바꿀 때는 시행 7일 전부터, 이용자 권리에 중요한 변경은 30일 전부터 공지합니다. 이전 버전은 아래에서 열람할 수 있습니다."]}]}'::jsonb)
on conflict (kind, version) do nothing;

commit;
