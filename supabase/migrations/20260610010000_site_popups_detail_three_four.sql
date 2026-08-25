-- 사이트 팝업에 추가 정보 슬롯 2개(총상금/참가비 등) 추가.
-- 기존 detail_one(장소)·detail_two(날짜)에 이어 detail_three·detail_four 를 둔다.
alter table public.site_popups
  add column if not exists detail_three text not null default '',
  add column if not exists detail_four  text not null default '';

-- 전국 대학대항전 비치사커대회 팝업에 총상금·참가비 안내 추가
update public.site_popups
  set detail_three = '총상금 150만원',
      detail_four  = '참가비 30만원'
  where id = 'a5e401c9-e494-4b2e-971b-2e28c85214f7';
