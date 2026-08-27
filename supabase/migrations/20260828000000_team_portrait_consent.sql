-- 참가 신청 시 받은 "대회 현장 촬영물의 홍보·마케팅 활용" 동의 기록.
-- NULL = 동의 기록 없음(이 컬럼 도입 전에 생성된 팀 포함). 기존 행을 임의의
-- 시각으로 백필하면 받지 않은 동의를 받은 것처럼 만들게 되므로 백필하지 않는다.
alter table public.teams
  add column if not exists portrait_consent_at timestamptz;

comment on column public.teams.portrait_consent_at is
  '대회 현장 촬영물의 홍보·마케팅(상업적 이용 포함) 활용에 팀 대표가 동의한 시각. NULL 이면 동의 기록 없음.';
