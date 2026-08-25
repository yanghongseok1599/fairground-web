-- 선수 승인 / 팀 역할·소유권 변경 알림용 kind 추가.
-- (enum ADD VALUE 는 사용하는 마이그레이션과 분리해야 한다.)
alter type public.notification_kind_t add value if not exists 'player_approved';
alter type public.notification_kind_t add value if not exists 'team_role_changed';
