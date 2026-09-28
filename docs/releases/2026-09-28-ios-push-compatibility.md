# 아이폰 Safari·푸시 호환성 후속 수정

## 동작 변경

- 알림 권한·설치·구독 조회 결과가 선수등록 및 카드 수정의 저장을 막지 않도록 분리했다. 초상권 동의와 선수 정보 검증, 저장 확인, 팀 가입 신청은 유지한다. 이전 직접 확인 체크박스를 제거하고 알림은 별도 설정으로 안내한다.
- Safari가 localStorage 접근 자체를 거부하거나 저장 공간이 부족해도 PWA 설치 안내와 마이페이지 카드 선택에서 예외가 전파되지 않는다. 운영 화면 검수에서 추가 발견한 홈 홍보 팝업도 저장소 getter 접근부터 보호하여 열기·닫기가 동작한다.
- 모바일에서 지원하지 않는 `new Notification()` 대신 활성 서비스 워커의 `showNotification()`으로 현재 접속 중 수신한 알림을 표시한다. 실패는 페이지 밖으로 전파하지 않는다. 기존 서버 Web Push 및 백그라운드 서비스 워커 수신 경로는 유지한다.
- 구독 상태 조회는 10초에 종료하여 무기한 로딩을 막는다. 읽기 전용 시간 제한으로, 구독을 삭제하거나 재생성하지 않는다.
- 설치 안내에 홈 화면 아이콘으로 실행한 뒤 마이페이지에서 알림을 켜고 허용하는 단계를 명시했다. 알림 ON은 해당 계정·기기의 서버 구독 저장까지 확인한 상태만 표시한다.

## 검증

- 관련 테스트 57개 통과: 등록 무결성·사진 저장 재시도·알림 구독·모바일 표시 API·Safari 저장소 접근 실패·조회 시간 제한·알림 진입점.
- TypeScript 검사 통과, ESLint 오류 0개 및 기존 경고 17개.
- Chromium 390px에서 iPhone 사용자 에이전트·홈 화면 실행 상태·알림 API·저장소 차단을 재현했다. 실제 컴포넌트와 훅으로 설치 안내, 저장소 차단 상태에서 안내 닫기, 설치 후 ON 버튼, 클릭의 사용자 활성 상태, 가상 구독 1회 저장 후 ON, 가로 넘침 없음을 확인했다.
- 브라우저 검수는 가상 계정·가상 구독이며 운영 DB에 테스트 회원이나 알림을 생성하지 않았다. 실제 iPhone WebKit 및 APNs 잠금화면 수신을 실기기로 검증하지는 못했다.
- 최종 운영 페이지에서 localStorage·sessionStorage getter를 차단하고 iPhone 사용자 에이전트를 적용해 화면 표시와 팝업·설치 안내 닫기를 확인했다. 처리되지 않은 예외 0건, 가로 넘침 없음. 실제 WebKit 검증을 대신하지 않는다.
- 제보한 Safari 접속 실패의 정확한 원인은 확정하지 않았다. 확인된 저장소 예외와 모바일 알림 API 호환성 문제를 수정한 것이다.

## 플랫폼 조건

iOS·iPadOS 16.4 이상에서 홈 화면에 추가한 웹 앱이 Web Push를 받을 수 있다. Safari 일반 탭의 푸시 제한을 우회하거나 알림 허용을 자동으로 승인하는 기능은 아니다.

- [Apple WebKit — iOS 홈 화면 웹 앱의 Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [MDN — 모바일 Notification 생성자 제한](https://developer.mozilla.org/en-US/docs/Web/API/Notification/Notification)
- [MDN — 서비스 워커 알림 표시](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification), Context7 `/mdn/content` 확인.
- [Lazyweb — 알림 설정을 나중에 계속하는 UI 참고](https://www.lazyweb.com/agentic-search/148e113c-946b-4123-9f89-564a6f81d068). 이전 조사 결과를 재사용했다.

## 배포

- 운영 기준 `dpl_5scqtUACyeG8ts3HdyR78eD1duAh`의 파일을 복원한 격리 디렉터리에 이번 변경 17개 파일만 반영했다. 다른 작업의 수정·미추적 파일은 포함하지 않았다.
- Next.js 운영 빌드 통과. 배포 소스 956개의 예상 SHA-1과 실제 업로드를 대조해 누락·추가·불일치 0건을 확인했다.
- `dpl_2ccGH4uMpXLQxX6HjP4AkXRgDGG7` / `https://fairground-q0unbretq-milestones-projects-d52c4dda.vercel.app`를 공식 도메인으로 승격했다. 공식 주소와 www 주소 모두 HTTP 200 및 새 배포 ID를 확인했다.
- 스키마 변경 없는 프런트엔드 배포에 기존 방식의 일회성 `FAIRGROUND_SKIP_DB_PARITY=1`을 사용했다. DB 전체 스키마 검증 성공을 의미하지 않는다. 운영 DB 중단·재시작·스키마 변경·영구 환경변수 변경은 없다.
