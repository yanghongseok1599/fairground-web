# FairGround 작업 지침

## 변경 관리

- 기능은 역할별 폴더와 모듈로 나눠 이후 수정 범위를 좁게 유지한다.
- 작업 전후에 `git status --short`를 확인한다.
- 기존 수정·삭제·미추적 파일은 사용자 작업으로 취급한다. 요청 범위 밖의 파일을 되돌리거나 함께 커밋하지 않는다.
- 같은 파일에 기존 변경이 있으면 필요한 부분만 수정하고, 커밋할 때 이번 작업의 hunk만 분리해 스테이징한다.

## Supabase 환경

- Supabase 관련 작업을 시작하기 전에 `docs/supabase-safety.md`를 읽고 `npm run supabase:safety`로 대상 환경을 확인한다.
- 개발과 운영은 영구적으로 분리한다. 로컬 및 Vercel Preview는 개발 Supabase, Vercel Production은 운영 Supabase를 사용한다.
- `.env.development.local`에는 개발 프로젝트만 설정한다. service-role key와 DB 비밀번호는 Git 또는 `NEXT_PUBLIC_` 변수에 넣지 않는다.
- 실제 운영 회원 데이터를 개발 환경에 복사하지 않는다. 개발 데이터는 익명화된 `supabase/seed.sql`로 관리한다.
- DB 스키마 변경은 SQL 마이그레이션으로만 남기고, 개발 환경 검증과 운영 백업을 거친 뒤 운영에 적용한다.

## 대상 프로젝트 고정 (타 서비스와의 분리)

Supabase MCP 커넥터는 **계정 단위**라 이 리포 전용이 아니다. 같은 조직의 다른
서비스가 같은 커넥터를 공유하며, 커넥터 하나로 아래 프로젝트에 전부 접근된다.

| ref | 이름 | 이 리포에서 |
|---|---|---|
| `ovtnmslyjzvghirdvife` | **Fairground** | 유일한 허용 대상 |
| `yhlyrchmnchcvqzrfcsp` | autoceo-brand-radar | 금지 |
| `sftsvmiceuxybukjbywu` | gym-dashboard | 금지 |
| `cpxalgolpsebmctzeabo` | trainermilestone-blogbooster, saju | 금지 |
| `ykyrdwllilffczgryvfv` | trainermilestone-blogbenchmarker | 금지 |
| `ycouvwyejugzjudaqcty` | trainer-milestone | 금지 |

규칙:

- 이 리포에서 실행하는 모든 Supabase 호출의 `project_id` 는 `ovtnmslyjzvghirdvife`
  여야 한다. 다른 ref가 나오면 즉시 중단하고 사용자에게 알린다.
- 진단 쿼리를 보내기 **전에** 대상 ref를 확인한다. 커넥터가 둘 이상 붙어 있으면
  기본 커넥터가 다른 프로젝트를 가리키고 있을 수 있다 — 실제로 그런 사고가 날 뻔했다.
- `supabase/.temp/project-ref` 가 `ovtnmslyjzvghirdvife` 인지 확인한다.
  `./scripts/check-migration-drift.sh` 는 이 검증을 내장하고 있어, 다른 프로젝트에
  link 되어 있으면 아무 조회도 하지 않고 중단한다.
- 반대 방향도 성립한다: 다른 서비스의 리포에서 Fairground 를 건드리지 않는다.
  해당 리포의 지침에도 같은 취지의 금지 조항을 둔다.

## 현재 마이그레이션 보호 상태

- 로컬과 원격 마이그레이션 이력이 불일치하고 로컬 이력만으로 빈 DB를 재구성할 수 없다.
- 기준선 복구가 문서상 완료되기 전까지 운영 프로젝트에 `supabase db push`, `supabase db reset --linked`, `supabase migration repair`를 실행하지 않는다.
- Supabase CLI가 운영 프로젝트에 연결되어 있으면 읽기 전용 상태 확인 외의 명령을 실행하지 않는다.
- 운영 DB 또는 원격 마이그레이션 기록을 변경하기 전에는 유효한 스키마 백업, 실제 스키마 diff, 개발 DB 재현 테스트가 모두 필요하다.
- 2026-09-15 초상권 동의 마이그레이션 `20260915010000` 한 건은 운영 스키마 백업·격리 DB 복원·정의/권한 대조·회귀 테스트 후 동일 SQL로 적용했다. 기존 이력 63건은 보존했고 새 버전만 추가했다. [운영 반영 기록](docs/releases/2026-09-15-portrait-consent-production.md)을 참고한다. 전체 이력 불일치는 남아 있으므로 위 CLI 금지 조건은 유지한다.
- 이 상태가 해결되면 같은 커밋에서 `docs/supabase-safety.md`와 이 절을 함께 갱신해 오래된 경고가 남지 않게 한다.

