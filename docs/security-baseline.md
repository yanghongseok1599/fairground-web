# FairGround 보안 기준선

마지막 확인: 2026-08-29

## 적용된 보호

- Next.js와 관련 런타임 의존성을 보안 패치가 포함된 버전으로 고정했다.
- PostCSS, nanoid, protobufjs와 개발 도구의 취약한 전이 의존성을 안전 버전으로 갱신했다.
- 모든 경로에 HSTS, MIME sniffing 차단, iframe 제한, 권한 정책과 제한적 CSP를 적용한다.
- CSP는 `base-uri`, `object-src`, `frame-ancestors`, `form-action`부터 제한해 Kakao OAuth와 Supabase 연결을 깨뜨리지 않으면서 기본 공격면을 줄인다.
- 하드코딩된 데모 관리자 비밀번호를 제거했다. 로컬·비운영·Supabase 미설정 상태에서 `NEXT_PUBLIC_DEMO_ADMIN_PASSWORD`를 명시한 경우에만 데모 관리자 로그인이 가능하다.
- Dependabot이 npm 의존성을 매주 확인한다.

## 검증 명령

```bash
npm run security:audit
npm run test:security
npm run lint
npx tsc --noEmit
npm run build
```

2026-08-29 기준 전체 `npm audit`과 운영 의존성 전용 감사 모두 취약점 0건이다. 로컬 프로덕션 서버의 실제 HTTP 응답에서도 설정한 보안 헤더를 확인했다.

## 비밀 정보 점검

- Git이 추적하는 파일과 Git 이력에서 service-role key, 비밀 Supabase key, 결제 비밀 키, 개인키 표식의 파일명 기반 점검 결과는 0건이다.
- 추적되는 `.env.production`에는 브라우저 공개용 Supabase URL·publishable key만 둔다.
- 패턴 점검은 전문 비밀 탐지기를 완전히 대체하지 않는다. Codex Security가 활성화되면 저장소 전체와 Git 이력을 다시 검사한다.

## 아직 운영에 적용하지 않은 항목

- 이번 작업은 운영 Supabase 스키마, RLS, Auth 설정과 원격 마이그레이션 기록을 변경하지 않았다.
- 로컬·원격 마이그레이션 이력 불일치가 해소되기 전에는 보안 SQL도 운영에 직접 push하지 않는다.
- OAuth는 현재 브라우저 implicit 흐름이다. 별도 개발 환경과 서버 쿠키 전략이 준비되면 PKCE/SSR 전환을 독립 작업으로 검토한다.
- Codex Security 플러그인 설치는 승인됐지만 현재 작업에서는 도구 활성화가 완료되지 않았다. 활성화 후 전문 스캔 결과를 이 문서에 추가한다.


## 2026-09-08 등록 무결성 점검 시 재확인

- 전체 `npm run security:audit`: 개발 의존성 4건으로 실패(높음 1·보통 2·낮음 1). `@humanfs/node`, `browserslist`, `postcss-selector-parser`, `qs`가 대상이다.
- 변경 전 HEAD의 package.json/package-lock.json을 별도 디렉터리에서 검사해도 같은 목록과 건수를 재현했다. 새로 추가한 로컬 DB 시험용 `pg` 의존성이 원인은 아니다.
- `npm run security:audit -- --omit=dev`: 취약점 0건. `npm run test:security`: 7개 통과.
- 등록 오류 수정 범위에서는 관련 없는 개발 도구 일괄 업데이트를 수행하지 않았다. 위 4건의 전이 의존성 갱신과 재검증은 남아 있다. 2026-08-29의 0건 기록을 현재 전체 감사 결과로 해석하지 않는다.

## 2026-09-10 선수카드 얼굴 합성 수정 시 재확인

- 얼굴 좌표 감지를 위해 전이 의존성 없는 `@mediapipe/tasks-vision@0.10.32`를 고정 추가했다. 모델과 WASM은 같은 사이트에서 제공하며 사진은 브라우저 안에서 처리한다.
- 전체 감사는 기존 4개 패키지에 `baseline-browser-mapping`이 추가된 5건(높음 1·보통 3·낮음 1)을 보고했다. 운영 의존성 감사는 `next`가 참조하는 `baseline-browser-mapping@2.9.19`의 보통 1건을 보고했다. 해당 의존성은 이번 패치 이전 잠금 파일에도 존재한다.
- 얼굴 합성 수정에서 관련 없는 의존성을 일괄 갱신하지 않았다. 보안 회귀 테스트 7개는 통과했다.


## 2026-09-30 선수검인 전담 권한

