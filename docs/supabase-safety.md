# Supabase 안전 운영 가이드

## 구조

FairGround는 중복 설치가 아니라 역할이 나뉜 하나의 서비스입니다.

- 로컬 저장소와 GitHub: 프런트엔드 코드 및 SQL 마이그레이션 이력
- Vercel: 운영 프런트엔드
- Supabase `Fairground`: 인증, 데이터베이스, 스토리지

로컬의 `supabase/migrations`는 서버 복사본이 아니라 DB 변경을 재현하기 위한 코드 이력입니다.

## 프로젝트 좌표

| 용도 | 프로젝트 | ref | 조직 | 요금 |
|------|----------|-----|------|------|
| 운영 | `Fairground` | `ovtnmslyjzvghirdvife` | yanghongseok1599's Org (pro) | — |
| 개발 | `fairground-dev` | `fhytkbjadhnmozppolrv` | FairGround Dev (free) | $0/월 |

둘 다 서울 리전(`ap-northeast-2`)입니다. 개발 프로젝트를 별도 Free 조직에 둔 이유는 두 가지입니다. 요금이 발생하지 않고, 조직 이름만으로 대상 프로젝트를 오인할 여지를 줄입니다.

Free 플랜 제약: 요청이 7일간 없으면 프로젝트가 자동으로 일시정지되며 대시보드에서 재개해야 합니다. DB 용량은 500MB입니다. 개발용으로는 충분하지만, 오랜만에 작업을 재개할 때 첫 요청이 실패하면 일시정지를 먼저 확인하세요.

## 현재 상태 (2026-09-03)

개발과 운영이 분리되었습니다.

- `.env.development.local`이 개발 프로젝트를, `.env.production`이 운영 프로젝트를 가리킵니다.
- `npm run supabase:safety`가 통과합니다.
- 개발 DB에는 운영과 동일한 스키마와 익명화된 시드 데이터가 들어 있습니다.

다만 **마이그레이션 이력 불일치는 그대로입니다.**

- 로컬 47개, 원격 62개이며 이름과 타임스탬프가 양쪽 모두 어긋나 있습니다.
- 로컬 마이그레이션의 첫 파일은 기존 테이블을 전제로 하므로 현재 이력만으로 빈 DB를 재구성할 수 없습니다.
- 원인과 상세 대조는 [`migration-drift-audit-2026-09-03.md`](./migration-drift-audit-2026-09-03.md)를 보세요.

따라서 아래 명령을 **운영 프로젝트에** 실행하면 안 됩니다. 리포에만 있는 마이그레이션이 재실행되면서 `CREATE OR REPLACE FUNCTION`이 운영 중인 함수 본문을 옛 정의로 덮어씁니다.

```text
supabase db push
supabase db reset --linked
supabase migration repair
```

현재 상태를 확인하려면 읽기 전용 점검 스크립트를 쓰세요. 이 스크립트는 링크된 프로젝트가 `Fairground`가 아니면 아무 조회도 하지 않고 중단합니다.

```bash
./scripts/check-migration-drift.sh
```

## 도구 요구사항

두 가지가 필요하며 둘 다 sudo 없이 설치됩니다.

**PostgreSQL 17 클라이언트** — 서버가 PG 17이라 psql 15로는 다룰 수 없습니다. keg-only이므로 절대경로로 호출합니다.

```bash
brew install postgresql@17
/opt/homebrew/opt/postgresql@17/bin/psql --version
```

**Docker 런타임** — `supabase db dump`는 내부적으로 컨테이너에서 pg_dump를 실행합니다. Docker Desktop 대신 colima를 쓰면 관리자 권한이 필요 없습니다.

```bash
brew install colima docker
colima start --cpu 2 --memory 4 --disk 20
export DOCKER_HOST="unix://$HOME/.colima/default/docker.sock"
```

작업이 끝나면 `colima stop`으로 VM을 내려도 됩니다.

