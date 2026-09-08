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
