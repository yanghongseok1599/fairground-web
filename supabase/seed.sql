-- FairGround 개발용 시드 데이터
--
-- 대상: 개발 Supabase 프로젝트 fairground-dev (ref fhytkbjadhnmozppolrv) 전용.
--       운영(ovtnmslyjzvghirdvife)에는 절대 실행하지 말 것.
--
-- 적용:
--   cd fairground-web
--   set -a; . ./.env.development.local; set +a
--   /opt/homebrew/opt/postgresql@17/bin/psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/seed.sql
--
-- 멱등: 고정 UUID + on conflict 라 몇 번을 돌려도 결과가 같다.
-- 데이터: 전부 가공. 실제 회원·팀·연락처 없음.
--
-- 개발 계정 (비밀번호 전부 devpassword123):
--   admin@example.com 관리자 / referee@example.com 심판 / coach@example.com 감독
--   captain@example.com 주장 / player01~player10@example.com 선수 / pending@example.com 승인대기
--
-- auth.users insert 시 on_auth_user_created 트리거가 public.profiles 를 자동 생성한다.
-- 시드는 postgres 롤로 직접 쓰므로 auth.uid() 가 없어 권한 가드(guard_*)를 통과하지 못한다.
-- 그래서 가드 트리거만 골라 잠시 끄고 끝나면 되돌린다. DDL 도 트랜잭션 안이라 실패 시 함께 롤백된다.

begin;

do $$
declare r record;
begin
  for r in
    select c.relname, t.tgname
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_proc p on p.oid = t.tgfoid
    where n.nspname = 'public' and not t.tgisinternal
      and c.relname in ('profiles','teams','matches','match_events')
      and p.proname like 'guard%'
  loop
    execute format('alter table public.%I disable trigger %I', r.relname, r.tgname);
  end loop;
end $$;

insert into public.teams (id, name, logo, is_approved, team_type, league_tier, founded_year, description)
values
  ('11111111-1111-4111-8111-111111111111', 'FC 하늘', '', true, 'community', 'silver', 2021, '개발용 가상 팀 A'),
  ('22222222-2222-4222-8222-222222222222', '미드나잇 클럽', '', true, 'club', 'bronze', 2023, '개발용 가상 팀 B')
on conflict (id) do update set name=excluded.name, is_approved=excluded.is_approved, team_type=excluded.team_type,
  league_tier=excluded.league_tier, founded_year=excluded.founded_year, description=excluded.description;

insert into public.seasons (id, year, name, is_active, start_date, end_date)
values ('33333333-3333-4333-8333-333333333333', 2026, '2026 시즌', true, '2026-03-01', '2026-11-30')
on conflict (id) do update set year=excluded.year, name=excluded.name, is_active=excluded.is_active,
  start_date=excluded.start_date, end_date=excluded.end_date;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', v.id, 'authenticated', 'authenticated', v.email,
  extensions.crypt('devpassword123', extensions.gen_salt('bf')), now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('name', v.display_name) || case when v.team_id is null then '{}'::jsonb else jsonb_build_object('team_id', v.team_id::text) end,
  '', '', '', ''
