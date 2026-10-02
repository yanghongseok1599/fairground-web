# 현장 선수검인

- 관리자: `/admin/inspections`에서 대회·팀·검인 상태로 명단을 확인하고 이름/팀/등번호로 검색한다. 사진과 생년월일을 대조한 뒤 본인·참가 자격 확인 체크를 하고 완료한다. 완료 취소는 확인 창을 거친다.
- 참가자: `/my` 상단에 대회별 `검인완료` / `검인 대기`를 표시한다. 변경 신호를 받으면 다시 조회하고 화면이 보일 때 5초마다 재확인하며, 화면 복귀·네트워크 복구·수동 새로고침에도 다시 조회한다.
- 범위: 대회 조 편성의 `groups[].teamIds`를 기준으로 한다. 아직 어느 조에도 팀을 배정하지 않았다면 승인된 전체 팀을 대상으로 한다. 심판/관리자 계정은 명단에서 제외하고 `player`/`captain`만 포함한다.
- 가입 미승인·선출 선수는 명단에는 표시하되 완료 처리할 수 없다. 대회×선수로 저장하며 현재 소속팀이 검인 당시 팀과 다르거나 참가 자격이 바뀌면 완료로 표시하지 않는다.

## 구성

`api.ts`는 Supabase 조회/저장, `request.ts`는 취소/시간 제한, `policy.ts`는 필터/집계/표시, `use-inspection-query.ts`는 조회 수명 및 갱신을 담당한다. 화면은 `components` 아래 관리자 목록·확인 창·참가자 카드로 분리했다.

DB 변경은 `20260930010000_player_inspections.sql` 한 건이다. `player_inspections` 직접 조회/쓰기 권한은 클라이언트에 없으며, 관리자 RPC와 본인 전용 RPC만 사용한다. 확인 시각과 처리자는 서버에서 기록한다. 최초 저장도 잠그고 `revision`을 대조하므로 오래된 화면에서 다른 관리자의 결과를 덮어쓸 수 없다. 응답이 끊기면 임의로 완료 처리하거나 재전송하지 않고 다시 조회한다.

이 기능은 현장 확인 결과를 기록한다. 기존 가입 승인·출전 명단·경기 기록·참가비를 변경하거나 미검인 선수의 경기 출전을 자동 차단하지 않는다.

## 검증 및 반영

정책/API 테스트: `node --test tests/player-inspection.test.mjs`

DB 권한 테스트: 격리된 로컬 DB에 기존 스키마와 해당 마이그레이션을 적용한 뒤 `FAIRGROUND_TEST_DB_URL`을 지정하고 `node --test tests/player-inspection-database.test.mjs`를 실행한다. 원격 주소는 거부하고 합성 데이터는 롤백한다.

개발·운영 반영 전에는 저장소의 Supabase 안전 절차를 따른다. 미적용 RPC가 있는 상태로 웹을 배포하지 않는다. [이번 검증 기록](../../../docs/releases/2026-09-30-player-inspection.md)을 참고한다.

## 현장 생년월일 입력 및 동기화

- 일반 관리자 계정은 명단의 생년월일 `입력`/`수정`에서 숫자 8자리 또는 `YYYY-MM-DD`를 타이핑하고 저장한다. 윤년·미래 날짜를 검사하고 저장 실패 시 입력을 보존한다. 검인 전담 계정은 기존 조회·검인 권한을 유지하며 생년월일 편집 권한을 추가로 부여하지 않는다.
- 생년월일만 기존 `profiles` RLS로 갱신한다. 저장 직전 명단을 재조회하여 기존 값/소속 변경을 확인하고, 변경 행의 ID를 확인해야 성공으로 처리한다. 이 사전 확인과 UPDATE는 별개 요청이므로 동시 저장의 원자적 비교·교환은 아니다.
- 신규 가입, 선수정보 저장, 팀 가입 승인, 참가 자격/조 편성 변경, 생년월일/검인 저장 후 `inspection-sync.ts`가 개인정보 없는 갱신 신호만 보낸다. 각 화면은 자신의 권한으로 RPC를 다시 읽는다. 신호의 payload를 회원 데이터로 사용하지 않는다.
- Realtime Broadcast 연결이 끊겨도 5초 재조회, 화면 복귀 및 온라인 복구 재조회가 유지된다. 과도한 신호는 묶고 진행 중 요청은 중복 실행하지 않는다. 자동 갱신은 생년월일 입력 초안을 덮어쓰지 않는다.
- 회원가입만 하고 팀 소속을 정하지 않은 사용자는 검인 명단에 포함되지 않는다. 대회 참가팀 소속이 확정되면 나타나며, 팀 가입 신청을 이용한 경우 신청 승인이 필요하다. 선수 가입 미승인 상태는 명단에서 확인할 수 있으나 검인 완료는 여전히 차단한다.
- 테이블 publication, DB 스키마/권한 변경 또는 service-role 키 추가가 필요하지 않다.

관련 테스트: `node --test tests/player-inspection.test.mjs tests/player-inspection-editing.test.mjs tests/registration-integrity.test.mjs`.
격리 복원 DB의 저장 권한·신규 가입 검증: `tests/player-inspection-birth-date-database.test.mjs`.
참고 API: https://supabase.com/docs/guides/realtime/broadcast

## 현장 성별 입력

- 관리자는 이름·팀·생년월일 옆 성별 `입력`/`수정`에서 가입 양식과 같은 남성·여성·기타·응답 안 함을 선택하고 저장한다. 기존 미입력 값은 미등록으로 표시한다. 자동 갱신 중 초안과 오류를 보존한다.
- `gender.ts`, `gender-api.ts`, `components/gender-editor.tsx`로 선택값·조회/저장·화면을 분리했다. 기존 관리자 전용 `get_admin_profiles`에서 명단 ID의 `id,gender`만 100명 단위로 읽는다. 사진이나 다른 신원정보는 추가로 내려받지 않는다. 검인 전담 계정은 기존 화면/권한을 유지한다.
- 성별만 기존 profiles RLS로 저장하며, 소속·기존 성별을 사전 확인하고 변경된 행 ID를 확인한 후 개인정보 없는 동기화 신호를 보낸다. 생년월일과 마찬가지로 사전 조회와 저장은 별개 요청이므로 원자적인 동시 변경 잠금은 아니다. 운영의 성별 직접 SELECT 권한을 확대하지 않는다. DB/권한/환경변수 변경은 없다.
- 검증: `node --test tests/player-inspection-gender.test.mjs`와 격리 복원 DB의 `tests/player-inspection-gender-database.test.mjs`.
