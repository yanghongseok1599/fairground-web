-- 선수카드 등록 시 선수 본인이 준 "대회 현장 촬영물의 홍보·마케팅 활용" 동의 기록.
-- teams.portrait_consent_at 이 팀 대표의 대리 진술이라면, 이쪽은 개인 본인 동의다.
-- NULL = 동의 기록 없음(이 컬럼 도입 전에 등록된 선수 포함). 백필하지 않는다.
alter table public.profiles
  add column if not exists portrait_consent_at timestamptz;

comment on column public.profiles.portrait_consent_at is
  '대회 현장 촬영물의 홍보·마케팅(상업적 이용 포함) 활용에 선수 본인이 동의한 시각. NULL 이면 동의 기록 없음.';
