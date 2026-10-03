# 2026-10-03 승부차기 결과 기록

13경기 이후 순위결정전의 정규 점수가 동점이면, 양 팀의 승부차기 최종 성공 횟수를 별도로 저장한다. 선수 득점 이벤트나 정규 점수에 합산하지 않는다. 승인 심판·관리자가 중지된 진행 경기에서 저장하고 종료할 수 있으며, 종료된 동점 경기의 결과도 수정할 수 있다.

## DB 반영

- SQL: `supabase/migrations/20261003080000_match_shootout.sql`
- SHA-256: `3c031341e5256d88e466b7aee6c1aae6b86c71e9bdbe23f2fbf2c708f6cdaf03`
- 개발: 2026-10-03 14:43:17 KST 적용, 기존 이력 20 → 21건.
- 운영: 2026-10-03 14:43:41 KST 적용, 기존 이력 82 → 83건.
- 두 환경 모두 커밋 뒤 새 연결의 읽기 전용 트랜잭션으로 실제 정의와 신규 이력 1건을 재조회했다.

`matches`에 nullable 정수 컬럼 `home_shootout_score`, `away_shootout_score`와 0~99 범위·두 값 동시 저장·비동점 제약을 추가했다. 기존 행의 신규 값은 모두 null이다. `apply_match_recording_operation` 함수 한 개에 `shootout` 명령과 동점 순위결정전 종료 전 결과 확인을 추가했다. 기존 `get_match_recording_snapshot`의 `to_jsonb(matches)`가 신규 값을 반환한다.

명령은 기존 UUID 영수증·승인 권한·경기 행 잠금을 사용한다. `_shootoutHomeBefore`, `_shootoutAwayBefore`로 관측한 직전 값(NULL은 -1)을 검수해 동시 수정 덮어쓰기를 거부한다. 같은 UUID·payload 재전송은 재적용하지 않으며, 응답 유실 후에도 기존 영수증으로 복구한다. optional `_serverRevision` 검수도 지원한다.

진행 중 시계가 움직이는 경기, 조별 경기, 13경기 이전, 예정/취소 경기와 정규 비동점 경기에는 입력을 거부한다. 종료된 정규 동점 경기는 승부차기 결과만 수정한다. 기존 `end_match`·`forfeit_match` 본문, 정규 득점/선수/팀 집계, 스냅샷 함수, 이벤트, RLS와 트리거는 변경하지 않았다. 구형 클라이언트의 직접 `end_match` RPC는 호환성을 유지한다.

## 백업과 검증

최신 대상별 스키마 아카이브를 목록 검사 후 로컬 격리 PostgreSQL에 복원했다. 운영 회원·경기 데이터는 개발로 복사하지 않았다.

| 검증 | 개발 | 운영 |
| --- | ---: | ---: |
| 백업 아카이브 크기 | 564,942 bytes | 614,266 bytes |
| 복원 후 동일 정의/권한 수 | 5,855 | 5,179 |
| 기존 값을 보존한 public 테이블 수 | 34 | 33 |
| 기존 프로필 수 | 15(합성) | 135 |
| 기존 경기 수 | 3 | 16 |
| 실제 역할 DB 테스트 | 29/29 | 29/29 |

실제 스키마 diff는 함수 1개 교체와 신규 컬럼 2개·제약 1개·신규 컬럼에 상속되는 권한뿐이다. 동일 SQL의 트랜잭션 롤백과 명시 롤백이 기준 스키마와 일치했다. 새 승부차기 DB 테스트 13개와 기존 기기 저장/공동 기록 테스트 16개를 두 복원본에서 통과했다. 권한 거부, 점수 검수, 시계 중지 검수, 기대 값 충돌, UUID 재전송, 다른 기록자 동시 수정, 종료, 사후 수정과 정규 통계 보존을 확인했다.

적용 트랜잭션에서 기존 public 테이블의 신규 컬럼을 제외한 모든 행 해시와 기존 마이그레이션 이력을 대조해 보존했다. 준비알림 예약 작업·트리거는 사용자 지시대로 중지 상태를 유지했다. 실제 경기의 시계·점수·이벤트·명단·기록 대기열을 수정하거나 삭제하지 않았다. linked push/reset/repair는 실행하지 않았다.

증거는 프로젝트 상위 `output/ops/2026-10-03-shootout-registration/{development,production}`의 `before.dump`, `before.json`, `plan.json`, `database-tests.log`, `protected-before.json`, `applied.json`, `verified-after-commit.json`에 보관한다. SQL 복구 시 이미 입력된 승부차기 값을 보존하기 위해 `recover-recording-rpc-only.sql`로 기록 RPC만 이전 정의로 복원한다. `rollback-before-use.sql`의 컬럼 삭제는 격리 검수용이며 실제 결과가 입력된 운영에는 사용하지 않는다.

## 웹 반영

웹 배포·실제 화면 검수 결과는 해당 배포 완료 후 추가한다.
