# 선수 승인 목록 로딩 개선 운영 반영

- 구현 커밋: `6b4b3ea`
- 운영 URL: https://fairground-kor.com/admin/players
- 새 배포: `dpl_GeZYrBRTqP6RuN2dDMHN1NGunkVt`
- 배포 URL: https://fairground-4gh9cvhwo-milestones-projects-d52c4dda.vercel.app
- 이전 운영 배포(롤백 기준): `dpl_G5VCwUz3vYBjsqXErJmryFrdunMU`
- 이전 배포 URL: https://fairground-i441r9wck-milestones-projects-d52c4dda.vercel.app

## 원인과 변경

기존 선수 승인 화면은 공용 `fetchPlayers()`로 전체 프로필과 사진 원본을 한꺼번에 받았다. 운영 선수 86명의 표시 정보와 사진을 조회한 응답은 91,089,030 bytes였고, 기존 요청은 약 25초 후 시간 초과가 발생했다. 공용 조회가 오류를 빈 배열로 바꾸고 화면에 별도 재시도 상태도 없어 실패 원인을 알기 어려웠다.

승인 목록 전용 조회·상태 훅·사진 컴포넌트를 `src/features/admin-players/`에 분리했다. 목록은 기존 관리자 전용 RPC에서 승인에 필요한 9개 필드만 GET으로 조회한다. 같은 86명 목록은 21,241 bytes, 진단 시 약 859ms였다. 사진은 관리자가 해당 선수의 **사진 보기**를 누른 경우에만 한 건을 조회하며 기존 잠금 사진 우선순위를 유지한다.

12초 제한, 화면 이탈 시 취소, 늦게 도착한 이전 응답 무시, 오류 안내와 다시 불러오기를 추가했다. 승인·역할·선수 출신 상태를 변경하는 기존 쓰기 경로는 그대로 사용한다.

## 배포 범위

작업 브랜치의 다른 변경을 함께 배포하지 않도록 이전 실제 운영 배포의 933개 파일을 시스템 임시 폴더에 복원하고 SHA-1을 대조했다. 이번 구현 5개 파일만 덮어쓴 후 별도 배포했다. 업로드된 937개 파일을 다시 대조한 결과 차이는 이번 소스·테스트 5개와 검증 중 생성된 `tsconfig.tsbuildinfo`뿐이었다. 세부 해시는 [배포 매니페스트](2026-09-21-admin-player-loading-manifest.json)에 기록했다.

별도 URL에서 READY와 HTTP 200을 확인하고, 운영 도메인이 기존 배포를 유지하고 있는지 확인한 뒤 새 배포를 promote했다. 운영 도메인의 deployment ID가 새 ID와 일치함을 확인했다.

운영 DB 스키마·회원 데이터·마이그레이션 기록·영구 환경변수는 변경하지 않았다. 기존 운영 빌드 환경에 `SUPABASE_DB_URL`이 없어 이번 배포에 한해 빌드 변수 `FAIRGROUND_SKIP_DB_PARITY=1`을 전달했다. 참조하는 기존 관리자 RPC는 실제 운영에서 읽기 전용으로 확인했으며 새 DB 객체는 필요하지 않다.

## 검증

- ESLint: 오류 0, 기존 경고 18.
- TypeScript 검사와 Next.js production build 통과.
- 승인 목록 전용 회귀 테스트 8개 통과: 사진 필드 제외, 실패·빈 응답 구분, timeout, 취소, 늦은 응답, 단일 사진 필터와 잠금 사진 우선순위.
- 관리자 메뉴·접근 권한 관련 테스트 및 Supabase 안전장치 테스트 4개 통과.
- 실제 운영 소스를 복원한 격리 배포 폴더에서도 TypeScript, 대상 ESLint, 전용 테스트 통과.
- 개발 브라우저: 합성 데이터 15명 표시, 초기 목록 요청 약 82ms. 초기 사진 요청 0건, 사진 버튼 클릭 후 1건. 강제 조회 실패에서 오류·재시도 표시, 실패 해제 후 15명 복구 확인.
- 운영 브라우저: promote 직후 `/admin/players`에서 선수 86명 정상 표시 확인. 승인 상태나 선수 데이터는 변경하지 않았다.

### 후속 확인 중 발생한 운영 DB 연결 지연

