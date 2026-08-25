-- Replace the home promotional popup with the Mangsang Ground Challenge entry.
update public.site_popups
set is_active = false
where placement = 'home'
  and (
    name ilike '%비치사커%'
    or title ilike '%비치사커%'
    or cta_href like '/beach-soccer%'
  );

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
  '망상 그라운드 챌린지',
  true,
  200,
  1,
  650,
  'GROUND CHALLENGE',
  '망상|그라운드 챌린지',
  '망상해수욕장에서 자기 사진으로 홀로그램 선수카드를 만들고, 슈팅 스피드·타겟 슈팅·에어볼 터치 3가지 챌린지 기록을 남깁니다.',
  '강원 동해시 망상해수욕장',
  '2026년 8월 7일 금요일부터 8월 9일 일요일까지',
  '홀로그램 선수카드 발급',
  '3가지 챌린지 현장 기록',
  '/images/hologram-card.webp',
  '이벤트 선수카드 만들기',
  '/register?event=ground-challenge',
  '이미 가입했어요',
  '/my/player-setup?role=player&event=ground-challenge',
  null,
  null
where not exists (
  select 1
  from public.site_popups
  where placement = 'home'
    and name = '망상 그라운드 챌린지'
);

update public.site_popups
set
  is_active = true,
  priority = 200,
  dismiss_version = 1,
  display_delay_ms = 650,
  eyebrow = 'GROUND CHALLENGE',
  title = '망상|그라운드 챌린지',
  body = '망상해수욕장에서 자기 사진으로 홀로그램 선수카드를 만들고, 슈팅 스피드·타겟 슈팅·에어볼 터치 3가지 챌린지 기록을 남깁니다.',
  detail_one = '강원 동해시 망상해수욕장',
  detail_two = '2026년 8월 7일 금요일부터 8월 9일 일요일까지',
  detail_three = '홀로그램 선수카드 발급',
  detail_four = '3가지 챌린지 현장 기록',
  image_url = '/images/hologram-card.webp',
  cta_label = '이벤트 선수카드 만들기',
  cta_href = '/register?event=ground-challenge',
  secondary_label = '이미 가입했어요',
  secondary_href = '/my/player-setup?role=player&event=ground-challenge'
where placement = 'home'
  and name = '망상 그라운드 챌린지';
