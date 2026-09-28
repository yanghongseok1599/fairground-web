# Android 상태바 알림 아이콘 — 20차

사용자가 Galaxy에서 알림 수신은 정상이나 상태바에 흰 원만 나타나는 화면을 제공했다. `badge-96.png`가 파란 원형 배경을 포함한 일반 앱 아이콘이었고, `sw.js`, `sw-push.js`, 화면 알림 헬퍼가 이를 작은 알림 아이콘으로 전달하고 있었다. Android는 이 아이콘을 단색 마스크로 표시하므로 배경까지 하나의 원으로 보인다.

## 변경

- 기존 로고 생성기에 `make_notification_badge`와 `save_notification_badges`를 분리했다. 기존 FairGround 워드마크의 F·G 모양을 사용하여 96×96 투명 배경 위에 흰 글자만 배치한다. 일반 앱 아이콘과 알림 본문용 컬러 로고는 유지한다.
- 새 파일 `/icons/notification-badge-96.png?v=1`을 세 알림 경로에서 사용한다. 새 URL로 기존 원형 이미지 캐시와 구분한다. 구형 워커가 요청하는 `badge-96.png`도 같은 투명 자산으로 제공한다.
- 업데이트 시 작성 중인 화면을 보호하는 기존 서비스워커 활성화 규칙은 유지한다. 새 워커를 받으려면 메인 화면을 다시 열어야 할 수 있으며, 이미 표시된 알림의 아이콘은 소급 변경되지 않는다.

## 검증

- 알림·워커 회귀 테스트 12개 통과. PNG 크기·흰색 픽셀·투명 여백·불투명 배경 재발을 검사하고 두 푸시 핸들러와 화면 알림 경로의 실제 옵션을 확인했다.
- 아이콘 시각 확인: FG 글자만 표시되며 배경은 투명하다. 9,216픽셀 중 표시 픽셀은 4,492개이고 모든 표시 픽셀의 RGB가 흰색이다.
- TypeScript 통과, 린트 오류 0개·기존 경고 16개.
- 실제 배포 소스의 운영 DB 함수 36개·관계 27개·버킷 1개와 타입 컬럼 330개·조회 74개를 읽기 전용으로 대조했다. 운영 데이터·스키마·구독은 변경하지 않았다.
- 실제 Galaxy 상태바 확인은 사용자 기기에서 새 알림 수신 후 필요하다. 데스크톱 검사 결과를 실기기 표시 확인으로 간주하지 않는다.

## 배포 기준

현재 Git 기준 `fb452ef`에 이번 아이콘 관련 파일만 적용한 임시 소스로 검증했다. 별도 작업 중인 퀴즈·제안서·타입 변경은 포함하지 않았다. 최초 빌드는 production 설치가 TypeScript 개발 의존성을 제외하여 중단됐고, 빌드 환경에 개발 의존성 포함을 명시하여 다시 실행했다. DB 대조나 prebuild는 우회하지 않았다.

## 운영 반영

- production build 통과 후 검증된 prebuilt 산출물 `dpl_FardfrXoPQPrNNuU1fX4be6Fb94U`를 배포했다. 배포 URL은 `https://fairground-b2wgn5u7j-milestones-projects-d52c4dda.vercel.app`이다.
- 인증된 배포 검사에서 새 PNG·워커·기존 컬러 로고의 SHA-256이 로컬 검증 파일과 일치했다. 두 공식 도메인이 이전 19차 배포를 가리키는지 확인한 후 이번 배포로 연결했다.
- `fairground-kor.com`과 `www.fairground-kor.com`의 새 PNG·호환 PNG·워커·메인 화면 HTTP 200을 확인했다. 실제 운영 PNG와 워커도 검증 파일과 일치하며 `/sw.js`는 `Cache-Control: no-store, max-age=0`을 유지한다.
- 임시 DB 자격증명이 들어갈 수 있는 빌드 캐시를 제거했고 배포 산출물에 해당 비밀번호가 없음을 확인했다. 임시 빌드 소스·의존성은 검수 후 정리했다.

## 참고

- [Google web.dev: Notification badge](https://web.dev/articles/push-notifications-display-a-notification#badge)
- Lazyweb 검색은 앱 아이콘 설정 등 인접 화면만 반환해 이번 상태바 오류의 근거로 사용하지 않았다. 위 공식 플랫폼 규칙과 실제 자산을 기준으로 수정했다.
