# Supabase 안전 운영 가이드

2026-10-03 03:33 KST 후속 통합 앱 `0a802ca`: 조별·최종 순위별 카드 등급과 검인 성별 변경을 보존하고 최종 등급의 공용 Realtime·5초 보완 조회 및 저장/공유 PNG 갱신을 연결했다. 조회 실패 시 확정 등급을 유지한다. 개발/운영 카탈로그 대조·관련 23개 테스트·카드 내보내기·TypeScript·Lint와 자동 Preview/운영 Ready를 확인했다. DB 추가 변경은 없으며 아래 이력 보호 규칙은 유지한다. [검증 기록](releases/2026-10-03-matchday-readiness.md).

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

## 2026-09-15 초상권 동의 단일 변경 반영

운영의 실제 스키마를 백업하고 격리된 로컬 PostgreSQL에 소유자·권한·RLS·Auth 트리거까지 복원했다. 공개 스키마 정의 4,482개가 일치하는 상태에서 `20260915010000_portrait_consent_enforcement.sql`을 재현하고 실제 권한 회귀 테스트 8개를 통과했다.

동일한 SQL 파일의 해시와 운영 변경 전후 정의를 트랜잭션 안에서 검사한 뒤 함수 2개·트리거 2개만 추가했다. 기존 마이그레이션 기록 63건은 그대로 보존했고 새 버전 1건을 기록하여 현재 원격 이력은 64건이다. 위 2026-09-03의 개수는 당시 감사 결과다.

이 작업은 전체 이력을 정리한 것이 아니다. `db push`, `db reset --linked`, `migration repair`의 운영 실행 금지는 계속 유지한다. SQL 에디터나 CLI push를 사용하지 않았으며, 검증한 리포 SQL 한 건만 적용했다. 다음 변경도 새로운 백업·실제 diff·격리 재현 검증이 필요하다. 상세 증거와 웹 배포 좌표는 [운영 반영 기록](releases/2026-09-15-portrait-consent-production.md)에 있다.

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

## 2026-09-28 선수 조회 장애 복구

웹이 운영 미적용 `number_label` 등을 조회하여 선수 목록이 표시되지 않았다. 운영 회원·사진·경기 데이터는 복원 SQL로 덮어쓰지 않았고, 정상 배포로 웹을 롤백했다. 이후 호환되는 런타임으로 복구하고 컬럼/RPC 반환 컬럼 검증을 배포 게이트에 추가했다. `FAIRGROUND_SKIP_DB_PARITY` 우회는 폐지했다. [배포 게이트](supabase-deploy-gate.md)의 절차를 따른다. 기존 마이그레이션 이력 보호 및 linked push/reset/repair 금지는 유지한다.

18:03 KST 후속 조치: 사용자가 진행 상태의 경기 1건은 실제 경기가 아닌 화면 확인용이라고 확인했다. 새로운 스키마 백업을 격리 DB에 복원하여 해시·권한·이력·종료 회귀 검수 10건을 대조한 뒤 `20260928010000`만 검증된 트랜잭션으로 적용했다. 기존 프로필 120·팀 8·경기 24·이벤트 34·대회 2행 집합의 해시가 유지됐다. 기존 이력 66건에 해당 버전 1건만 추가했다. 공동 기록과 0·00 컬럼 SQL은 여전히 미적용이다. 실제 정규 리그를 종료·초기화·삭제하지 않았다. [복구 기록](releases/2026-09-28-player-recovery.md)에 상세 증거를 남겼다.

## 2026-09-28 연습 기록 초기화

사용자가 사진으로 두 대회에 남은 연습 기록을 지정하고 "대회·대진표 유지, 연습 기록만 초기화"를 선택했다. 신규 스키마 백업 복원·동일 정의 대조·합성 데이터 회귀 검수·변경 전 데이터 백업 후 20:56 KST 단일 트랜잭션으로 이벤트 37건, 경기 상태 5건, 관련 선수/팀 집계와 자동 배지 진행을 정리했다. 대회 2개·대진 24개·선수 신원과 사진 120명·참가비 2건은 보존했다. 운영 DDL과 기존 마이그레이션 이력은 바꾸지 않았다. [초기화 기록](releases/2026-09-28-practice-record-reset.md)을 참고한다.