from (values
  ('a0000000-0000-4000-8000-000000000001'::uuid, 'admin@example.com',    '김관리', null::uuid),
  ('a0000000-0000-4000-8000-000000000002'::uuid, 'referee@example.com',  '이심판', null::uuid),
  ('a0000000-0000-4000-8000-000000000003'::uuid, 'coach@example.com',    '박감독', '11111111-1111-4111-8111-111111111111'::uuid),
  ('a0000000-0000-4000-8000-000000000004'::uuid, 'captain@example.com',  '최주장', '11111111-1111-4111-8111-111111111111'::uuid),
  ('a0000000-0000-4000-8000-000000000011'::uuid, 'player01@example.com', '김하늘', '11111111-1111-4111-8111-111111111111'::uuid),
  ('a0000000-0000-4000-8000-000000000012'::uuid, 'player02@example.com', '박도윤', '11111111-1111-4111-8111-111111111111'::uuid),
  ('a0000000-0000-4000-8000-000000000013'::uuid, 'player03@example.com', '정서준', '11111111-1111-4111-8111-111111111111'::uuid),
  ('a0000000-0000-4000-8000-000000000014'::uuid, 'player04@example.com', '한지호', '22222222-2222-4222-8222-222222222222'::uuid),
  ('a0000000-0000-4000-8000-000000000015'::uuid, 'player05@example.com', '오시우', '22222222-2222-4222-8222-222222222222'::uuid),
  ('a0000000-0000-4000-8000-000000000016'::uuid, 'player06@example.com', '문건우', '22222222-2222-4222-8222-222222222222'::uuid),
  ('a0000000-0000-4000-8000-000000000017'::uuid, 'player07@example.com', '신유진', '22222222-2222-4222-8222-222222222222'::uuid),
  ('a0000000-0000-4000-8000-000000000018'::uuid, 'player08@example.com', '배소율', null::uuid),
  ('a0000000-0000-4000-8000-000000000019'::uuid, 'player09@example.com', '류하진', null::uuid),
  ('a0000000-0000-4000-8000-00000000001a'::uuid, 'player10@example.com', '전민서', null::uuid),
  ('a0000000-0000-4000-8000-00000000001b'::uuid, 'pending@example.com',  '노대기', null::uuid)
) as v(id, email, display_name, team_id)
on conflict (id) do nothing;

update public.profiles p
set role=v.role::player_role_t, team_role=v.team_role::team_role_t, number=v.number,
    position=v.position::position_t, is_approved=v.is_approved, goals=v.goals, assists=v.assists,
    games=v.games, mom=v.mom, card_rating=v.card_rating, card_type=v.card_type::card_type_t
from (values
  ('a0000000-0000-4000-8000-000000000001'::uuid, 'admin',   null,      0,  'ALA',  true,  0, 0, 0, 0, 70, 'gold'),
  ('a0000000-0000-4000-8000-000000000002'::uuid, 'referee', null,      0,  'ALA',  true,  0, 0, 0, 0, 70, 'gold'),
  ('a0000000-0000-4000-8000-000000000003'::uuid, 'player',  'coach',   0,  'FIXO', true,  0, 0, 0, 0, 70, 'gold'),
  ('a0000000-0000-4000-8000-000000000004'::uuid, 'captain', 'captain', 10, 'PIVO', true,  6, 3, 8, 2, 84, 'premium'),
  ('a0000000-0000-4000-8000-000000000011'::uuid, 'player',  'member',  7,  'ALA',  true,  4, 5, 8, 1, 79, 'gold'),
  ('a0000000-0000-4000-8000-000000000012'::uuid, 'player',  'member',  3,  'FIXO', true,  1, 2, 8, 0, 73, 'gold'),
  ('a0000000-0000-4000-8000-000000000013'::uuid, 'player',  'member',  1,  'GK',   true,  0, 0, 8, 1, 76, 'gold'),
  ('a0000000-0000-4000-8000-000000000014'::uuid, 'player',  'captain', 9,  'PIVO', true,  7, 1, 8, 3, 85, 'premium'),
  ('a0000000-0000-4000-8000-000000000015'::uuid, 'player',  'member',  4,  'ALA',  true,  2, 4, 8, 0, 75, 'gold'),
  ('a0000000-0000-4000-8000-000000000016'::uuid, 'player',  'member',  5,  'FIXO', true,  0, 1, 7, 0, 71, 'gold'),
  ('a0000000-0000-4000-8000-000000000017'::uuid, 'player',  'member',  12, 'GK',   true,  0, 0, 7, 1, 74, 'gold'),
  ('a0000000-0000-4000-8000-000000000018'::uuid, 'player',  null,      0,  'ALA',  true,  0, 0, 0, 0, 70, 'gold'),
  ('a0000000-0000-4000-8000-000000000019'::uuid, 'player',  null,      0,  'PIVO', true,  0, 0, 0, 0, 70, 'gold'),
  ('a0000000-0000-4000-8000-00000000001a'::uuid, 'player',  null,      0,  'FIXO', true,  0, 0, 0, 0, 70, 'gold'),
  ('a0000000-0000-4000-8000-00000000001b'::uuid, 'player',  null,      0,  'ALA',  false, 0, 0, 0, 0, 70, 'gold')
) as v(id, role, team_role, number, position, is_approved, goals, assists, games, mom, card_rating, card_type)
where p.id = v.id;

