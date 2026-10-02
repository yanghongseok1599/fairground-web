# Preview 기록 저장 배포 복구 · 2026-10-03

사진의 `cf183eb` 자동 Preview 로그는 개발 DB에 `apply_match_recording_operation`, `get_match_recording_snapshot`이 없어 prebuild 정합성 검사가 차단한 것으로 확인됐다. 해당 알림은 운영 Supabase 장애를 뜻하지 않는다.

개발 스키마 532,279바이트를 격리 PostgreSQL에 복원하여 5,694개 정의가 일치함을 확인했다. 저장 기능 테스트에서 기존 `end_match`의 bigint 인수 오류도 발견했다. 이미 운영에서 검증된 `20260928010000_match_finalization_regression_fix.sql`, `20261003030000_match_recording_outbox.sql` 두 파일을 같은 해시로 개발에 적용했다. 정의 diff는 추가/변경 60개·교체 전 함수 3개이며 권한과 롤백을 검증했다.

기존 34개 보호 테이블의 기존 컬럼 값, 합성 회원 15명, 이력 11건을 보존하고 새 이력 2건만 추가했다. 새 `source_yellow_event_id` 값은 기존 이벤트 모두 null이다. 운영 DB, 실제 회원·경기, 운영 도메인은 이 복구에서 변경하지 않았다.

- 격리 DB 실제 역할 테스트: 9/9 통과. 동시 재전송, 골 취소, 카드, MOM, 경기 종료, 접근 제한 포함.
- 실제 배포 소스 개발 카탈로그: 타입 컬럼 365개, 조회 85개 통과.
- 동일 `cf183eb` 재배포: `dpl_DkKkYf1mRUm6VuwHLJJTTycqLLi3`, 최종 **Ready** 확인.
- [복구 Preview](https://fairground-33t9wx4uq-milestones-projects-d52c4dda.vercel.app)

보호 백업·실행 기록은 Git 외부 `output/ops/2026-10-03-shared-recording/dev-outbox-repair`에 보관했다. 전체 이력 불일치는 남아 있으므로 linked push/reset/repair 금지는 유지한다.

사용자 요청에 따라 로컬 `fairground-supabase-safety` 스킬과 `references/reliability.md`에 재발 원인, hosted 개발 선반영, 실제 역할 테스트, 자동 Preview 최종 확인, 실제 경기 대기열 보존 규칙을 저장했다. 저장소 AGENTS에도 스킬 적용을 연결했다. 스킬 검증과 저장소 Supabase 안전 테스트 4개를 통과했다.