22:08 KST 후속: 사용자가 “예정 경기도 다지워라”라고 변경하여 남은 예정 경기 24개도 삭제했다. 새 스키마 덤프 복원·정의 일치·합성 검수·정확한 ID/행 재확인·삭제 전 백업을 거쳤다. 경기 외 보호 테이블 29개의 행 수/내용과 스키마·이력이 같음을 트랜잭션 내 검증했다. 대회 자체, 선수·팀·사진·참가비는 유지했다. [대진 삭제 기록](releases/2026-09-28-scheduled-fixtures-delete.md). 이는 확인된 기존 24개에 한정된 일회성 승인이다.


## 2026-09-29 등번호 0·00 활성화

운영 스키마 백업·격리 복원·실제 권한 검수·변경 전후 행 해시 대조 후 `20260928030000` 한 건을 운영에 적용했다. 기존 선수 121명의 신원/사진 및 31개 보호 테이블의 기존 데이터와 이력 68건을 보존했다. 실제 운영 컬럼·RPC 대조 빌드가 통과한 웹에서 0·00 등록/표기를 활성화했다. 앞선 2026-09-28의 해당 SQL 미적용 표기는 당시 상태다. 공동 기록 `20260928020000`은 미적용이며, hosted 개발 DB에도 이번 SQL은 미반영이다. 전체 이력 복구와 linked push/reset/repair 금지 상태는 변함없다. [반영 기록](releases/2026-09-29-zero-jersey.md).


## 2026-09-29 등번호 숫자 1~3자리 확장

`20260929020000`을 최신 운영 백업·격리 복원·실제 권한 검수 후 적용했다. 기존 등번호 컬럼의 제약조건 2개만 확장하여 `01`, `02`, `007` 등 앞자리 0을 포함한 숫자 1~3자리를 허용한다. 선수 121명과 31개 테이블의 기존 행, 기존 이력 69건은 동일했다. 신규 컬럼/함수/뷰/권한 변경은 없다. 전체 이력 복구 및 hosted 개발 반영과는 별개이며 linked push/reset/repair 금지 상태를 유지한다. [반영 기록](releases/2026-09-29-three-digit-jersey.md).


## 2026-09-30 현장 선수검인 개발 시연

최신 개발 스키마 백업·격리 복원·정의/권한 diff·실제 DB 테스트 후 `20260928030000`, `20260929020000`, `20260930010000` 3건을 hosted 개발에만 적용했다. 기존 32개 테이블 행과 이력 4건은 보존했고 새 버전 3건만 추가했다. 개발 카탈로그 게이트를 통과한 소스를 Vercel Preview에 배포하고 가상 대회·기존 합성 계정으로 완료/취소 연동을 확인했다. 앞선 등번호 문서의 개발 미반영 표기는 당시 상태다. 운영 DB·웹은 변경하지 않았으며 전체 이력 복구 및 linked push/reset/repair 금지는 유지한다. [시연 반영 기록](releases/2026-09-30-player-inspection.md).


## 2026-09-30 현장 선수검인 운영 반영

기존 운영 관리자 `ccv5`로 검인을 사용하도록 `20260930010000_player_inspections.sql` 한 건을 최신 운영 백업·격리 복원·정의/권한 diff·실제 DB 역할 검수 후 적용했다. 기존 선수 122명과 31개 보호 테이블의 행 해시, 기존 이력 70건은 동일했고 새 버전 1건만 추가했다. 운영 DB 카탈로그 게이트를 통과한 웹을 배포하여 `/admin/inspections`에서 실제 `ccv5` 세션으로 78명 명단 표시를 확인했다. 앞선 개발 전용 시연 기록은 당시 상태다. 비밀번호·권한·OAuth 설정은 변경하지 않았다. 전체 이력 복구 및 linked push/reset/repair 금지 상태는 유지한다. [운영 반영 기록](releases/2026-09-30-player-inspection-production.md).


## 2026-09-30 선수검인 전담 권한

