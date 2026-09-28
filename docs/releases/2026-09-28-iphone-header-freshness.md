# iPhone 헤더 위치·구버전 화면 복구 — 18차

사용자가 iPhone 스크롤 중 화면 중간에 나타난 헤더와 남아 보이는 연습 메뉴를 신고했다. 첨부에는 제거된 `테스트 경기 시뮬레이션` 버튼이 있었지만 현재 운영 페이지를 새로 열면 버튼이 없고, 24경기 모두 예정·0:0이었다. 사용자의 기기 내부 상태를 직접 읽지 않았으므로 화면 캐시를 유일한 원인이라고 단정하지 않았다.

## 변경

- 공통 헤더를 body 바로 아래 `sticky; top: 0` 흐름으로 바꾸고 기존 본문 보정 여백을 제거하여 시작 위치를 유지했다. 모바일 헤더의 backdrop-filter를 제거하고 흰 배경을 사용해 Safari 스크롤/브라우저 UI 변화에서 합성 레이어 의존을 줄였다.
- SW v3는 실제 페이지 HTML을 저장하거나 과거 HTML로 되돌리지 않는다. 네트워크 실패 시 오프라인 안내를 표시한다. 기존 FairGround v2 캐시만 폐기하고 정적 해시 자산 캐시는 유지한다.
- `/sw.js`의 HTTP 캐시를 금지하고 `updateViaCache: none`으로 재등록한다. 로그인·푸시 구독·사진·경기 전송 대기열 저장소는 지우지 않는다.
- Safari BFCache 복원 시 읽기 화면만 갱신한다. 경기 기록·교체·출전 명단·회원 수정 경로 또는 열린 작성창은 강제 갱신하지 않는다. SW도 열린 입력 경로가 있으면 교체 요청을 미룬다.
- 관리자 경기 목록은 탭을 다시 볼 때 최신 DB 내용을 재조회한다. 작성창이 열렸거나 이미 조회 중이면 중복 재조회를 피한다.

## 검수

캐시된 구버전 HTML을 반환하지 않는지, 오프라인 안내, 캐시 제거 범위, DB 요청 비개입, 업데이트 중 기록 화면/작성창 보호, BFCache 단일 갱신, 최초 설치 시 불필요한 reload 방지 등 9개 테스트 통과. TypeScript 및 production build 통과. 전체 린트 오류 0, 기존 경고 16개. 운영 DB의 실제 타입 컬럼 330개·조회 74개 검증을 통과한 소스로 빌드했다. 새 DB 컬럼/쿼리/마이그레이션 및 운영 데이터 쓰기는 없다.

기술 기준: [CSS position](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/position), [pageshow](https://developer.mozilla.org/en-US/docs/Web/API/Window/pageshow_event), [updateViaCache](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/updateViaCache). Lazyweb 모바일 내비게이션 검색은 인접 사례만 반환하여 시각 재설계 근거로 사용하지 않았다. 사용자 기존 화면을 유지하는 오류 수정에 집중했다.

검수 제한: 데스크톱 Chromium과 모바일 크기 에뮬레이션으로 위치·스크롤을 검사한다. 실제 iPhone Safari 기기를 제어하지 않았으므로 실기기 재현/해결까지 검증했다고 표현하지 않는다. 이미 열린 구버전 탭은 최초 한 번 사이트를 다시 열어야 새 코드가 도착할 수 있다.

## 운영 반영 결과

- 배포 `dpl_EXUHfwz7Qh8YqMako4CgNzswBj5p`가 Ready이며 `fairground-kor.com`, `www.fairground-kor.com` 두 도메인을 연결했다.
- 새 운영 경기 관리 화면의 최초 로딩 완료를 기다려 확인: 테스트 시뮬레이션 버튼 없음, 24개 경기 모두 예정·0:0. 대회·대진표는 사용자 요청대로 보존한다.
- 390×844 세로 화면에서 스크롤 0·980·2059·1176px, 844×390 가로 화면, 1280×900 PC 화면 모두 헤더 top=0px·높이=60px였다. 세로 모바일 backdrop-filter=none, 가로 넘침 없음.
- 운영 `/sw.js`에서 v3 코드와 `Cache-Control: no-store, max-age=0`, `Service-Worker-Allowed: /`를 확인했다. 브라우저 측 v2 캐시는 여전히 관측되었으므로 해당 브라우저의 v3 활성화·캐시 삭제까지 완료했다고 단정하지 않는다. 다른 열린 입력 경로가 있으면 의도적으로 교체를 보류한다.
- 최종 화면 크기 변경 직후의 별도 스냅샷은 경기 카드 0개를 반환해 목록 검수 근거로 사용하지 않았다. 목록 결과는 최초 로딩 완료 후의 24개 카드 추출을 근거로 한다.
- 재현 자료는 `output/ops/2026-09-28-iphone-header/`에 저장했다. 운영 DB 수정 없이 완료했다.
