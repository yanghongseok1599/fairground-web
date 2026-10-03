# 2026-10-03 다음 팀 자동 준비 알림

경기 시작 시 다음 경기 양 팀의 승인 선수·주장에게 준비 안내를 보내고, 현재 경기 종료 5분 전 다시 안내한다. 경기 시간은 단일12분이므로 두 번째 발송 기준은 실제 경과420초다. 정지 시간은 제외하며 새로고침·다른 기록 기기·재시도에도 단계별 알림을 한 번만 생성한다.

## 서버 반영

- 코드 커밋: `a25fa1dfba990b7d2cbad994bfde028e8262f559`.
- 개발 스키마 백업552,472바이트·5,903개 정의/권한, 운영601,796바이트·5,226개 정의/권한을 임시 PostgreSQL에 복원해 일치 확인했다. 실제 사용자 데이터는 개발이나 복원 DB로 복사하지 않았다.
- `20261003060000_two_stage_next_match_ready.sql`: nullable 알림 단계, 기존 NULL 단계의 시작 안내 호환, 단계별 유니크 키, 승인 참가자 범위, 내부 함수 권한 차단, 서버 시각 기반 발송.
- `20261003060100_next_match_ready_scheduler.sql`: Supabase 내장 pg_cron1.6.4 활성화, postgres 소유10초 작업, 이 작업들의 실행 이력만7일 유지하는 일일 작업. 두 환경에서 동일 SQL 생성·검수·롤백도 통과했다.
- `20261003060200_next_match_ready_final_state.sql`: 지연 constraint trigger가 커밋의 최종 경기 상태를 확인하여 조기 종료/일괄 시작·종료의 늦은 안내를 막는다. 알림 INSERT 실패는 경기 제어를 막지 않고 예약 작업이 재시도한다. 두 단계 INSERT의 일부 실패가 롤백된 경우 반환 건수도0이다.
- 운영10:27:24KST 최종 적용. 운영32개 보호 테이블(회원135명·경기12개·기존 알림356건)의 기존 컬럼 값과 이력77건을 유지했다. 개발33개 보호 테이블과 기존 이력15건도 보존했다. 환경별 새 이력3건만 추가했다. 전체 이력 불일치는 별개로 남으며 linked push/reset/repair는 금지한다.
- 실제 경기 시작·중지·종료·점수·이벤트·기록 대기열은 검수를 위해 변경하지 않았다. 알림 생성은 기존 notifications→push-dispatch 경로를 사용한다. 휴대폰 푸시는 알림 권한과 등록된 구독이 있는 기기에 전달된다.

## 검증

각 복원 DB에서 실제 API 역할을 사용한 알림15개와 기존 경기종료5개 테스트를 통과했다. 시작·419/420초·시간 건너뛰기·일시정지/재개·서버 시각·동시 요청·SKIP LOCKED·기존 NULL 단계·일반회원/미승인 역할 거부·다음 경기 없음·취소/종료/720초·공동기록 명령 재시도·발송 실패 복구·조기 종료 경계를 검증했다. 기존 경기/시계/스코어/이벤트/영수증 불변도 확인했다.

관련 클라이언트 테스트, 보안7개·안전장치4개, TypeScript 및 전체 lint(오류0·기존 경고16개)를 통과했다. 정확한 추적 소스만 포함한 개발 정상 빌드와 실제 운영 카탈로그를 확인하는 Vercel 빌드가 통과했고, 운영 산출물의 DB 비밀번호 바이트 검사도 통과했다. 별도의 전체 npm 감사 경고9건은 공식 패치 미출시인 braces의 빌드 도구 경로로 [보안 기준선](../security-baseline.md)에 기록했다.

## 웹 배포

- 자동 Preview: [fairground-ain7lqdzk](https://fairground-ain7lqdzk-milestones-projects-d52c4dda.vercel.app), `dpl_DNYjn6DSftG6g1hm9miR458VJQxq` **Ready**. 개발 카탈로그 게이트를 유지한 자동 빌드를 확인했다.
- 운영 사전 빌드: [fairground-22jzxmsbg](https://fairground-22jzxmsbg-milestones-projects-d52c4dda.vercel.app), `dpl_6jNLua2racgFijM9h87TqQ4Hcug2` **Ready**.
- 공식 도메인: 새 Ready 배포를 [fairground-kor.com](https://fairground-kor.com)에 승격 완료했다. 서버 예약 작업과 내부 API 차단, 최종 상태 트리거를 운영·개발 각각 읽기 전용으로 재확인했다.

## 복구

DDL 적용 전 SQL 전체 트랜잭션 롤백으로 기존 정의·권한 복원을 검증했다. 운영 중 자동 안내만 중지하려면 이 작업 두 개만 `cron.alter_job(jobid, active:=false)`로 비활성화하고 `public.matches`의 `next_match_ready_after_clock` 트리거만 비활성화한다. 기존 알림·단계 컬럼·인덱스·이력·실제 경기 대기열은 유지한다. 이미 전달한 두 단계 알림을 삭제하거나 과거 단일 단계 유니크 인덱스를 강제로 복구하지 않는다.

백업·diff·SQL 해시·보호 행 해시·실행/역할 테스트·예약 작업 상태·빌드 로그는 작업폴더의 `output/ops/2026-10-03-next-match-notice`에 권한 제한으로 보관한다.