운영 메뉴를 통한 재진입을 확인하는 과정에서는 `get_my_profile`과 최소 필드의 `get_admin_profiles` 조회 모두 연결 시간 초과가 발생했다. 공개 REST 진입점과 CORS preflight는 각각 HTTP 401/200으로 응답했으나, Supabase CLI의 읽기 전용 blocking 진단도 login role 생성 중 **Connection terminated due to connection timeout**으로 실패했다. 2026-09-21 00:29 UTC의 관리 API 프로젝트 상태는 `ACTIVE_HEALTHY`였다. 이 상태값만으로 실제 DB 연결 정상 여부를 보장할 수 없다.

따라서 배포 직후 목록 렌더링 성공과 이후의 별도 연결 지연을 구분한다. 데이터베이스 재시작·설정 변경·운영 쓰기는 수행하지 않았다.

### 09:36–09:38 KST 재확인

사용자의 재확인 요청으로 운영 브라우저와 Supabase Dashboard를 읽기 전용으로 점검했다.

- Vercel 운영 도메인은 위 수정 배포를 유지하며 `READY`였다.
- `/admin`의 `get_my_profile` 요청이 각각 약 20.18초와 20.28초 후 실패했다. 관리자 메뉴가 열리지 않았고 최종적으로 접근 권한 안내가 표시됐다. 선수 목록에 진입하기 전 프로필 초기화 단계의 실패이므로 이 재검증에서 목록 정상화를 확인했다고 판단하지 않는다.
- `supabase:safety`는 개발·운영 분리를 확인했다. 읽기 전용 `supabase:migrations`는 login role 생성 단계에서 DB 연결 시간 초과로 실패했다.
- Supabase Dashboard의 Fairground 운영 프로젝트 상태는 **Unhealthy**였다. 세부 상태는 Database·PostgREST·Auth·Storage가 Unhealthy, Realtime·Edge Functions가 Healthy였다. 앞서 관리 API가 반환한 `ACTIVE_HEALTHY`는 실제 서비스별 건강 상태와 달랐다.
- DB 로그에는 09:17–09:18의 statement timeout, 연결 종료, broken pipe가 있었다. 화면에서 확인한 최신 DB 로그는 09:21:14의 checkpoint 완료였다. 재시작·메모리 부족 등 장애의 구체 원인은 이 로그만으로 확정하지 않았다.
- 관측 화면에는 09:25까지의 메모리 사용량 906.26MB, memory commitment 2.54GB, CPU 1.53%가 표시됐다. 연결 수·디스크·네트워크 등 여러 지표는 로드 실패였으므로 오래된 요약값만으로 현재 자원 부족 여부를 판정하지 않았다.

결론: 프런트엔드 수정 배포는 유지되지만 운영 DB와 의존 서비스의 장애가 계속되고 있다. 이번 재확인에서는 코드·운영 데이터·스키마·환경설정 변경이나 DB 재시작을 수행하지 않았다. [프로젝트 상태](https://supabase.com/dashboard/project/ovtnmslyjzvghirdvife)와 [공식 Unhealthy 진단 가이드](https://supabase.com/docs/guides/troubleshooting/project-status-reports-unhealthy-services)를 후속 복구의 참고 경로로 남긴다.

**후속 복구:** 사용자의 복구 요청 후 운영 프로젝트를 재시작하여 09:52 KST Healthy로 돌아왔다. 관리자 메뉴에서 선수 승인으로 이동해 86명 목록 표시와 HTTP 200을 확인했다. 위 장애 상태는 복구 전 점검 기록이다. [재시작 실행 및 복구 검증 기록](2026-09-21-production-db-recovery.md)을 참고한다.

## 정리

검증용 개발 서버를 종료하고, 복원한 운영 소스의 임시 폴더·진단 파일·이번 Next.js 빌드 캐시를 제거했다. 프로젝트 용량은 2.4GB이며 기존 의존성(751MB), 공개 자산(853MB), Git 이력(607MB)이 대부분을 차지한다. 기존 사용자 작업과 의존성은 보존했다.

## UI 참고

오류 원인과 재시도 동작을 함께 보여주는 기존 화면을 참고했다: [Lazyweb 로딩·오류·재시도 검색](https://www.lazyweb.com/agentic-search/05937084-2767-4c52-a331-b7afc8b4ca7a).
