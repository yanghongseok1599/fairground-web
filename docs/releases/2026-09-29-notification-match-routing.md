# 경기 알림 중복 및 상세 이동 수정

## 원인과 변경

- 같은 갤럭시 한 대를 사용하는 것으로 사용자에게 확인된 계정에 Android 푸시 구독이 두 개 남아 있었다. 실기기 수신 사진으로 Chrome과 설치된 앱의 연결을 구분한 뒤, FairGround 앱 연결과 Mac 연결을 보존하고 Chrome 구독 한 건을 백업·제거했다. 생성 시각만으로 설치 앱을 식별할 수 없었으므로 초기 선택은 사진 확인 후 백업에서 바로잡았다. 최종 교체에서 대상 외 구독 39건의 행 해시가 같음을 트랜잭션 안에서 확인했다. 기기 정보가 같은 다른 회원의 구독은 합치지 않았다.
- Realtime 알림 수신에서도 운영체제 알림을 생성하던 경로를 제거했다. 이제 Realtime은 헤더 읽지 않은 알림 수와 열린 알림함을 갱신하고, 휴대폰 알림은 Web Push만 담당한다.
- 운영 `notifications.match_id`는 이미 존재했지만 `call_push_dispatch()`가 `id`, `match_id`를 전달하지 않았고 Edge Function도 경기 경로를 처리하지 않았다. 웹 알림함과 Edge Function은 공통 `notificationTarget()`으로 해당 경기의 `/matches/[id]`를 사용한다. 경기 정보가 없는 `match_ready`·관리자 발송은 `/live`로 이동한다. 커뮤니티·팀·승인 알림의 목적지는 유지한다.
- 서비스 워커는 같은 알림 ID의 재전달에 동일 tag를 사용한다. 다른 경기 이벤트는 별도 알림으로 유지한다. tag만으로 별도 브라우저의 구독을 중복 제거할 수 있다고 가정하지 않는다.
- 클릭 시 해당 매치 창이 이미 열려 있으면 포커스하고, 홈·라이브 창은 이동시킨다. 심판 기록이나 입력 중인 화면은 보존하며 새 창을 연다. 다른 출처 URL은 열지 않는다.

## 검증과 운영 반영

- 관련 테스트 69개 통과: 경기·게시글·팀 경로, ID 전달, 클릭 처리, 알림 tag, 인증 거부, 만료 구독만 제거, 기존 iOS 연결 검수 포함.
- lint 오류 0개, 기존 경고 16개. TypeScript 통과.
- 실제 배포 소스의 운영 스키마 정합성 검사와 `vercel build --prod` 통과. 타입 컬럼 330개·조회 74개·RPC 36개·관계 27개를 확인했다.
- 운영 스키마를 새로 백업하고 격리 PostgreSQL 17에 복원했다. 공개 스키마 객체 4,560개 정의가 같음을 확인했다. 합성 알림 + 모의 전송으로 경기 ID·알림 ID 전달과 일반 알림의 null 경기 ID를 검증하고 롤백까지 확인했다. 운영 회원 데이터는 개발에 복사하지 않았다.
- `20260928040000_push_match_destination.sql` 단일 변경으로 `call_push_dispatch()` 본문만 수정했다. 소유자·권한·SECURITY DEFINER·search_path는 유지했다. 기존 이력 67건을 보존하고 해당 버전만 추가했다. 운영 적용 시각: 2026-09-28 23:59 KST.
- SQL SHA-256: `2f6b6f5d7117f024bbdb3b382292b10c780ba25bf85e0fae705f3f08d53bac7b`.
- Edge Function `push-dispatch` v2 배포. 기존 webhook secret 인증과 JWT 설정을 유지했다. VAPID 키를 바꾸지 않았다.
- 웹 배포: `dpl_Fd7KMjTqp6EAGK5MZP9oU8YQ267r` / `fairground-261z5whzq-milestones-projects-d52c4dda.vercel.app`.
- 두 운영 도메인의 서비스 워커 파일이 검증한 원본과 같은지 확인했고, 실제 브라우저에서 `/live` 화면도 확인했다.
- 기준 커밋 `fd90296`의 팀 카드 변경을 보존한 격리 빌드이며, 미적용 퀴즈 런타임 등 다른 작업은 포함하지 않았다. 임시 DB 자격증명이 배포 결과물에 없는지도 검사했다.
- 보호된 로컬 근거: `tmp/notification-routing/production-schema.dump`, `before.json`, `reviewed-diff.json`, `production-receipt.json`, `removed-subscription-backup.json` (Git 제외). 운영 함수의 이전 소스는 `tmp/notification-routing/edge-before/`에 보존했다.

## 확인 범위

현재 운영 경기 수가 0개여서 실제 경기 한 건을 생성해 링크를 시험하지 않았다. 특정 매치 목적지는 합성 데이터 테스트로 검증하고, 실기기 테스트는 `/live`를 사용한다. 이미 도착한 알림에는 이전 URL이 남는다. 기존에 열린 웹 화면은 갱신해야 Realtime 중복 방지 코드가 적용된다. 전달 서버의 성공 응답은 휴대폰 표시·탭 성공을 뜻하지 않으므로 사용자 확인과 구분한다.

기존 마이그레이션 이력 불일치는 여전히 남아 있다. linked `db push`, `db reset`, `migration repair`를 실행하지 않았으며 금지 상태를 해제하지 않는다.

[Lazyweb 알림 상태·기기 연결 참고](https://www.lazyweb.com/agentic-search/2980a036-8ee5-4ac1-af78-b4315089d77e)를 확인했다. 별도의 설정 화면 재설계는 하지 않았다.

## 실제 발송 확인

00:01:12 테스트는 사용자가 첨부한 사진으로 Chrome 수신을 확인했다. DB 웹훅 응답은 기존 5초 제한으로 시간 초과였지만 실기기 수신이 있었으므로 이를 미전달로 단정하거나 동일 알림을 재전송하지 않았다. 운영 Edge Function의 구독 없는 합성 계정 검수도 HTTP 200으로 통과했다.

이후 앱 연결 복원과 Chrome 연결 정리를 완료했다. `app-subscription-receipt.json`, `chrome-subscription-backup.json`에 변경 근거와 복구 정보를 보존했다.

00:03:46 앱 연결 테스트는 지정 계정에만 직접 Web Push로 발송했다(알림함 행 추가 없음). HTTP 200, `sent: 2`, `removed: 0`으로 앱·Mac 전송이 수락됐다. 사용자가 **“FairGround로 한 번 도착하고 정상 이동함”**이라고 확인하여 갤럭시 중복 해소·앱 표시·라이브 스코어 이동을 실기기에서 검증했다.
