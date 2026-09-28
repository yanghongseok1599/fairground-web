# 아이폰 알림 설정과 선수등록 복구

## 확인한 문제와 수정

홈 화면에 설치하지 않은 아이폰은 알림 상태가 `install`로 분류됐지만, 직접 일정 확인 동의는 `unsupported`에만 제공되어 선수등록이 막혔다. 설치 전·미지원·권한 차단·확인 오류 및 실제 설정 실패에는 직접 확인 동의를 제공한다. 동의 없이 통과하지 않으며, 확인 중인 상태나 설정 시도 전 일반 OFF 상태도 자동 통과하지 않는다. 수신 미확인 상태를 ON으로 표시하지 않는다.

아이폰 인앱 브라우저의 외부 열기 버튼은 Chrome 전용 URL 스킴으로 이동한 뒤 500ms 후 복사 성공 여부와 무관하게 성공 안내를 띄웠다. 이를 Safari 앱에서 현재 주소를 직접 여는 안내로 교체했다. 공통 `BrowserLinkHelp`에서 실제 복사 성공 후에만 성공을 표시하고, 실패하면 선택 가능한 주소를 제공한다. 로컬 저장소가 차단된 환경에서도 배너 표시·닫기가 동작한다. Android의 기존 외부 브라우저 이동은 유지한다.

초상권 동의, 선수 정보 저장 검증, 팀 가입·승인, DB·Auth·푸시 구독 저장 정책은 변경하지 않았다. 브라우저 전환 시 임시 선수 정보가 자동 이동한다고 안내하지 않는다.

## 검증

- 알림 정책 및 등록 무결성 테스트 34개 통과. TypeScript 통과. ESLint 오류 0개, 기존 경고 17개.
- 모바일 390px 환경에서 설치 전 직접 확인 동의 전에는 저장 불가, 동의 후에는 가능, 알림 표시는 OFF인 것을 확인했다.
- 클립보드 거부·성공을 각각 재현하여 수동 복사 안내와 실제 성공 안내를 확인했다.
- iPhone·Kakao 사용자 에이전트 및 저장소 차단을 재현해 Safari 안내, 가로 넘침 없음, 배너 닫기를 확인했다.
- 검수는 Chromium에서 모바일 조건과 오류를 재현한 것이다. 실제 iPhone WebKit 및 APNs 알림 수신을 실기기로 검증한 것은 아니다. 브라우저 스크린샷 API는 타임아웃되어 DOM·상태 검사로 확인했다.
- 일반 도메인과 www 주소는 HTTP 200으로 정상 응답했다. 제보자의 Safari 자체 접속 실패 원인은 정확한 접속 주소·오류 문구·iOS 버전 답변을 기다리고 있다.

## 배포

- 기준 운영 배포: `dpl_8w8keuvUPAf7tyDJGc6Rt3As9do6`.
- 기준 소스에서 이번 범위 8개 파일만 반영했다. 기존 다른 작업은 포함하지 않았다.
- 최종 배포: `dpl_5scqtUACyeG8ts3HdyR78eD1duAh`, `https://fairground-okeqyqvpo-milestones-projects-d52c4dda.vercel.app`.
- Next.js 운영 빌드 통과. 소스 954개를 예상 SHA-1 목록과 대조하여 누락·추가·불일치 0건 확인 후 공식 도메인으로 승격했다.
- 스키마 변경 없는 프런트엔드 배포로, 기존 격리 빌드 방식의 일회성 `FAIRGROUND_SKIP_DB_PARITY=1`을 사용했다. 영구 환경변수 변경 및 운영 DB 중단은 없다. DB 전체 스키마 검증을 통과했다는 의미는 아니다.

## 참고

- [Apple WebKit: 홈 화면 웹 앱의 Web Push 조건](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [MDN: Clipboard API 보안과 사용자 동작 조건](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API#security_considerations), Context7 `/mdn/content` 조회.
- [Lazyweb UI 참고](https://www.lazyweb.com/agentic-search/148e113c-946b-4123-9f89-564a6f81d068): NHL 알림 권한 안내와 나중에 계속하기 사례. 실제 웹 푸시 지원 조건은 Apple 공식 문서를 기준으로 했다.