update public.teams set captain_id='a0000000-0000-4000-8000-000000000004' where id='11111111-1111-4111-8111-111111111111';
update public.teams set captain_id='a0000000-0000-4000-8000-000000000014' where id='22222222-2222-4222-8222-222222222222';
update public.teams t set member_count=(select count(*) from public.profiles p where p.team_id=t.id)
where t.id in ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');

insert into public.matches (id, round, home_team_id, away_team_id, home_team_name, away_team_name,
  home_score, away_score, status, scheduled_at, mom_player_id, stats_applied)
values
  ('c0000000-0000-4000-8000-000000000001', 1, '11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222',
   'FC 하늘','미드나잇 클럽',3,2,'finished','2026-04-12 10:00+09','a0000000-0000-4000-8000-000000000004',true),
  ('c0000000-0000-4000-8000-000000000002', 2, '22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111',
   '미드나잇 클럽','FC 하늘',4,1,'finished','2026-05-10 10:00+09','a0000000-0000-4000-8000-000000000014',true),
  ('c0000000-0000-4000-8000-000000000003', 3, '11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222',
   'FC 하늘','미드나잇 클럽',0,0,'scheduled','2026-10-18 10:00+09',null,false)
on conflict (id) do update set home_score=excluded.home_score, away_score=excluded.away_score,
  status=excluded.status, scheduled_at=excluded.scheduled_at, mom_player_id=excluded.mom_player_id,
  stats_applied=excluded.stats_applied;

insert into public.match_events (id, match_id, type, player_id, player_name, team_id, minute, half)
values
  ('e0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','goal','a0000000-0000-4000-8000-000000000004','최주장','11111111-1111-4111-8111-111111111111',6,1),
  ('e0000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000001','assist','a0000000-0000-4000-8000-000000000011','김하늘','11111111-1111-4111-8111-111111111111',6,1),
  ('e0000000-0000-4000-8000-000000000003','c0000000-0000-4000-8000-000000000001','goal','a0000000-0000-4000-8000-000000000014','한지호','22222222-2222-4222-8222-222222222222',14,1),
  ('e0000000-0000-4000-8000-000000000004','c0000000-0000-4000-8000-000000000001','yellow_card','a0000000-0000-4000-8000-000000000012','박도윤','11111111-1111-4111-8111-111111111111',19,2),
  ('e0000000-0000-4000-8000-000000000005','c0000000-0000-4000-8000-000000000001','goal','a0000000-0000-4000-8000-000000000011','김하늘','11111111-1111-4111-8111-111111111111',27,2),
  ('e0000000-0000-4000-8000-000000000006','c0000000-0000-4000-8000-000000000001','mom','a0000000-0000-4000-8000-000000000004','최주장','11111111-1111-4111-8111-111111111111',40,2)
on conflict (id) do update set type=excluded.type, player_name=excluded.player_name,
  minute=excluded.minute, half=excluded.half, is_cancelled=false;

insert into public.notices (id, title, body, category, is_pinned, is_important, author_id)
values
  ('d0000000-0000-4000-8000-000000000001','개발 환경 안내','이 데이터는 개발용 시드입니다. 실제 회원 정보가 아닙니다.','운영',true,false,'a0000000-0000-4000-8000-000000000001'),
  ('d0000000-0000-4000-8000-000000000002','2026 시즌 일정 공지','3월 개막, 11월 폐막 예정입니다.','운영',false,false,'a0000000-0000-4000-8000-000000000001')
on conflict (id) do update set title=excluded.title, body=excluded.body,
  is_pinned=excluded.is_pinned, is_important=excluded.is_important;

do $$
declare r record;
begin
  for r in
    select c.relname, t.tgname
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_proc p on p.oid = t.tgfoid
    where n.nspname = 'public' and not t.tgisinternal
      and c.relname in ('profiles','teams','matches','match_events')
      and p.proname like 'guard%'
  loop
    execute format('alter table public.%I enable trigger %I', r.relname, r.tgname);
  end loop;
end $$;

commit;
