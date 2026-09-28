# 아이폰 알림 권한·수신 연결 복구 — 21차

## 확인한 사실과 한계

- 신고된 아이폰은 OS 설정에서 FairGround 알림을 허용했지만, 웹 화면은 권한을 거부된 것으로 읽었다. 화면이 열린 경로는 홈 화면 아이콘이라고 답한 뒤 Safari라고 보충했다. 실제 실행 모드·설치 주소·iOS 버전은 원격으로 확인하지 못했으므로 특정 WebKit 버그나 사용자 설정을 원인으로 단정하지 않는다.
- 운영 계정 조회(2026-09-28 23:28 KST)에서 해당 계정의 `push_subscriptions`는 0건이다. OS의 알림 허용만으로 서버 수신 주소가 만들어지는 것은 아니다. 추가 발송은 하지 않았다.
- 운영 `push_subscriptions` 정책은 본인 SELECT/INSERT/DELETE만 허용하고 UPDATE 정책은 없다. 기존 endpoint 재연결의 merge upsert는 UPDATE를 시도한다. 그 실패 시 브라우저 구독까지 해제하는 경로도 있었다. 이 결함을 확인했지만 이 아이폰에서 실제로 실행됐는지는 로그가 없어 단정할 수 없다.

## 수정

- 구독 저장·확인을 `src/lib/notifications/push-subscription-store.ts`로 분리했다. `ON CONFLICT DO NOTHING` 후 현재 계정·endpoint·암호화 키가 일치하는 행을 읽어 검증한다. 다른 계정의 endpoint를 이전하거나 UPDATE 정책을 넓히지 않는다.
- 저장 실패 시 기기 구독을 보존하여 재시도할 수 있게 했다. 의도적인 알림 끄기에서만 기존 해제 경로를 사용한다.
- 권한, 서비스 워커, 공개 키 조회, 기기 구독, 로그인, 서버 저장 단계를 구분하여 실패 원인과 다음 행동을 안내한다. 구독 토큰·키·원문 서버 오류를 화면에 노출하지 않는다.
- 설치된 iOS 앱에서 사용자가 재연결 버튼을 눌렀을 때 native permission API를 다시 호출한다. 실제 denied 응답은 그대로 존중하며, 자동 재요청이나 가짜 ON 처리는 하지 않는다.
- Safari/Chrome 웹페이지와 홈 화면 웹 앱의 현재 실행 환경을 표시한다. 아이콘이 Safari로 열리면 ‘웹 앱으로 열기’ 옵션으로 추가하는 방법을 안내한다. 기존 앱 삭제는 요구하지 않는다.

## 검증

- 관련 회귀 테스트 37개 통과: 계정별 endpoint/키 검증, INSERT/SELECT 전용 저장 재시도, 구독 보존, iOS 사용자 동작 안에서의 권한 재조회, 실제 거부 유지, Safari/Chrome 탭과 설치 앱 구분, 기존 Android 배지 경로.
- `npm run lint`: 오류 0, 기존 경고 16.
- `npx tsc --noEmit`, `git diff --check`: 통과.
- 배포할 소스만 격리한 임시 빌드에서 운영 카탈로그와 컬럼 330개·조회 74개, 함수 36개·릴레이션 27개·버킷 1개를 읽기 전용 대조했다. prebuild를 생략하지 않고 `vercel build --prod` → `npm run build`가 통과했다.
- 배포 산출물의 임시 DB 비밀번호 포함 여부를 검사해 없음 확인. DB 데이터·스키마·권한은 변경하지 않았다.
- 실제 아이폰의 새 수신 연결 및 알림 표시 여부는 사용자가 홈 화면 웹 앱에서 연결을 완료한 뒤 확인해야 한다. 이번 검증은 실기기 수신 성공을 뜻하지 않는다.

## 배포

- Deployment: `dpl_AXFT1deeqD2bomCycU38c1z4jx1e`
- URL: https://fairground-7bwuema6l-milestones-projects-d52c4dda.vercel.app
- 이전 배포: `dpl_FardfrXoPQPrNNuU1fX4be6Fb94U`
- 운영 반영 완료(두 도메인 READY 확인): `fairground-kor.com`, `www.fairground-kor.com`
- 변경된 JavaScript 4개를 배포 URL 및 운영 도메인에서 로컬 산출물 SHA-256과 비교해 모두 일치했다. `/my`, `/manifest.webmanifest`, `/sw.js` HTTP 200도 확인했다.
- 작업 중인 퀴즈·제안서와 환경/문서 변경은 배포·커밋 범위에서 제외했다.

## 참고

- [WebKit: iOS Home Screen Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [Apple: Safari에서 웹사이트를 앱으로 사용](https://support.apple.com/guide/iphone/iphea86e5236/ios)
- [Lazyweb: 알림 권한 설정 화면 참고](https://www.lazyweb.com/agentic-search/2980a036-8ee5-4ac1-af78-b4315089d77e)