`20260930020000`을 운영·개발 각각의 최신 스키마 백업·격리 복원·diff·실제 역할 검수 후 적용했다. 기존 2개 검인 RPC의 권한 확인만 확장하고 서버에서만 수정 가능한 검인 전담 권한 테이블을 추가했다. 일반 관리자 역할·RLS·기존 회원 역할은 변경하지 않았으며 운영 32개 보호 테이블(프로필 122명), 개발 33개 보호 테이블(프로필 15명)의 기존 행과 이력을 보존했다. 신규 버전 1건씩만 추가해 이력은 운영 72건·개발 8건이다. 검인 전담 계정 연결은 해당 가입 계정 확인 후 별도 수행한다. 전체 이력 불일치 및 linked push/reset/repair 금지는 유지한다. [반영 기록](releases/2026-09-30-inspection-operators.md).


## 2026-10-03 사진 용량 최적화

기존 사진의 내용 변경과 용량 최적화를 구분한다. `20261003010000_inline_photo_compaction.sql`을 최신 운영 스키마 백업·격리 복원·함수 1개 diff·실제 역할 검수 후 운영에 적용했다. DB 소유자 세션에 한해 기존/압축본 SHA-256 범위와 사진 외 모든 값의 일치를 확인하여 축소만 허용한다. 일반 회원/API/서비스 역할의 동의 요구는 유지하며, 트리거/RLS/권한을 끄지 않는다. 기존 사진 74명(145필드)을 압축해 153.3MB→17.7MB로 줄였고, 동의 기록 없는 14명의 동의 값은 null 그대로다. 기존 이력은 보존하고 이번 버전 1건만 추가했다. hosted 개발 DB에는 미반영이며 전체 이력 불일치 및 linked push/reset/repair 금지는 유지한다. [반영 기록](releases/2026-10-03-photo-reliability.md).


## 2026-10-03 경기 명단 참가 자격

`20261003020000` 한 건을 운영에 적용했다. 최신 스키마 백업·격리 복원·정의/권한 대조·실제 역할 검수 후 기존 공개 컬럼만 반환하는 경기 명단 뷰를 추가했다. 감독·주장 역할은 제외 조건이 아니며 선수 출신만 제외한다. 기존 33개 보호 테이블과 회원 132명, 이력 73건을 보존했다. 이후 사용자 지시에 따라 기존 관리자 UI에서 ROOT FC B팀 김한주 계정의 선수 출신 값 하나만 정정했다. hosted 개발에는 아직 미반영이며 전체 이력 불일치 및 linked push/reset/repair 금지는 유지한다. [반영 기록](releases/2026-10-03-match-player-eligibility.md).

## 2026-10-03 현장 기록 기기 저장

`20261003030000_match_recording_outbox.sql`을 최신 운영 백업·격리 복원·정의/권한 diff·합성 역할 검증 후 운영에 적용했다. 기록 실행과 UUID 영수증은 한 트랜잭션이며 권한은 기존 경기 RPC와 새 진입 RPC 양쪽에서 검증한다. 기존 테이블 행/정의·마이그레이션 74건은 보존하고 새 이력 1건만 추가했다. hosted 개발 미반영, 전체 이력 불일치 및 linked push/reset/repair 금지는 유지. [반영 기록](releases/2026-10-03-match-recording-outbox.md).


## 2026-10-03 Preview 경기 명단 조회 복구

`ef8f7cd` 자동 Preview 빌드는 개발 DB에 `public_match_player_profiles`가 없어 정합성 검사에서 차단됐다. 운영 Supabase 장애가 아니라 개발 반영 누락이었다. 개발의 최신 스키마 530,019바이트를 격리 복원하고 5,469개 정의 일치·추가 뷰 diff·실제 역할 테스트를 확인한 뒤 기존 SQL `20261003020000` 한 건만 개발에 적용했다. 개발 34개 보호 테이블과 합성 회원 15명, 기존 이력 10건은 보존하고 새 이력 1건만 추가했다. 배포 소스의 개발 카탈로그 대조는 타입 컬럼 365개·조회 85개 모두 통과했다. 운영 DB·도메인·환경변수는 변경하지 않았다. 전체 이력 불일치 및 linked push/reset/repair 금지는 유지한다. [반영 기록](releases/2026-10-03-preview-eligibility-repair.md).


## 2026-10-03 Preview 기록 저장 복구와 재발 방지

