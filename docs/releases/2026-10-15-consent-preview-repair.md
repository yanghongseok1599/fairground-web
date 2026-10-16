# 동의 기록 개발 Preview 복구 — 2026-10-15

## 상태와 범위

개발 DB 반영, 원격 역할 검수, 개발 카탈로그 대조와 정상 빌드를 완료했다. 이 문서는 배포 전 검증 기록이며, 원격 배포의 최종 URL·SHA·상태는 아래 증거 묶음의 `deployment.json`과 `report.md`에 별도로 기록한다. 운영 DB·웹·도메인·환경변수는 변경하지 않았다.

| 항목 | 값 |
|---|---|
| 브랜치 | `feat/site-essentials` |
| 실패 소스 | `61d192001d0ce6290561ce70404fa42ac0bd89a6` |
| 실패 배포 | `3vWzSTyXfaNScJzQuVnAbAiRFFgk` |
| 실패 원인 | 개발 DB의 `my_consent_history`·`record_my_consents` 누락으로 prebuild 정합성 검사 차단 |
| 적용 대상 | `fairground-dev` 개발 DB, 해당 브랜치 Vercel Preview의 DB 연결 대상과 일치 |
| 개발 적용 시각 | 2026-10-15 23:32:06 KST |
| 복구 커밋 | 증거 묶음 `deployment.json`의 SHA |
| 최종 Preview | 증거 묶음 `deployment.json` 및 `report.md` 참조 |

함수 이름 두 개만 추가하면 현재 UI가 보내는 개인정보 문서 버전이 여전히 없으므로 가입 저장이 실패한다. 따라서 기존 동의 마이그레이션과 초상 홍보 동의 선택·철회 의존성을 함께 검수하고, 현재 문서 시드만 별도 마이그레이션으로 분리했다.

## 적용 SQL

| 파일 | SHA-256 |
|---|---|
| `20261015010000_consent_records.sql` | `2a1fa6ed20259ca0027328b10232bce5c766b63cdb5fbff01b70c17ab4a8d89b` |
| `20261015020000_portrait_consent_optional.sql` | `cf5087613482d3f96818457f9821bb15cdcf9f49df5288ea73ddbf010fd34895` |
| `20261015040000_consent_privacy_document.sql` | `643b27467015d4576e9ab8bbe3abf5ba085093126cb9181155a319a1024eb3ac` |

`010000`은 동의 문서·추가 전용 이력·가입 트리거·본인 기록/조회 RPC를 추가한다. `020000`은 기존 `enforce_personal_portrait_consent`와 `preserve_registration_consent` 두 함수 및 동의 동기화 경로를 조정하여 선택 동의 없이 카드 저장이 가능하고, 기록을 통한 초상 동의 철회가 프로필에 반영되게 한다. 기존 회원의 초상 동의 값이나 과거 동의 기록은 백필하지 않는다.

`040000`은 `20261015030000_entry_fee_payment_retention.sql`의 `privacy 2026-10-15.2` 문서 tuple을 바이트 그대로 가져온 것이다. 같은 종류·버전이 이미 있으면 본문과 해시가 모두 같아야 하고, 다르면 `consent_document_conflict`로 트랜잭션을 실패시킨다. 문서를 덮어쓰거나 새로 작성하지 않는다.

**`20261015030000`의 참가비 보관 테이블·함수·삭제 트리거는 적용하지 않았다.** 문서 등록을 참가비 보관 기능의 활성화로 해석하지 않는다. 이 문서는 기존 UI의 초안이며 시행일을 새로 확정하지 않았다.

## 백업·복원·보존

- 변경 전 개발 스키마 백업: 597,017바이트. SHA-256 `c17cab33d92fb937ff1bf6c9947215ca9de77413037a320a0367200844cd6b83`.
- public/auth/storage/마이그레이션 이력을 격리 PostgreSQL 17에 복원하고 정의·소유자·권한·RLS·트리거를 대조했다. 정책 역할 나열 순서와 `profiles_jersey_number_label`의 결합법칙상 동등한 AND 괄호만 정규화했다.
- 정확한 SQL 세 건을 적용하고 트랜잭션 롤백한 뒤 원래 정의로 돌아오는 것을 검증했다. 이후 실제 개발에 같은 해시의 SQL을 적용했고, 결과 정의가 검수한 복원본과 일치했다.
- 기존 37개 보호 테이블의 행과 기존 마이그레이션 29건을 보존했다. 새 버전 3건만 추가하여 이력은 32건이다.
- 문서 5개(기존 버전 포함)를 등록했고, 실제 회원의 동의 이력을 새로 만들어 넣지 않아 신규 `consent_records`는 0행이다.
- 준비 알림 트리거 중지 상태, 비공개 전화번호의 직접 SELECT 제한, snapshot RLS 및 익명 접근 차단을 유지했다.

