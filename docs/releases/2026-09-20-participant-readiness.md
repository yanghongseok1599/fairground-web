# 대회 참가 준비: 초상권 동의·휴대폰 알림

마이페이지 상단과 선수카드 생성·수정 화면에서 초상권 동의와 현재 기기의 대회 알림 상태를 함께 확인한다. 기능은 `src/features/tournament-readiness/`의 정책, 훅, 화면 컴포넌트로 분리했다.

- 기존 초상권 동의 기록과 직접 확인·저장 절차를 사용한다. 동의를 자동 체크하지 않는다.
- 선수카드 생성·수정은 알림 ON을 확인한 후 저장한다. 저장 직전에 다시 확인하며, 차단·OFF·통신 실패 상태에서는 저장하지 않는다.
- ON은 브라우저 권한, 현재 기기 구독, 현재 로그인 계정의 `push_subscriptions` 저장 기록이 모두 있는 경우다. 다른 기기의 구독으로 완료 처리하지 않는다.
- 설정 변경 후 화면으로 돌아오거나 다른 알림 버튼으로 설정을 바꾸면 상태를 갱신한다.
- iPhone/iPad는 홈 화면 앱 설치를 안내한다. 미지원 브라우저만 운영진 안내·일정 직접 확인에 명시적으로 체크하면 카드 저장을 허용한다. 이 경우에도 알림은 OFF로 남는다.
- 기존 배너는 구독 실패 시 사라지지 않고 오류를 안내한다. 마이페이지 계열에서는 상시 설정 영역과 중복되지 않게 숨긴다.

## 검증

- `npm run lint`: 오류 0, 기존 경고 18개. 변경한 알림 모듈의 별도 ESLint 검사 통과.
- `npx tsc --noEmit`: 통과.
- `node --test tests/tournament-readiness.test.mjs tests/portrait-consent.test.mjs tests/player-card-edit-recovery.test.mjs`: 27개 통과. 기존 선수 생성 테스트에서 누락됐던 필수 동의 입력을 보완했다.
- `npm run build`: 통과. 일반 로컬 prebuild는 DB 연결 변수가 없어 원격 스키마 검사를 생략했다.
- 개발 DB 환경변수를 명시한 별도 스키마 검사는 기존 미추적 퀴즈 기능의 RPC 2개(`get_futsal_quiz_leaderboard`, `register_futsal_quiz_result`) 미반영으로 실패했다. 이번 알림 기능은 새 DB 객체를 추가하지 않는다. 다른 작업의 SQL을 대신 적용하지 않았다.
- Ego Browser에서 개발 시드 계정으로 마이페이지 동의 저장 및 선수카드 수정 흐름을 확인했다. 390px 폭 가로 넘침 없음. 알림 상태를 탭 안에서 모의하여 ON이면 저장 가능, OFF·차단·통신 오류면 저장 불가를 확인했다.
- 미지원 확인 전·후 저장 제한과 iOS 홈 화면 설치 안내를 브라우저에서 모의 검증했다. 실제 OS 알림 허용과 실기기 푸시 수신은 검증하지 않았다.
- 브라우저 스크린샷 API가 시간 초과되어 PNG 시각 검수는 수행하지 못했다. DOM 상태·레이아웃 폭·버튼 활성 여부로 검증했다.

## 환경과 배포

Supabase 안전 검사에서 개발·운영 분리를 확인했고 마이그레이션 목록은 읽기 전용으로 조회했다. DB 구조와 운영 데이터·운영 배포는 변경하지 않았다. 개발 시드 계정의 본인 동의 저장만 실제 실행했다.

기존 퀴즈·제안서·Supabase 문서 등 작업 파일은 이 변경에 포함하지 않았다. 작업 폴더 약 2.7GB의 주요 구성은 기존 의존성 751MB, public 853MB, Git 606MB이며 새 기능 소스가 차지하는 용량은 수십 KB다. 이번 검증에서 생성한 Next.js 빌드·개발 캐시는 정리했다. 기존 의존성과 다른 작업의 `.codex-pptx-*` 자료는 보존했다.

참고: [Lazyweb 알림 권한 화면 사례](https://www.lazyweb.com/agentic-search/dcb722b1-86cd-4c96-9d5c-61045f8b8af2), [WebKit 홈 화면 앱의 푸시 권한](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [Safari 26 홈 화면 웹 앱](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/).
