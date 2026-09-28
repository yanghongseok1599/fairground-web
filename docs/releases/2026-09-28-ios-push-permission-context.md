# 아이폰 알림 권한·수신 연결 구분 및 Chrome 안내 — 19차

## 확인한 원인

사용자는 Safari 일반 탭에서 하단 알림 설정 실패를 신고했고, 아이폰 설정의 허용 상태와 웹 표시의 차이 및 Chrome에서도 Safari로 안내되는 문제를 추가로 지적했다.

- 하단·메뉴는 API 존재 여부만 보고 구독을 시도했다. 마이페이지에 있던 iOS 홈 화면 실행 조건을 공통 환경 검사로 옮겨 모든 구독 진입점에 적용했다. 브라우저 탭에서 홈 화면 앱이 설치돼 있는지 또는 그 앱의 권한이 허용됐는지는 알 수 없다.
- `getPushPermission`은 미지원 환경을 `denied`로 반환했고, 마이페이지는 설치 전·권한 미요청·권한 허용 후 연결 누락을 모두 OFF로 표시했다. 미지원은 `unavailable`로, 권한 허용 후 계정 구독 누락은 `unlinked`로 구분했다. 조회 오류에서도 확인된 허용 권한은 유지한다. ON은 현재 계정·기기의 저장된 구독까지 확인한 경우에만 표시한다.
- 설치 안내의 Safari 문구가 고정돼 있었다. Chrome이면 현재 Chrome의 주소창 옆 공유 메뉴를 안내한다. 외부 브라우저 이동·주소 복사는 인앱 브라우저에만 안내하고 Chrome 또는 Safari를 선택할 수 있다.

## 동작

아이폰 일반 탭의 하단 버튼은 ‘설정 방법’으로 표시하고 마이페이지 안내로 연결한다. 홈 화면 앱 권한을 임의로 차단/OFF로 표시하지 않는다. 이미 아이콘이 있으면 그 아이콘으로 열도록 먼저 안내한다. 설치 방법은 펼쳐볼 수 있다. 로그인된 아이폰에서 두 개의 하단 설치 배너가 겹치지 않는다.

홈 화면 앱은 ‘알림 권한’과 ‘대회 알림 수신 연결’을 별도로 표시한다. 허용됐지만 계정 구독이 없으면 ‘대회 알림 수신 연결’ 버튼을 제공한다. 포커스·화면 재표시·pageshow 복귀 시 다시 읽는다. OS 권한을 대신 허용하거나 다른 실행 환경의 권한을 추정하지 않는다.

## 검증

- 관련 자동 검사 51개 통과: Safari/Chrome 일반 탭 구독 차단, iPad 데스크톱 UA, Android 유지, 미지원과 거부 구분, 허용/연결 누락/조회 오류, 권한 재조회, 기존 등록·구독 회귀.
- 전체 린트 오류 0개, 기존 경고 16개. TypeScript 및 Vercel production build 통과.
- 실제 운영 카탈로그에서 함수 36개·관계 27개·버킷 1개, 타입 컬럼 330개·조회 74개를 검증하고 같은 소스의 prebuild에서도 통과했다. 우회 플래그·운영 SQL 변경은 없다.
- 개발 DB의 합성 관리자 계정으로 390px Chromium에서 iPhone Chrome UA를 재현했다. 하단 ‘설정 방법’ → 마이페이지, Chrome 공유 안내, 중복 배너 없음, 가로 넘침 없음을 확인했다.
- 홈 화면 실행·알림 API를 가상화해 실제 컴포넌트가 허용+연결 필요 / 차단 / 설정 복귀 후 허용으로 바뀌는 것을 확인했다. 실제 권한 팝업을 승인하거나 운영 구독을 변경하지 않았다. 실제 iPhone WebKit·APNs 수신 검증을 대신하지 않는다.

## 빌드 기준

작업 도중 반영된 18차 `656f124` / `dpl_EXUHfwz7Qh8YqMako4CgNzswBj5p`를 최신 기준으로 사용했다. 16차 배포 소스 해시 345개가 해당 Git 기준선과 일치하는 것을 확인한 뒤 18차 수정까지 포함한 격리 소스에 이번 런타임 12개 파일만 반영했다. 기존 미커밋·미추적 기능은 포함하지 않았다.

Vercel에서 내려받은 공개 Supabase 변수 두 개가 빈 값이어서 최초 빌드가 차단됐다. 격리 빌드 환경에 기존 운영 프로젝트의 검증된 공개 값을 제공했다. 원격 환경변수는 변경하지 않았다. 일회성 DB 접속 정보가 들어간 로컬 Turbopack 캐시는 제거하고 배포 산출물에 DB 비밀번호가 없음을 확인했다.

## 운영 반영

- 검증된 prebuilt 산출물 `dpl_CJ5HbbZqnpMzz5zofdzh4zMqsyXp` / `https://fairground-n1frkijz4-milestones-projects-d52c4dda.vercel.app`를 배포했다. `/my`, `/teams`, `/sw.js` HTTP 200을 확인했다.
- 두 공식 도메인이 여전히 18차 기준을 가리키는지 확인한 후 `fairground-kor.com`, `www.fairground-kor.com`을 새 결과물로 연결했다.
- 실제 운영 로그인 화면에서 iPhone Chrome 조건으로 하단 ‘설정 방법’ → `/my#participant-readiness` → Chrome 공유 메뉴 안내를 확인했다. 가로 넘침이 없고 헤더 top=0이다. 실제 회원 동의·구독·프로필을 수정하지 않았다.
- 18차 SW v3 및 `Cache-Control: no-store, max-age=0`를 유지했다. 실제 iPhone 기기의 알림 수신 여부는 아직 검증하지 않았다.

## 참고

- [Apple WebKit: 홈 화면 앱별 권한 및 다른 브라우저에서 홈 화면 추가](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [Google Chrome: iPhone·iPad에서 웹 앱 추가](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DiOS&hl=ko)
- [Lazyweb 알림 설정 UI 참고](https://www.lazyweb.com/agentic-search/2980a036-8ee5-4ac1-af78-b4315089d77e)