`cf183eb` 자동 Preview 실패 로그에서 개발 DB의 `get_match_recording_snapshot`·`apply_match_recording_operation` 누락을 확인했다. 개발 스키마 532,279바이트를 격리 복원하고 5,694개 정의를 대조한 뒤, 실제 역할 테스트에서 발견한 기존 경기 종료 함수의 정수 형식 오류까지 검증하여 `20260928010000`, `20261003030000` 두 SQL만 개발에 적용했다. 기존 34개 보호 테이블의 기존 컬럼 값과 합성 회원 15명, 이력 11건을 보존했다. 새 nullable 컬럼은 모두 null이며 새 이력 2건만 추가했다. 운영 DB는 변경하지 않았다. 전체 이력 불일치 및 linked push/reset/repair 금지는 유지한다. [복구 기록](releases/2026-10-03-preview-outbox-repair.md).


## 2026-10-03 실시간 공동 경기 기록

`20261003040000_shared_match_recording.sql`을 개발·운영 각각의 최신 스키마 백업·격리 복원·정의/권한 diff·실제 역할 검수 후 같은 SQL 해시로 적용했다. 서버 버전·시간 관리 기기·기록자 정보를 추가하고 기존 기록 RPC 2개를 확장했다. 운영 31개 보호 테이블(회원 132명·경기 12개)과 기존 이력 75건, 개발 35개 보호 테이블과 기존 이력 13건을 보존했다. 각 환경에 새 버전 1건만 추가했다. 김재민·홍성표는 기존 승인 관리자이며 권한을 바꾸지 않았다. 구형 공동 기록 SQL `20260928020000`은 여전히 미적용이다. 전체 이력 불일치 및 linked push/reset/repair 금지는 유지한다. [반영 기록](releases/2026-10-03-shared-match-recording.md).

## 2026-10-03 경기 당일 제어·종료 확정

심판이 시작·중지·재개·종료를 담당하고 승인 관리자가 보조한다. 경기 중 점수·이벤트·진행 상태를 공유하되, 사용자 선택에 따라 선수카드 통계·경기결과·리그순위는 종료 시 확정한다. 명단 없는 경기의 이벤트 기반 집계를 모든 등록 선수의 출전으로 확대하지 않는다.

`20261003050000_matchday_finalization.sql`을 최신 개발·운영 백업 각각의 격리 복원·정의/권한 diff·적용/롤백·실제 API 역할 검수 후 같은 SQL 해시로 적용했다. 함수 4개를 교체하고 기록 영수증에 `outcome` 컬럼/제약을 추가했다. 관리자 중지·종료 시 마지막 관측 시간을 보존한다. 오래된 중지/재개는 `superseded`로 확인해 후속 득점 기록이 막히지 않게 하며, 충돌한 종료는 확인이 필요하다. 여러 경기의 종료 집계와 순위 변경은 같은 잠금 순서를 사용한다. 기록 조회와 진입 RPC에서 승인 여부를 명시적으로 확인하고 일반 회원 역할·권한 헬퍼는 유지했다.

개발 03:01 KST, 운영 03:02 KST 반영 영수증을 확인했다. 운영 32개 보호 테이블(프로필 132명·경기 12개), 개발 33개 보호 테이블(합성 프로필 15명·경기 3개)의 기존 컬럼 값을 보존하고 이력은 운영 76→77건, 개발 14→15건이다. 두 복원 DB에서 새 테스트 5개와 기존 16개가 각각 모두 통과했다. **DB·웹 반영과 브라우저 검수를 완료했다.** `ae9a531`의 자동 Preview와 운영 배포는 Ready이며 [반영 기록](releases/2026-10-03-matchday-readiness.md)에 증거를 남겼다. 실제 예정 경기의 18명 명단·0:0·이벤트 0·공유 연결을 읽기 전용 확인했다. Supabase가 같은 topic 채널을 재사용하므로 비동기 제거를 기다린 뒤 재연결하며 이 경합 회귀 테스트를 유지한다.

상대 기기의 알려진 미전송 기록은 종료 전에 확인해야 한다. 연결이 끊긴 기기의 알 수 없는 대기열까지 서버가 비어 있다고 보장할 수는 없다. 네트워크 단절 중에는 기기 보관과 복구 후 전송을 검증하며 외부 서비스의 무장애를 약속하지 않는다. 실제 `fairground-match-recording-v1` 대기열을 임의 삭제하지 않는다. 전체 이력 불일치 및 linked push/reset/repair 금지는 유지한다.