## 검증과 기록

- Supabase 안전장치를 변경하면 `npm run test:supabase-safety`를 실행한다.
- 의존성 또는 보안 설정을 변경하면 `npm run security:audit`와 `npm run test:security`를 실행한다.
- 보안 기준선이 달라지면 `docs/security-baseline.md`도 함께 갱신한다.
- 애플리케이션 변경은 최소한 `npm run lint`, `npx tsc --noEmit`, 관련 테스트, `npm run build`로 검증한다.
- 운영 환경을 실제로 변경하지 않았다면 완료 보고에 이를 명확히 적는다. 백업이나 diff가 실패했다면 성공으로 기록하지 않는다.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 2026-09-28 운영 컬럼 조회 금지 규칙

- **운영 DB에 없는 컬럼을 조회하는 코드는 배포하지 않는다.** 마이그레이션 파일·수동 타입 정의를 운영 적용의 증거로 삼지 않는다.
- 실제 배포 소스의 컬럼·RPC 반환 컬럼을 운영 카탈로그와 읽기 전용 대조한 뒤 빌드한다.
- `FAIRGROUND_SKIP_DB_PARITY` 우회와 직접 `next build` 배포를 금지한다. 연결 불가/미검증 시 빌드를 차단하고, 긴급 복구는 검증된 이전 배포로 롤백한다.
- 14차 공동 기록·0/00 구분 기능의 SQL은 아직 미적용이므로 런타임에서 제외했다. SQL/개발 이력은 보존하고 검증된 별도 릴리스에서만 활성화한다.
- 테스트 시뮬레이션 폐기는 전용 브라우저 저장 키와 메뉴만 대상으로 한다. 정규 리그·실제 팀 경기·회원·사진·실제 기록 대기열은 삭제하지 않는다.

- 2026-09-28 18:03 KST: 화면 확인용 진행 경기임을 사용자에게 확인하고, 최신 스키마 백업·정의/권한/이력 대조·격리 검수 후 `20260928010000_match_finalization_regression_fix.sql` 한 건을 운영에 적용했다. 선수·팀·경기·이벤트·대회 전체 기존 행 해시와 기존 이력 66건을 보존했으며 해당 버전 1건만 추가했다. `20260928020000`, `20260928030000`은 **미적용**이다. [복구 기록](docs/releases/2026-09-28-player-recovery.md)을 확인한다. 기존 linked push/reset/repair 금지는 유지한다.

- 2026-09-28 20:56 KST: 사용자가 두 실제 대회에 입력한 연습 기록도 초기화하되 대회·대진은 유지하도록 명시했다. 이벤트 37건·진행/종료 상태·연습 집계를 정리했고 대회 2개, 대진 24개, 선수 120명의 신원/사진과 참가비를 보존했다. [초기화 기록](docs/releases/2026-09-28-practice-record-reset.md). 이는 당시 확인된 범위의 일회성 처리이며 향후 실제 기록을 일괄 초기화할 권한으로 해석하지 않는다.

- 2026-09-28 22:08 KST: 사용자가 “예정 경기도 다지워라”라고 범위를 변경하여 남은 예정 대진 24개를 백업·격리 검수 후 삭제했다. 경기 외 29개 보호 테이블, 선수 120명·팀 8개·대회 2개·사진·참가비 및 스키마/이력은 동일했다. [대진 삭제 기록](docs/releases/2026-09-28-scheduled-fixtures-delete.md). 이후 생성되는 경기에는 이번 삭제 권한을 적용하지 않는다.


## 2026-09-29 등번호 0·00 활성화

운영 스키마 백업·격리 복원·실제 권한 검수·변경 전후 행 해시 대조 후 `20260928030000` 한 건을 운영에 적용했다. 기존 선수 121명의 신원/사진 및 31개 보호 테이블의 기존 데이터와 이력 68건을 보존했다. 실제 운영 컬럼·RPC 대조 빌드가 통과한 웹에서 0·00 등록/표기를 활성화했다. 앞선 2026-09-28의 해당 SQL 미적용 표기는 당시 상태다. 공동 기록 `20260928020000`은 미적용이며, hosted 개발 DB에도 이번 SQL은 미반영이다. 전체 이력 복구와 linked push/reset/repair 금지 상태는 변함없다. [반영 기록](docs/releases/2026-09-29-zero-jersey.md).
