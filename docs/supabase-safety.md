# Supabase 안전 운영 가이드

## 구조

FairGround는 중복 설치가 아니라 역할이 나뉜 하나의 서비스입니다.

- 로컬 저장소와 GitHub: 프런트엔드 코드 및 SQL 마이그레이션 이력
- Vercel: 운영 프런트엔드
- Supabase `Fairground`: 인증, 데이터베이스, 스토리지

로컬의 `supabase/migrations`는 서버 복사본이 아니라 DB 변경을 재현하기 위한 코드 이력입니다.

## 현재 상태 (2026-08-29)

- `.env.local`과 `.env.production`이 동일한 운영 Supabase 프로젝트를 가리킵니다.
- 로컬 Supabase CLI도 운영 프로젝트에 연결되어 있습니다.
- 로컬과 원격의 마이그레이션 이력이 크게 다릅니다.
- 원격에는 로컬에 없는 초기 스키마·대시보드 변경 이력이 있고, 로컬에는 원격 이력에 기록되지 않은 SQL 파일이 있습니다.
- 로컬 마이그레이션의 첫 파일은 기존 테이블을 전제로 하므로 현재 이력만으로 빈 DB를 재구성할 수 없습니다.
- Docker Desktop이 없어 원격 스키마 덤프와 shadow DB 비교를 완료하지 못했습니다.

따라서 현재 상태에서 아래 명령을 운영 프로젝트에 실행하면 안 됩니다.

```text
supabase db push
supabase db reset --linked
supabase migration repair
```

이 가이드 정리 과정에서는 운영 DB와 원격 마이그레이션 기록을 변경하지 않았습니다.

## 로컬 개발 안전장치

`npm run dev` 전에 `scripts/supabase/check-safety.mjs`가 자동 실행됩니다. 개발 URL이 운영 URL과 같거나 비교 가능한 설정이 없으면 서버 실행을 중단합니다. URL과 키 전체는 출력하지 않습니다.

현재 연결 상태만 확인하려면 다음 명령을 사용합니다.

```bash
npm run supabase:safety
npm run supabase:migrations
```

운영 DB를 꼭 읽어 확인해야 하는 긴급 상황에서는 한 번의 명령에만 명시적으로 우회할 수 있습니다. 쓰기 동작은 하지 마세요.

```bash
FAIRGROUND_ALLOW_PRODUCTION_SUPABASE_DEV=1 npm run dev
```

## 권장 개발 환경 분리

1. Supabase에서 FairGround 전용 개발 프로젝트를 새로 만듭니다.
2. `.env.development.example`을 `.env.development.local`로 복사합니다.
3. 개발 프로젝트의 URL과 publishable key를 입력합니다.
4. `npm run supabase:safety`가 통과하는지 확인합니다.
5. 마이그레이션 기준선이 복구되기 전까지 기존 SQL 전체를 개발 프로젝트에 일괄 적용하지 않습니다.

`.env.development.local`은 Git에 올라가지 않습니다. publishable key는 클라이언트 공개용이지만, service-role key와 DB 비밀번호는 어떤 `NEXT_PUBLIC_` 변수나 Git 파일에도 넣지 않습니다.

## 마이그레이션 이력 복구 순서

운영 이력의 강제 수정이 아니라 실제 스키마를 기준으로 복구해야 합니다.

1. Docker Desktop 또는 호환되는 PostgreSQL 도구를 준비합니다.
2. 운영 스키마를 유효한 SQL 덤프로 백업하고 파일 크기와 복원 가능성을 검증합니다.
3. 별도 shadow DB에서 운영 스키마와 로컬 SQL의 차이를 확인합니다.
4. 빈 개발 DB를 재구성할 수 있는 기준선 마이그레이션을 만듭니다.
5. 기존 로컬 SQL과 기준선의 중복·순서를 검토합니다.
6. 개발 프로젝트에서 전체 재현과 애플리케이션 테스트를 통과시킵니다.
7. 운영 백업을 다시 만든 뒤 검토된 변경만 운영에 적용합니다.

`migration repair`는 실제 스키마가 동일하다는 증거가 확보된 뒤 이력 표시만 바로잡을 때 사용합니다. 현재는 그 조건을 충족하지 않습니다.