## 로컬 개발 안전장치

`npm run dev` 전에 `scripts/supabase/check-safety.mjs`가 자동 실행됩니다. 개발 URL이 운영 URL과 같거나 비교 가능한 설정이 없으면 서버 실행을 중단합니다. URL과 키 전체는 출력하지 않습니다.

```bash
npm run supabase:safety      # 현재 연결 대상 확인
npm run supabase:migrations  # 원격 적용 이력 조회
npm run supabase:parity      # 코드가 참조하는 DB 객체 실존 검사
```

`supabase:parity`는 배포 게이트와 같은 스크립트입니다. 자세한 내용은 [`supabase-deploy-gate.md`](./supabase-deploy-gate.md)를 보세요.

운영 DB를 꼭 읽어 확인해야 하는 긴급 상황에서는 한 번의 명령에만 명시적으로 우회할 수 있습니다. 쓰기 동작은 하지 마세요.

```bash
FAIRGROUND_ALLOW_PRODUCTION_SUPABASE_DEV=1 npm run dev
```

## 새 팀원 로컬 세팅

1. `brew install postgresql@17 colima docker`
2. `.env.development.example`을 `.env.development.local`로 복사합니다.
3. 개발 프로젝트(`fhytkbjadhnmozppolrv`)의 URL과 publishable key를 채웁니다. 대시보드 → Project Settings → API.
4. 같은 파일에 `SUPABASE_DB_URL`을 추가합니다. 대시보드 → Project Settings → Database → Connection string → **Session pooler (5432)**.
5. `npm run supabase:safety`가 "개발 환경과 운영 Supabase가 분리되어 있습니다"를 출력하는지 확인합니다.
6. 시드를 적용합니다.
   ```bash
   set -a; . ./.env.development.local; set +a
   /opt/homebrew/opt/postgresql@17/bin/psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/seed.sql
   ```
7. `npm run dev`

`.env.development.local`은 `.gitignore`의 `.env.*.local` 규칙으로 커밋되지 않습니다. publishable key는 클라이언트 공개용이지만, service-role key와 DB 비밀번호는 어떤 `NEXT_PUBLIC_` 변수나 Git 파일에도 넣지 않습니다.

## 시드 데이터

`supabase/seed.sql`은 멱등합니다. 고정 UUID와 `on conflict`를 쓰므로 몇 번을 실행해도 결과가 같습니다. 팀 2개, 시즌 1개, 계정 15개(관리자·심판·감독·주장·선수 11명·승인 대기 1명), 완료 경기 2개와 예정 경기 1개, 경기 이벤트 6건, 공지 2건이 들어 있습니다. 전부 가공 데이터이며 실제 회원 정보는 한 건도 없습니다. 개발 계정과 비밀번호는 파일 상단 주석에 있습니다.

시드는 `postgres` 롤로 직접 쓰기 때문에 `auth.uid()`가 없어 권한 가드(`guard_privileged_profile_cols`, `guard_team_privileged_cols`)를 통과하지 못합니다. 그래서 스크립트가 가드 트리거만 골라 잠시 끄고 끝나면 되돌립니다. DDL도 트랜잭션 안에 있으므로 중간에 실패하면 트리거 상태까지 함께 롤백됩니다. 실행 후 트리거가 모두 활성(`tgenabled = 'O'`) 상태인지 확인하세요.

**운영 회원 데이터를 개발 환경에 복사하지 않습니다.** 개발 데이터는 이 파일로만 관리합니다.

## 개발 스키마를 운영과 다시 맞추기

운영에 스키마 변경이 생긴 뒤 개발을 따라가게 할 때의 절차입니다. `supabase db dump`는 **public 스키마만** 뜨므로 세 갈래를 모두 처리해야 합니다. 이 점을 놓치면 개발에서만 재현되지 않는 버그가 생깁니다.

