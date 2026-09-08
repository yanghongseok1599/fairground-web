# 배포 게이트 — 코드/DB 스키마 정합성

## 왜 만들었나 (2026-09-03 장애)

프런트엔드가 마이그레이션 `codex_security_authorization_hardening`이 만드는 RPC와 뷰를 전제로 배포됐는데, 그 마이그레이션은 운영 DB에 적용돼 있지 않았습니다. 선수 등록이 실패하고 선수 목록이 전부 비었습니다. 데이터 유실은 없었습니다. 원인은 특정 커밋의 실수가 아니라 **코드 배포와 DB 마이그레이션 적용 사이에 아무 게이트가 없다는 구조**였습니다. `git push` → Vercel 자동 빌드 → 운영 반영이 DB 상태를 한 번도 확인하지 않고 진행됩니다.

이 문서의 게이트는 그 한 지점만 막습니다. **코드가 부르는 DB 객체가 지금 대상 DB에 실제로 있는가.**

## 게이트가 검사하는 것

`scripts/supabase/check-schema-parity.mjs`

1. `src/` 아래 `.ts`/`.tsx`를 재귀 스캔해 Supabase 객체 참조를 수집합니다.
   - `.rpc("이름")` → `public` 스키마의 함수
   - `.from("이름")` → `public` 스키마의 릴레이션(테이블·뷰·머티리얼라이즈드 뷰·파티션·외부 테이블)
   - `supabase.storage.from("이름")` → 스토리지 버킷
   - 주석 안의 호출은 수집하지 않습니다.
2. `SUPABASE_DB_URL`로 접속해 `pg_proc`, `pg_class`, `storage.buckets`를 **SELECT만** 조회합니다.
3. 코드가 참조하지만 DB에 없는 객체가 하나라도 있으면 참조 위치(`파일:줄`)를 출력하고 **exit 1**로 빌드를 세웁니다.

실행:

```bash
npm run supabase:parity          # 사람이 직접 확인할 때
npm run supabase:parity -- --json
```

`npm run build` 앞에 `prebuild`로 자동 실행되고, GitHub Actions `db-parity` 워크플로에서도 실행됩니다.

## 게이트가 검사하지 못하는 것

이 게이트는 **이름의 존재 여부만** 봅니다. 아래는 전부 범위 밖이며, 통과했다고 해서 안전이 보장되지 않습니다.

- **컬럼**: 테이블은 있는데 `select("new_column")`이 참조하는 컬럼이 없는 경우
- **RLS 정책**: 객체는 있는데 정책이 없거나 권한이 없어 빈 결과가 오는 경우 — 2026-09-03 장애의 "목록이 전부 공백"과 같은 증상을 낼 수 있습니다
- **함수 시그니처**: 인자 이름·개수·타입이 코드와 다른 경우. 이름만 같으면 통과합니다
- **함수 본문**: 오래된 정의로 덮여 있어도 통과합니다
- **enum 값, 인덱스, 트리거, 제약조건**
- **PostgREST 스키마 캐시**: `pg_proc`을 직접 조회하므로 DB에는 함수가 있지만 캐시가 갱신되지 않아 API가 404를 내는 상태는 잡지 못합니다
- **동적 호출**: `.from(tbl)`이나 `` .rpc(`get_${kind}`) ``처럼 이름이 런타임에 정해지는 호출은 "검증 불가"로 경고만 출력합니다 (현재 1건: `src/stores/dataStore.ts:1405`)
- **마이그레이션 이력**: 리포와 원격의 장부 대조는 하지 않습니다 → `./scripts/check-migration-drift.sh`

## `SUPABASE_DB_URL` 설정

Supabase 대시보드 → **Project Settings → Database → Connection string**에서 가져옵니다. **Session pooler (포트 5432)** 문자열을 권장합니다. Transaction pooler(6543)는 세션 상태를 보장하지 않고, 직접 연결은 IPv4 환경에서 실패할 수 있습니다.

