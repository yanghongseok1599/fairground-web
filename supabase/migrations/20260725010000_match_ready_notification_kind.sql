-- 경기 종료 10분 전 다음 경기 준비 알림 타입.
-- PostgreSQL enum ADD VALUE 는 같은 트랜잭션에서 즉시 사용하면 실패할 수 있어
-- 실제 insert/RPC 마이그레이션과 분리한다.
alter type public.notification_kind_t add value if not exists 'match_ready';
