# PR #1 검토 후 개발 검증 안전장치 보완

검토 범위는 `61d1920..080147c`의 70개 변경 파일이다. 제품의 권한·개인정보 접근에서 추가 취약점을 확인하지 못했으며, 아래 개발 테스트 도구의 결함 3건을 재현하고 보완했다. 데이터 유출이나 운영 장애가 확인됐다는 의미는 아니다.

## 확인한 문제와 수정

1. **DB 테스트 접속 주소 우회:** URL의 hostname만 확인하면 node-postgres의 `?host=...`가 실제 연결 대상을 덮어쓴다. 공통 `assertLocalDatabaseUrl`이 PostgreSQL·loopback 주소만 허용하고 query·fragment·제어 문자·파서 우회 입력을 거부한다. URL을 받는 DB 테스트 28개와 공통 실행기에 적용했다. 모든 진입점에서 잘못된 주소가 `pg.Client.connect` 전에 거부됨을 검증한다.
2. **팝업 첫 요청 차단 누락:** Playwright의 새 page 이벤트는 초기 요청 뒤 발생할 수 있다. context 생성 직후 요청 소유자 검사를 설치해 p1 이외의 페이지와 소유자를 확인할 수 없는 요청을 차단하고 실행을 실패시킨다. p1의 리다이렉트 단계별 CDP 검사·WebSocket 검사·추가 페이지 감지는 유지한다. context가 닫히기 전에 route를 해제하지 않는다.
3. **수정 취소의 쓰기 감지 누락:** 전체 인증 경로와 `/api/` 밖 Preview POST 요청이 허용됐다. 개발 인증의 정확한 refresh-token POST만 예외로 두고, 계정 수정·로그아웃·다른 인증 요청과 페이지 경로의 Server Action POST도 쓰기로 판정한다. 증거에는 query·본문·인증 값 대신 비민감 refresh 분류 boolean만 남긴다.

## 개발 검증

- 비DB 134파일 **913/913**, 격리 DB 29파일 **194/194**: 총 163파일 **1,107/1,107**, 실패·스킵·취소·TODO 0.
- ESLint 오류·경고 0, 의존성 감사 취약점 0, TypeScript 검사 통과.
- 정상 `npm run build` 통과. 개발 연결 설정을 확인하고 기존 prebuild DB 정합성 검사와 미디어 검사를 그대로 실행했다.
- DB 테스트는 기존 검증된 개발 스키마-only 백업을 새 로컬 PostgreSQL 17에 복원한 뒤 합성 데이터로 실행했다. hosted DB에서 쓰기 테스트를 수행하지 않았다. 스키마·역할·멤버십·권한 및 테스트 후 템플릿 보존을 확인하고 소유 클러스터를 제거했다.
- 실제 Chromium 루프백 경계 검사 **6/6** 통과: 정상 p1, 팝업 GET·POST, 동일 Preview 팝업 리다이렉트, p1의 금지 리다이렉트, about:blank 팝업 fetch. 금지 목적지의 모의 서버 접수는 0건이다. about:blank fetch는 기존 p1 CDP가 먼저 차단함을 확인했다.
- 독립 검토에서 수정 코드의 추가 우회 또는 구체적인 기능 회귀를 확인하지 못했다. 새 Preview 화면 결과는 PR 본문에 기록한다.

## 검증 범위와 운영 경계

Playwright context routing은 HTTP 캐시를 끄고 가로챈 CORS preflight를 합성 처리하므로, 이 브라우저 검사는 UI와 요청 경계 검증이다. CORS·preflight 서버 정책, 서비스 워커·PWA·오프라인 및 모든 worker/OOPIF 종류의 격리를 검증했다고 주장하지 않는다.

운영 DB·사이트·환경변수와 main은 변경하지 않는다. 개발 브랜치만 갱신하며 Draft PR 병합·자동 병합·운영 배포는 수행하지 않는다. 공유 GitHub DB workflow의 대상 제한이 없으므로 `[skip actions]`를 유지하고 GitHub CI 통과로 표시하지 않는다. 마이그레이션 이력 불일치와 linked `db push/reset/repair` 금지도 유지한다.
