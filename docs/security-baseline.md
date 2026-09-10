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