전체 마이그레이션 이력 불일치는 해결하지 않았다. linked `db push`, `db reset`, `migration repair` 금지를 유지한다. 적용 전 검수에서 확인한 롤백과, 향후 실제 동의 증빙이 쌓인 뒤의 복구는 구분한다. 실제 증빙을 삭제하는 방식으로 되돌리지 않는다.

## 검증 결과

| 검증 | 결과 |
|---|---|
| 문서·UI payload·Supabase 안전장치·스키마 정합성 단위 테스트 | 35/35 통과, 신규 5개 포함 |
| 최소 로컬 DB의 기존 동의 테스트 | 11/11 통과 |
| focused 문서 시드의 실제 DB 테스트 | 6/6 통과: 멱등성, 해시/본문 충돌 거부, 현재 UI 가입·RPC |
| 실제 개발 스키마 복원본의 역할 회귀 | 11/11 통과 |
| lint | 오류 0, 이 브랜치의 기존 경고 16개 |
| 원격 개발 DB의 트랜잭션 역할 검수 | 11/11 통과, 합성 쓰기 롤백 및 기존 행 보존 확인 |
| 정확한 배포 소스와 개발 DB의 카탈로그 대조 | 타입 컬럼 370개·조회 103개, 함수 125개·릴레이션 42개·버킷 1개 확인 및 통과 |
| 타입 검사·정상 빌드 | `npx tsc --noEmit` 및 `npm run build` 통과; Next 컴파일·TypeScript·정적 페이지 62개 생성 성공 |
| Vercel Preview 최종 상태 | 배포 후 증거 묶음 `deployment.json`에서 확인 |

로컬 복원본과 실제 개발 DB의 역할 검수는 같은 계약을 서로 다른 환경에서 확인한 결과다. 빌드는 개발 DB 연결과 `PGOPTIONS=-c default_transaction_read_only=on`으로 실행했으며 parity 게이트를 우회하지 않았다.

복원본과 실제 개발 DB에서는 Auth·프로필·동의 묶음의 동시 생성, 실패 가입의 전체 롤백, 선택 동의 없는 카드 저장, 필수 묶음·문서 버전·source 검증, 본인 이력 조회와 타인 비노출, 초상 동의 `true → false → true` 동기화, 익명·직접 테이블·내부 helper 접근 차단, 기존 방식 가입 호환을 확인했다. 모든 합성 DML은 BEGIN/ROLLBACK 안에서 실행하고 기대 오류마다 savepoint를 사용했다. 종료 후 합성 행 0건 및 Auth·프로필·동의·등록 이력의 변경 전후 해시 일치를 확인했다.

첫 복원본 하네스는 비공개 `portrait_consent_at`을 직접 SELECT/RETURNING하여 기존 컬럼 권한에 차단됐다. 실제 앱과 같이 `get_my_profile()`로 읽도록 하네스만 수정했다. DB의 RLS나 권한은 완화하지 않았다. 실제 기존 개발 회원 행의 보존은 합성 fixture 검수와 별도로 적용 전후 행 대조로 확인했다.

## 증거 묶음

Codex Security 아티팩트의 상대 폴더는 `artifacts/2026-10-15-consent-preview/`이다. 연결 문자열·키·비밀번호를 릴리스 문서나 Git에 기록하지 않는다.

- `preview-target.json`: 해당 브랜치 Preview DB가 개발을 가리키는지 확인.
- `plan.json`: 적용 소스·세 SQL의 해시 및 참가비 보관 마이그레이션 제외.
- `prepared.json`: 유효 백업과 복원 정의 대조.
- `rehearsal.json`: 적용/롤백 검수, 함수 권한과 보호 상태.
- `applied.json`: 개발 적용 시각, 기존 행·이력 보존, 검수 정의 일치.
- `hosted-role-verification.json`: 실제 개발 DB의 역할별 11개 검수와 합성 쓰기 롤백.

빌드 로그와 최종 배포 증거는 같은 묶음에 보관한다. 공개 REST에서도 두 RPC의 익명 실행이 각각 401/42501로 차단됨을 확인했다.

`feat/site-essentials`의 Preview에만 개발 `SUPABASE_DB_URL`을 Sensitive 분기 설정으로 고정했다. 공용 GitHub DB 검사 workflow가 운영 연결 secret을 사용할 수 있어 기존 개발 릴리스 절차대로 `[skip actions]`를 사용하며, 로컬 정상 prebuild 게이트와 Vercel Preview 빌드를 각각 확인한다. 기존 로컬 `feat/site-essentials` 작업 디렉터리의 미푸시 커밋은 포함하지 않는다.
