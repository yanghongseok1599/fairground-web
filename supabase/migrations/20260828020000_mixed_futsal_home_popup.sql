-- Promote the October mixed-futsal tournament on the home application popup.
update public.site_popups
set is_active = false
where placement = 'home';

insert into public.site_popups (
  placement,
  name,
  is_active,
  priority,
  dismiss_version,
  display_delay_ms,
  eyebrow,
  title,
  body,
  detail_one,
  detail_two,
  detail_three,
  detail_four,
  image_url,
  cta_label,
  cta_href,
  secondary_label,
  secondary_href,
  starts_at,
  ends_at
)
select
  'home',
  '제1회 페어그라운드 혼성 풋살 대회',
  true,
  300,
  1,
  650,
  'MIXED FUTSAL 2026',
  '제1회 페어그라운드|혼성 풋살 대회',
  '남녀가 한 팀으로 함께 뛰고, 참가한 모든 팀이 끝까지 경기를 즐기는 풋살 페스티벌입니다.',
  '서울 은평구',
  '2026년 10월 3일 토요일',
  '얼리버드 9월 7일까지 40만원 · 일반 45만원',
  '혼성 5인제 · 비선출 · 팀당 5경기',
  '/images/tournaments/mixed-futsal-2026/01-cover.png',
  '참가 신청하기',
  '/mixed-futsal/apply',
  '대회 안내 보기',
  '/mixed-futsal',
  null,
  '2026-10-03T14:59:59+00:00'
where not exists (
  select 1
  from public.site_popups
  where placement = 'home'
    and name = '제1회 페어그라운드 혼성 풋살 대회'
);

update public.site_popups
set
  is_active = true,
  priority = 300,
  dismiss_version = greatest(dismiss_version, 1),
  display_delay_ms = 650,
  eyebrow = 'MIXED FUTSAL 2026',
  title = '제1회 페어그라운드|혼성 풋살 대회',
  body = '남녀가 한 팀으로 함께 뛰고, 참가한 모든 팀이 끝까지 경기를 즐기는 풋살 페스티벌입니다.',
  detail_one = '서울 은평구',
  detail_two = '2026년 10월 3일 토요일',
  detail_three = '얼리버드 9월 7일까지 40만원 · 일반 45만원',
  detail_four = '혼성 5인제 · 비선출 · 팀당 5경기',
  image_url = '/images/tournaments/mixed-futsal-2026/01-cover.png',
  cta_label = '참가 신청하기',
  cta_href = '/mixed-futsal/apply',
  secondary_label = '대회 안내 보기',
  secondary_href = '/mixed-futsal',
  starts_at = null,
  ends_at = '2026-10-03T14:59:59+00:00'
where placement = 'home'
  and name = '제1회 페어그라운드 혼성 풋살 대회';