1. **public 스키마** — colima를 띄운 뒤 운영 스키마를 뜨고 개발에 적용합니다.
   ```bash
   export DOCKER_HOST="unix://$HOME/.colima/default/docker.sock"
   supabase db dump --linked -f /tmp/prod-schema.sql
   set -a; . ./.env.development.local; set +a
   /opt/homebrew/opt/postgresql@17/bin/psql "$SUPABASE_DB_URL" -f /tmp/prod-schema.sql
   ```
2. **auth 트리거** — 덤프에 포함되지 않습니다. `auth.users`의 `on_auth_user_created` 트리거가 개발에도 있는지 확인하고 없으면 만듭니다. 이 트리거가 없으면 회원가입은 되는데 `profiles` 행이 생기지 않습니다.
   ```sql
   create trigger on_auth_user_created after insert on auth.users
     for each row execute function public.handle_new_user();
   ```
3. **스토리지** — 버킷과 `storage.objects` 정책도 덤프에 포함되지 않습니다. 운영의 `storage.buckets` 행과 `pg_policies where schemaname='storage'` 내용을 개발에 그대로 옮깁니다.

마지막으로 양쪽이 같아졌는지 확인합니다. `public` 스키마의 function / relation / column / enum / policy / trigger / index 목록을 각각 이름순으로 이어붙여 md5로 요약한 뒤, 운영과 개발에서 같은 쿼리를 돌려 7개 값이 모두 일치하는지 봅니다. 개수만 비교하면 이름이 다른 객체를 놓칩니다.

## 마이그레이션 이력 복구 순서

운영 이력의 강제 수정이 아니라 실제 스키마를 기준으로 복구해야 합니다. 개발 DB가 생겨 4·6번을 실제로 수행할 수 있게 되었지만, **아직 완료되지 않았습니다.**

1. 운영 스키마를 유효한 SQL 덤프로 백업하고 복원 가능성을 검증합니다.
2. 개발 DB에서 운영 스키마와 로컬 SQL의 차이를 확인합니다.
3. **함수 정의 본문을 대조합니다.** 지금까지 확인된 것은 객체의 *존재*뿐이고 *본문 일치*는 확인되지 않았습니다. `pg_get_functiondef()` 결과와 리포 파일의 정의를 비교해 차이가 나면 어느 쪽이 최신인지 판정합니다. 이 단계를 건너뛰고 `migration repair`를 하면 그 차이가 영구히 "적용됨"으로 봉인됩니다.
4. 빈 DB를 재구성할 수 있는 기준선 마이그레이션을 만듭니다.
5. 기존 로컬 SQL과 기준선의 중복·순서를 검토합니다. 같은 로직이 다른 이름으로 두 번 등록된 트리거(`trg_guard_profile`과 `trg_guard_privileged_profile_cols` 등)도 이때 정리합니다.
6. 개발 프로젝트에서 전체 재현과 애플리케이션 테스트를 통과시킵니다.
7. 운영 백업을 다시 만든 뒤 검토된 변경만 운영에 적용합니다.
8. `./scripts/check-migration-drift.sh`가 0을 반환하는지 확인하고, `AGENTS.md`와 이 문서의 금지 조항을 함께 갱신합니다.

`migration repair`는 실제 스키마가 동일하다는 증거가 확보된 뒤 이력 표시만 바로잡을 때 사용합니다. 현재는 3번이 남아 있어 그 조건을 충족하지 않습니다.

## 운영 DB에 직접 DDL을 적용하지 않기

SQL 에디터나 MCP `apply_migration`으로 운영에 DDL을 적용하면 원격 이력에만 기록이 남고, 그 경로는 적용 시각을 새 버전으로 부여합니다. 지금의 이력 불일치가 그렇게 만들어졌습니다. 리포에 마이그레이션 파일을 먼저 만들고, 개발에서 검증한 뒤, 같은 파일로 운영에 적용하는 경로만 사용하세요.
