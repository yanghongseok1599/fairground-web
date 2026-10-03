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

적용 트랜잭션에서 기존 public 테이블의 신규 컬럼을 제외한 모든 행 해시와 기존 마이그레이션 이력을 대조해 보존했다. 준비알림 예약 작업·트리거는 사용자 지시대로 중지 상태를 유지했다. 스키마 적용 과정에서는 실제 경기의 시계·점수·이벤트·명단·기록 대기열을 수정하거나 삭제하지 않았다. 이후 별도 사용자 지시로 14경기 종료를 처리한 내역은 아래에 구분한다. linked push/reset/repair는 실행하지 않았다.

증거는 프로젝트 상위 `output/ops/2026-10-03-shootout-registration/{development,production}`의 `before.dump`, `before.json`, `plan.json`, `database-tests.log`, `protected-before.json`, `applied.json`, `verified-after-commit.json`에 보관한다. SQL 복구 시 이미 입력된 승부차기 값을 보존하기 위해 `recover-recording-rpc-only.sql`로 기록 RPC만 이전 정의로 복원한다. `rollback-before-use.sql`의 컬럼 삭제는 격리 검수용이며 실제 결과가 입력된 운영에는 사용하지 않는다.

## 사용자 지정 14경기 종료

사용자가 14경기 ROOT FC B팀 0:0 FC흰둥이, 경기 시간 12:00 완료, 승부차기 FC흰둥이 1:0 승리를 확인하고 종료를 요청했다. 최초 MOM으로 제시된 권지혁은 FC LEGACY 소속이라 참가팀 선수 검수에서 일치하지 않았다. 임의로 지정하지 않고 확인을 요청했으며, 사용자가 **MOM 없음**으로 최종 확정한 뒤 처리했다.

2026-10-03 **14:48:44 KST**에 기존 승인 관리자 `ccv5`의 사용자 식별자를 확인하고, `apply_match_recording_operation`의 `pause` → `shootout` → `end` 명령 3개를 단일 트랜잭션으로 실행했다. 공유 종료 잠금 이후 14경기 행을 잠그고 대회·경기 번호·양 팀 ID·정규 0:0·진행 상태·MOM null을 검수했다. 각 명령의 UUID와 원문 payload, 직전 경기·이벤트·명단·기록 상태·영수증·참가팀 선수 통계·팀 통계를 private JSON으로 보관했다.

커밋 후 읽기 전용 재조회에서 다음 결과를 확인했다.

- 경기 ID: `1117d2d0-daba-45ab-a6a4-54f63581761d`.
- 정규 점수 ROOT FC B팀 0:0 FC흰둥이, 승부차기 0:1 **FC흰둥이 승**.
- `status=finished`, `stats_applied=true`, `elapsed_seconds=720`, `is_running=false`, `mom_player_id=null`.
- 앱 명령 영수증 3개. 기존 이벤트 5개와 명단은 보존했다.
- 양 팀의 정규 무승부·승점·경기 수는 각각 1회 증가했고, 정규 득실은 동일했다. 선수 22명의 통계를 기존 유효 이벤트에 따른 정상 종료 집계와 대조했다. 승부차기 골을 선수 득점이나 MOM에 더하지 않았다.

14경기의 명시된 종료 처리 외에 다른 경기의 점수·시계·상태를 변경하는 SQL을 실행하지 않았다. 팀 순위 재계산은 기존 종료 함수의 정상 집계 절차를 사용했다. 실제 기록 대기열·원본 이벤트·회원 소속과 권한·준비알림 중지 상태는 유지했다.

증거는 위 운영 디렉터리의 `match14-authorized/before-pause-result.json`, `pause-result-operation-ids.json`, `pending-pause-result.json`, `committed-pause-result.json`, `verified-final-statistics.json`에 보관한다.

## 웹 반영

- 앱 소스 커밋: `f98d2e81522480c79089c9b614d5b8c624655538` (승부차기 기록 41차).
- 자동 Preview: `dpl_4VDHjQGDdax9AUFNqrmQGYMEPoZV`, `READY`.
- 운영: `dpl_4zRR4N47yadn7iYiiz8cSbV1WbMB`, `READY`, `https://fairground-kor.com` 연결 확인.
- 개발·운영 실제 카탈로그 모두 타입 컬럼 368개·조회 100개 검증 통과. 정상 게이트를 거친 운영 빌드와 TypeScript 통과.
- ESLint 오류 0개·기존 경고 16개. 승부차기 기기 저장/응답 유실/순위/공유/충돌 복구와 기존 기록 회귀 검증 통과.
- 로컬 빌드 산출물 1,211개에서 DB 사용자·비밀번호 바이트가 없음을 확인하고 prebuilt 파일만 전송했다. 임시 빌드·의존성·격리 DB 캐시를 정리했다.

실제 14경기 기록 화면을 추가로 여는 동안 기존 기록 탭의 보호 잠금이 작동했다. 다른 탭을 강제로 닫거나 실제 기록 대기열을 수정하지 않았다. 승부차기 입력·충돌 복구는 집중 단위 테스트와 실제 API 역할 DB 테스트로 검증했다. 공개 경기 상세와 공유 페이지에서 `승부차기 0 : 1 · FC흰둥이 승`, 정규 `0 : 0`, 경기 종료 표시와 공유 이미지 메타데이터를 브라우저로 확인했다.

UI 참고는 [스포츠 경기 기록 화면](https://www.lazyweb.com/agentic-search/f77bb5ac-9315-46bb-800d-c8d422f7eba4)을 사용했다. 정규 점수 아래 승부차기 점수·승자를 별도로 표시했다.
