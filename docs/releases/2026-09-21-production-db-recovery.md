# 2026-09-21 운영 DB 장애 복구

## 대상과 승인

사용자가 반복 점검 결과를 확인한 뒤 **“복구해줘”**라고 요청하여 Fairground 운영 프로젝트의 재시작을 진행했다. 개발 환경과 운영 환경의 분리는 `npm run supabase:safety`로 확인했다. 대상은 Fairground, main/PRODUCTION, 서울 리전이다.

이번 조치는 Supabase Dashboard의 **Settings → General → Restart project**이다. 백업 시점으로 되돌리는 복원, DB 초기화, 마이그레이션 적용, 스키마·회원 데이터 수정, 요금제 변경은 수행하지 않았다. 기존 마이그레이션 보호 규칙은 계속 유지된다.

## 장애 증거

- 09:47 KST 운영 `/admin`의 `get_my_profile` 조회 2건이 각각 약 19.568초와 19.573초 후 실패하여 관리자 메뉴에 진입하지 못했다.
- 읽기 전용 원격 마이그레이션 조회도 login role 생성 단계에서 DB connection timeout으로 실패했다.
- Dashboard 상태는 Unhealthy였으며, 앞선 세부 확인에서 Database·PostgREST·Auth·Storage가 Unhealthy였다.
- PostgREST 로그에 `Thread killed by timeout manager`와 statement timeout이 있었다. 최신 확인 로그는 09:21:24였다.
- 해당 장애의 구체적인 시스템 원인은 이 기록만으로 확정하지 않는다.

## 실행 기록

- 09:49 KST Fairground 운영 프로젝트의 재시작 확인 창과 대상을 확인했다.
- 재시작을 한 번 실행한 뒤 09:50:23 KST Management API가 `RESTARTING`을 반환했고 Dashboard도 Restarting 안내를 표시했다.
- 09:50:53 KST Vercel 운영 배포는 `dpl_GeZYrBRTqP6RuN2dDMHN1NGunkVt`, `READY`로 유지되고 있었다. 이번 복구에서 웹 재배포는 수행하지 않았다.
- 09:52 KST Dashboard 상태가 Healthy로 전환됐다. 09:52:11 KST Management API에서도 `ACTIVE_HEALTHY`를 확인했다.

## 복구 후 실제 동작 확인

- 운영 사이트 `/admin` 진입 성공. `get_my_profile` 요청 2건은 모두 HTTP 200이며 각각 약 496ms와 491ms였다.
- 실제 관리자 메뉴의 선수 승인 링크를 눌러 `/admin/players`로 이동했고, **선수 86명**이 표시됐다. 로딩 상태도 종료됐다.
- 승인 목록 전용 GET 요청은 HTTP 200, 약 **58ms**였다. 선택 컬럼은 승인에 필요한 9개 필드이며 사진 원본은 포함하지 않았다.
- 09:52:29 KST 원격 마이그레이션 이력의 읽기 전용 조회가 종료 코드 0으로 완료됐다. 이는 연결 복구 확인이며, 기존 로컬·원격 이력 불일치가 해결됐다는 의미는 아니다.
- 09:53 KST 서비스별 건강 상태를 확인했다. Database·PostgREST·Auth·Realtime·Storage·Edge Functions 6개 모두 **Healthy**였다.
- `supabase inspect db blocking --linked`가 정상 완료됐으며 차단된 쿼리는 0건이었다.
- 선수 승인 화면을 새로고침한 뒤에도 86명과 로딩 종료를 확인했다. 프로필 조회 2건은 HTTP 200, 약 135ms/96ms였고 승인 목록은 HTTP 200, 약 115ms였다.
- 검증 중 승인·역할 변경이나 회원 데이터 쓰기는 수행하지 않았다.

복구 완료: 운영 프로젝트 재시작 이후 서비스 건강 상태, DB 직접 진단 연결, 실제 관리자 메뉴 이동 및 새로고침이 모두 정상 동작했다. 장애 원인을 확정하거나 영구적인 재발 방지를 보장하는 결과는 아니다.

## 참고

- [선수 승인 목록 수정·배포와 이전 장애 점검 기록](2026-09-21-admin-player-loading.md)
- [운영 프로젝트](https://supabase.com/dashboard/project/ovtnmslyjzvghirdvife)
- [Supabase의 Unhealthy 서비스 진단 안내](https://supabase.com/docs/guides/troubleshooting/project-status-reports-unhealthy-services)