```text
postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

이 문자열에는 DB 비밀번호가 들어 있습니다. **어떤 `.env` 파일에도, `NEXT_PUBLIC_` 변수에도, Git에도 넣지 마십시오.** 아래 두 곳에만 저장합니다.

1. **GitHub** — repo → Settings → Secrets and variables → Actions → New repository secret, 이름 `SUPABASE_DB_URL`
2. **Vercel** — 프로젝트 → Settings → Environment Variables → `SUPABASE_DB_URL`, **Production과 Preview 스코프 모두**에 등록. Preview 빌드도 이제 게이트를 거치므로, Preview 스코프에 없으면 Preview 배포가 exit 1로 막힙니다. 빌드 타임에만 쓰이므로 `NEXT_PUBLIC_` 접두사를 붙이지 않습니다

읽기 전용 롤을 따로 만들어 그 자격증명을 쓰는 편이 더 안전합니다. 이 스크립트는 SELECT만 수행합니다.

## 배포 순서 규칙

**반드시 이 순서.** 반대로 하면 2026-09-03 장애가 그대로 재현됩니다.

1. 마이그레이션을 대상 DB에 적용한다 (SQL 에디터 또는 `apply_migration`. 현재 이력 드리프트 때문에 `supabase db push`는 금지 — `docs/migration-drift-audit-2026-09-03.md`)
2. 스키마 캐시 반영을 확인한다. 새 RPC를 실제로 한 번 호출해 404가 아닌지 본다. 필요하면 `notify pgrst, 'reload schema';`
3. `npm run supabase:parity`가 통과하는지 확인한다
4. 그 다음에 코드를 배포한다 (`git push`)

**금지: 코드 먼저 배포하고 마이그레이션은 나중에.** 그 사이 시간 동안 운영이 깨집니다.

## 게이트가 실패했을 때

출력에 없는 객체 이름과 그것을 부르는 `파일:줄`이 나옵니다.

1. **그 객체를 만드는 마이그레이션이 리포에 있는가** — `grep -rn "<객체명>" supabase/migrations/`
   - 있다 → 아직 DB에 적용되지 않았습니다. 위 배포 순서 1번부터 하십시오
   - 없다 → 코드가 존재한 적 없는 객체를 부르고 있습니다. 코드 쪽이 잘못됐습니다
2. **이름 오타인가** — 참조 위치를 열어 확인합니다
3. **의도적으로 아직 없는 객체인가** (기능 플래그 뒤에 있는 미래 코드 등) — `scripts/supabase/parity-ignore.json`에 사유와 함께 등록합니다. 등록된 항목은 매 실행마다 "무시됨(사유)"로 출력되므로 잊히지 않습니다

```json
{
  "relations": [{ "name": "future_view", "reason": "2026-09-10 릴리스 전까지 플래그 뒤" }],
  "functions": [],
  "buckets": []
}
```

## 환경변수가 없을 때의 동작 (fail closed)

**"엄격 환경"** 은 다음 중 하나라도 참일 때입니다.

- `CI`가 비어 있지 않고 `false`/`0`/`off`가 아님 (GitHub Actions의 `CI=true`, Vercel의 `CI=1` 모두 포함)
- `VERCEL_ENV`가 `production` 또는 `preview` (Vercel Production·Preview 빌드)

| 상황 | 동작 |
|---|---|
| 엄격 환경인데 `SUPABASE_DB_URL` 없음 | **exit 1** — 해결법 2가지를 출력 |
| 엄격 환경에서 DB 연결 실패 | **exit 1** |
| 비엄격 환경(로컬 셸, `vercel dev`의 `VERCEL_ENV=development`)에서 `SUPABASE_DB_URL` 없음 | 경고 후 exit 0 |
| `FAIRGROUND_SKIP_DB_PARITY=1` | 경고 후 exit 0 |

검사를 건너뛴 경우는 **모두 이유를 출력합니다.** 조용히 통과하는 경로는 없습니다.

과거의 빈틈과 수정: 이전에는 엄격 판정이 `CI === "true" || VERCEL_ENV === "production"`이었습니다. Vercel이 `CI=1`로 설정하는 탓에 `CI === "true"` 조건에 걸리지 않았고, `VERCEL_ENV=production`이 아닌 Vercel **Preview** 빌드는 `SUPABASE_DB_URL`이 없어도 경고만 내고 통과했습니다. 지금은 위 규칙으로 그 빈틈이 막혔습니다 — `CI` 값이 `1`이든 `true`든 비어 있지 않고 `false`/`0`/`off`가 아니면 엄격으로 판정하고, `VERCEL_ENV=preview`도 엄격에 포함합니다. 따라서 Vercel Preview 빌드도 `SUPABASE_DB_URL`이 없거나 DB 연결이 실패하면 exit 1로 막힙니다. `vercel dev`(`VERCEL_ENV=development`)와 CI가 아닌 로컬 셸은 비엄격이라 로컬 개발을 막지 않습니다.

## 긴급 우회

```bash
FAIRGROUND_SKIP_DB_PARITY=1 npm run build
```

또는 Vercel 환경변수에 `FAIRGROUND_SKIP_DB_PARITY=1`을 임시로 넣습니다.

**대가:** 코드가 참조하는 DB 객체의 실존 여부를 확인하지 않고 배포합니다. 2026-09-03과 같은 장애가 다시 나도 배포 파이프라인은 아무것도 알려주지 않습니다.

**사후 처리 (같은 날 안에):**

1. 배포 직후 운영에서 해당 기능을 직접 눌러 확인
2. `SUPABASE_DB_URL`을 설정한 뒤 `npm run supabase:parity`를 로컬에서 실행해 실제 상태 확인
3. Vercel 환경변수에서 `FAIRGROUND_SKIP_DB_PARITY`를 **제거**. 남아 있으면 게이트는 영구히 꺼진 것과 같습니다

## 관련 문서

- `docs/supabase-safety.md` — 개발/운영 Supabase 분리, `npm run dev` 안전장치
- `docs/migration-drift-audit-2026-09-03.md` — 리포↔원격 마이그레이션 이력 드리프트 감사
- `scripts/check-migration-drift.sh` — 이력 드리프트 재점검 (읽기 전용)
