# 2026-09-30 운영 Supabase 인증 장애 복구

상태: **운영 서비스 정상화 및 실제 Google 로그인 → 마이페이지 진입 확인 완료.**

## 확인한 장애

사용자가 구글 로그인 중 운영 Supabase 도메인에서 `522 Connection timed out`이 출력된 화면을 전달했다. 공개 인증 health 요청은 12초 내 응답하지 않았고, CLI의 DB 로그인 역할 발급도 544 연결 시간 초과로 실패했다.

관리 API에서 Google 공급자가 활성이고 client ID·secret이 등록돼 있음을 확인했다. 운영 사이트 주소와 콜백 허용 목록도 유지돼 있었다. 프로젝트 목록의 `ACTIVE_HEALTHY` 표시와 달리 서비스별 검사에서는 DB·Auth·REST·Storage가 `UNHEALTHY`, pooler만 정상으로 보고됐다. 로그인 실패를 계정 암호나 Google 공급자 미설정으로 처리하지 않았다.

Supabase 상태 페이지에는 미 동부 네트워크 지연 공지가 있었지만 서울 프로젝트 장애와의 연관성은 확인하지 못했다. 개별 프로젝트의 DB 연결 불가를 확인했으며 근본 원인은 아직 특정하지 않았다.

## 복구 조치

사용자의 로그인 복구 요청에 따라 2026-09-30 13:35:22 KST, 공식 Management API의 운영 프로젝트 restart를 한 번 호출했다. 응답 200 후 프로젝트가 `RESTARTING`으로 전환됐다. 이 조치는 스키마 변경·마이그레이션 복구·데이터 초기화가 아니다. 회원·암호·권한·OAuth 설정을 변경하는 요청은 실행하지 않았다.

개발 Preview의 OAuth 미설정과 이번 운영 서버의 522 장애는 별개다. 개발/운영 연결을 교체하지 않았다. 이번 작업의 증거는 상위 작업공간 `output/ops/2026-09-30-auth-recovery/`에 저장한다. 관리 API 인증 토큰과 OAuth 비밀키는 기록하거나 출력하지 않았다.

참고: [Supabase 서비스 비정상 안내](https://supabase.com/docs/guides/troubleshooting/project-status-reports-unhealthy-services), [HTTP API 장애 진단](https://supabase.com/docs/guides/troubleshooting/http-api-issues).


## 복구 검증

- 13:40:42 KST 재시작 후 프로젝트가 `ACTIVE_HEALTHY`로 복귀했다. DB·Auth·REST·Storage·pooler의 개별 상태도 모두 정상이다.
- 운영 Auth health는 HTTP 200, 260ms로 응답했다. Google authorize 요청은 387ms에 `accounts.google.com`으로 HTTP 302를 반환했다.
- Ego 브라우저에서 실제 운영 `/login?returnTo=/my`의 `Google로 계속` 버튼을 누른 뒤 인증된 `/my`와 기존 사용자 프로필 표시를 확인했다. 기존 Google 세션으로 자동 복귀하여 Google 페이지를 기다리던 관찰 도구는 타임아웃됐지만, 이후 현재 페이지를 직접 확인해 로그인 완료를 검증했다. 새 계정 생성·권한 부여 요청은 실행하지 않았다.
- 읽기 전용 쿼리로 `ccv5`의 `role=admin`, `is_approved=true`를 확인했다. 계정 암호나 권한은 수정하지 않았다.
- 복구 후 디스크 8.42GB 중 사용량은 0.53GB, 가용량은 7.89GB였다. 복구 전 자원 상태를 확보하지 못했으므로 용량 부족 또는 과부하를 근본 원인으로 단정하지 않는다.
- Supabase 안전장치 4개와 기존 보안 회귀 7개 통과. 앱 소스·의존성·OAuth 설정·DB 스키마·Vercel 배포는 이번 복구에서 변경하지 않아 앱 재빌드는 하지 않았다.

원격 변경은 운영 프로젝트 재시작 1회다. 기존 마이그레이션 기준선 불일치와 linked push/reset/repair 금지는 그대로 유지한다. 검인 기능의 운영 반영 여부는 별도 [검인 릴리스 기록](2026-09-30-player-inspection.md)을 따른다.