- 검인 전담 권한은 기존 회원 역할과 분리했다. 권한 테이블은 RLS와 직접 접근 차단을 적용하고, 검인 RPC는 요청마다 서버에서 권한을 확인한다. 일반 관리자 권한 및 회원의 기존 역할을 넓히지 않는다.
- 운영·개발 각각 복원한 로컬 DB에서 검인 완료/취소, 일반 관리자 RPC 차단, 자가 승격/권한 변경 차단, 권한 회수 후 즉시 거부 테스트를 통과했다. [상세 기록](releases/2026-09-30-inspection-operators.md).
- 의존성 변경 없이 실행한 전체 감사는 9건(높음 4·보통 4·낮음 1)을 보고했다. 보안 회귀 테스트 7개는 통과했다. 이전의 0건 또는 5건 기록을 현재 감사 상태로 해석하지 않는다.

## 2026-10-01 Codex Security 지적 사항 수정

- 로그인·OAuth 시작·콜백·초상권 복귀 주소는 공통 내부 경로 검사로 정규화한다. 역슬래시·제어 문자·외부 origin과 정규화 후 `//` 경로는 거부한다. 기존 `/my`, `/onboarding` 기본 경로와 초상권 화면 반복 방지는 유지한다.
- 큐시트·챌린지 CSV는 공통 셀 인코더로 수식 접두사와 앞쪽 공백/제어 문자를 중립화하면서 따옴표·쉼표·개행을 이스케이프한다.
- 스키마 빌드 게이트는 연결 문자열 파싱 후 TLS·인증서·호스트명 검증 여부를 검사한다. 공식 Supabase CA는 Supabase 호스트에만 추가하며 검증 해제나 호스트명 검사 우회를 허용하지 않는다.
- 새 `20261001010000_security_findings_remediation.sql`은 팀 권한의 NULL 조건을 거부하고, 참가 자격 변경에서 프로필 없는 사용자를 거부하며, 내부 자격 helper의 PUBLIC/anon/authenticated 실행 권한을 회수한다. 기존 마이그레이션은 수정하지 않았다.
- 실제 로컬 PostgreSQL의 합성 fixture와 기존 보호 트리거에서 거부/정상 권한, 내부 helper 호출, 재적용을 검증했다. 이는 운영 스키마 전체 복원 검증이 아니다.
- **운영·개발 DB에는 아직 이 SQL을 적용하지 않았다. 웹도 배포하지 않았다.** 운영 이력 불일치와 백업·실제 정의 diff·격리 복원 요구는 유지한다.
- 전체 npm 감사는 기존 의존성 16건(높음 11·보통 4·낮음 1)을 보고했다. 이번 6건 수정에서 의존성 잠금 파일은 변경하지 않았다.

## 2026-10-01 의존성 취약점 16건 후속 수정

- `minimatch@3.1.5`의 `brace-expansion` 고정을 `1.1.18`에서 보안 버전 `1.1.21`로 변경했다. 다른 의존 경로의 `brace-expansion`은 기존 호환 범위 안에서 `2.1.7`, `5.0.12`로 갱신했다.
- `npm audit fix --ignore-scripts`로 humanfs, baseline-browser-mapping, browserslist, fast-uri, ip-address, postcss-selector-parser, qs와 관련 잠금 파일 항목을 갱신했다. 강제 업데이트나 프레임워크 다운그레이드는 하지 않았다. Next.js·eslint-config-next `16.3.3`, React `19.2.3`은 유지한다.
- 전체 `npm run security:audit` 및 운영 의존성 `npm audit --omit=dev`: 취약점 **0건**. 격리된 소스에서 새 잠금 파일로 `npm ci`와 postinstall을 수행해도 0건이다. 감사 결과는 해당 실행 시점의 npm advisory 기준이다.
- 보안 테스트 7개 및 수정·동의·스키마·안전장치 테스트 40개 통과. TypeScript 통과. 전체 lint 오류 0, 기존 경고 16개.
- HEAD와 새 package/잠금 파일만 포함한 격리 소스를 `npm ci`로 설치한 뒤, 개발 DB 카탈로그 검사를 유지한 `npm run build`가 통과했다(54페이지·sitemap 생성). 관련 없는 미추적 퀴즈·제안서 코드는 검증 소스에 넣지 않았다.
- 운영 DB·웹 배포는 변경하지 않았다. 앞 절의 16건 기록은 수정 전 결과다.

## 2026-10-01 운영 배포 직전 재검사

