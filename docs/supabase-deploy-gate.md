# 코드와 운영 DB의 배포 전 검증

2026-09-28 `get_admin_profiles().select(number_label)`가 운영에 없는 컬럼을 요구하여 선수 목록 조회가 실패했다. 원본 선수 데이터는 남아 있었다. 함수 이름만 검사하던 기존 게이트와 검사 우회 플래그로는 이 장애를 막지 못했다.

## 강제 규칙

운영 DB에 존재하는지 확인하지 않은 컬럼을 조회하는 코드를 배포하지 않는다. 새 SQL 파일이나 TypeScript 타입을 작성한 것만으로 운영에 반영됐다고 판단하지 않는다.

`npm run build`의 prebuild와 모든 브랜치의 `db-parity` CI가 다음을 검사한다.

- 소스에서 호출하는 함수·테이블·뷰·스토리지 버킷의 존재.
- `Database.public.Tables/Views.Row`의 모든 컬럼. `select('*')`도 타입 계약과 대조한다.
- 상수·import·배열 join으로 작성된 select와 RPC 반환 행의 실제 컬럼. 관계 선택은 FK와 대조한다.
- 정적으로 확인할 수 없는 조회나 이름, ignore 항목은 차단한다.

DB 조회는 읽기 전용 트랜잭션의 시스템 카탈로그 SELECT로만 수행한다. 존재하지 않는 컬럼을 실제 회원 조회로 시험하지 않는다.

연결이 없거나 실패해도 빌드는 실패한다. `FAIRGROUND_SKIP_DB_PARITY=1`은 폐지했으며 설정되어 있으면 실패한다. 로컬·Preview·Production 모두 같다. 긴급 상황은 이미 검증된 이전 배포로 롤백한다.

## 연결과 배포

`SUPABASE_DB_URL`을 비공개 환경변수로 제공한다. Preview는 개발 DB, Production은 운영 DB여야 한다. CLI가 발급한 일회성 PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE도 읽기 전용 검사에 사용할 수 있다. 비밀번호는 Git, 로그, 클라이언트 변수에 넣지 않는다.

1. `docs/supabase-safety.md`의 보호 조건을 충족한 DB 변경만 먼저 적용한다. 승인되지 않은 변경은 해당 런타임 기능을 배포에서 제외한다.
2. 실제 배포할 소스 디렉터리에서 대상 DB로 `npm run supabase:parity`를 통과시킨다.
3. 같은 소스를 동일 대상 DB로 검증하며 `npm run build` 또는 `vercel build --prod`로 빌드한다.
4. 검증된 산출물을 배포하고 실제 권한으로 주요 화면을 확인한다. 직접 `next build`로 prebuild를 건너뛰는 배포는 금지한다.

원격 빌드에 DB 연결이 준비되지 않았다면 배포를 차단한다. 일회성 자격증명으로 로컬에서 검증·빌드한 경우 `vercel deploy --prebuilt --prod`로 그 산출물만 배포한다.

## 검증 범위의 한계

컬럼/객체가 있다는 사실은 RLS 권한, 함수의 인자·본문, enum 값, 제약조건, PostgREST 캐시가 올바르다는 보장은 아니다. 별도 회귀 테스트와 로그인된 화면의 읽기 검수가 필요하다. 실제 경기 데이터를 테스트 입력으로 수정하지 않는다.