- npm advisory 재조회에서 Next.js ImageResponse의 GHSA-vcvr-r3jv-pc5j가 새로 탐지되어 Next.js와 eslint-config-next를 16.3.8로 올렸다. 공식 안내: https://github.com/advisories/GHSA-vcvr-r3jv-pc5j (수정 버전 16.3.6 이상).
- 격리된 실제 운영 릴리스 소스와 새 잠금 파일로 npm ci 후 전체 감사 0건, 기존 보안 테스트와 수정 회귀 테스트를 통과했다. 앞선 16.3.3 유지/0건 기록은 당시 결과다.
- 운영 스키마 579,105바이트 백업을 격리 PostgreSQL에 복원하여 4,805개 정의 일치와 이번 SQL의 함수 2개 변경·롤백을 검증했다. 기존 운영 이력은 72건이다. 전체 이력 불일치로 이번 SQL은 운영·개발에 미적용이며, 이 검수는 전체 이력 재현 완료를 뜻하지 않는다.

- 운영 웹 배포 dpl_FQnjnWb4oPScojPg2SzNL9QH6hou를 READY 확인 후 공식 도메인에 연결했다. 내부 복귀 주소·CSV 수정 및 Next.js 16.3.8과 의존성 수정이 반영됐다. 운영 DB SQL 미적용 상태는 유지한다. 상세: [배포 기록](releases/2026-10-01-security-deployment.md).

## 2026-10-03 경기 기록 대기열

- 신규 기록 RPC는 승인된 심판/관리자를 매 요청 검증하고, 명령 ID에 사용자·경기·내용을 결합한다. 직접 API 역할에는 영수증 테이블 읽기/쓰기 권한을 주지 않는다. 기존 경기 RPC 검증을 유지한다.
- 로컬 대기열은 계정별로 분리하며 다른 로그인 계정으로 전송하지 않는다. 이미 준비한 경기의 UI 복구는 서버 권한 부여가 아니며, 실제 반영 때 서버가 다시 검사한다.
- 전체 감사에서 개발 도구 shadcn→MCP SDK의 Hono 4.13.5 보통 취약점 1건(GHSA-hxh3-vqpv-xpqv)을 확인했다. 해당 전이 패키지만 호환 범위 내 4.13.12로 갱신해 전체 감사 0건을 확인했다. Next.js/React 및 직접 의존성 버전은 유지했다.


## 2026-10-03 다음 팀 알림 배포 시 의존성 재검사

- 전체 npm 감사는 `braces<=3.0.3`의 스택 고갈 취약점 [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)과 전이 경로를 높음 9건으로 보고했다. 공식 advisory는 2026-10-02 검토·갱신됐으며 수정 버전은 없고 npm 최신 버전도 3.0.3이다. 앞선 0건 기록은 당시 advisory 기준이다.
- 확인된 경로는 eslint-config-next/shadcn/ts-morph 개발 도구와 빌드 후 next-sitemap CLI이다. 앱 소스에는 사용자 입력 glob을 처리하는 해당 모듈 호출이 없고, 실제 릴리스의 Next.js 런타임 `.nft.json` 및 운영 배포 산출물에서 braces/micromatch/fast-glob 파일 포함은 0건이었다. 현재 운영 요청에서의 악용 경로는 확인되지 않았다는 코드·산출물 조사 판단이며, 패키지의 취약점 자체가 해결된 것은 아니다. 강제 다운그레이드나 패치가 없는 버전 override는 하지 않았다.
- 다음 팀 알림의 신규 내부 함수는 API 역할에 실행 권한을 주지 않는다. 기존 호환 RPC는 요청마다 승인된 심판·관리자인지 검사한다. 실제 DB 역할 회귀·보안 테스트7개·안전장치4개·TypeScript·lint 오류0 및 정상 카탈로그 게이트 빌드를 확인했다.

## 2026-10-03 경기 준비 알림 중지

- 사용자 지시에 따라 개발·운영의 `notify_next_match_ready(uuid)`에서 `authenticated` 실행 권한을 철회했다. 익명·서비스 역할과 내부 발송 함수의 기존 실행 차단도 유지하여 구형 화면의 우회 발송을 막는다. 경기 기록 RPC와 회원 역할·RLS·다른 알림 권한은 유지했다.
- 전용 예약 작업 2개와 경기 준비 알림 트리거를 중지했다. 명시적인 재개 지시 전에는 원래 실행 권한과 발송 경로를 복원하지 않는다. [중지 기록](releases/2026-10-03-match-ready-paused.md).
- 개발의 동일 SQL 적용·전체 롤백 검증과 실제 두 환경의 권한/정의 diff·기록 보존 확인을 통과했다. 보안 회귀 7개·안전장치 4개 통과, 전체 의존성 감사는 기존 높음 9건으로 같으며 의존성 변경은 없다.
