# 자동 Preview 경기 명단 조회 누락 복구

2026-10-03 01:28 KST `codex/inspection-birth-date-sync`의 `ef8f7cd` 자동 Preview 빌드는 개발 DB에 `public_match_player_profiles`가 없어 차단됐다. 운영에 적용한 SQL `20261003020000`을 개발에 반영하지 않은 작업 누락이었다. `npm run build`의 prebuild 검사는 DB에 없는 조회 대상 1개와 해당 컬럼 사용 56건을 정확히 검출했다. 서버 연결 시간 초과나 Free 플랜 중단이 이번 빌드 실패의 원인은 아니다.

당시 실패 배포는 `fairground-j994n0xs4-milestones-projects-d52c4dda.vercel.app`이며, 운영 도메인은 별도 `dpl_Hi8v2J9GeaDvzWFM9pptHgxmGXEW` READY 상태였다. 운영 로그인 페이지 HTTP 200, 운영 명단 API HTTP 200/316ms를 확인했다.

## 개발 DB 복구

- 개발 대상과 Preview 브랜치의 클라이언트 환경변수가 개발 프로젝트를 가리키는지 확인했다. 운영 환경변수·도메인·DB는 변경하지 않았다.
- 개발 스키마 530,019바이트를 격리 PostgreSQL에 실제 복원하고 정의/권한/제약조건/뷰 5,469개 일치를 확인했다.
- 기존 SQL `20261003020000_match_player_eligibility.sql`만 적용·롤백 검수했다. 변경/삭제된 기존 정의는 0개, 신규 뷰 관련 정의만 225개 추가됐다.
- 합성 데이터로 선수 겸 감독·주장 유지, 선출 제외, 익명/회원 읽기 권한과 쓰기 거부, 기존 서버 출전 제한 테스트 3건을 통과했다. 실제 회원을 테스트 DB에 복사하지 않았다.
- 01:36:46 KST 개발에 동일 SQL을 적용했다. 기존 개발 이력 10건, 34개 보호 테이블과 회원 15명은 동일했고 새 이력 1건만 추가했다. 전체 이력 복구를 한 것은 아니다.
- 정확한 `ef8f7cd` 추적 소스로 개발 카탈로그 검사: 타입 컬럼 365개·조회 85개, 누락 0개. 개발 공개 명단 API도 HTTP 200을 확인했다.

## 재발 방지

`AGENTS.md`에 DB 객체를 사용하는 코드의 GitHub 푸시 전 개발 반영·실제 Preview 소스의 카탈로그 검사, 푸시 후 자동 Preview 최종 상태 확인을 추가했다. 정합성 게이트나 알림을 끄지 않았다. 운영만 배포하고 자동 Preview 완료까지 누락한 상태를 완료로 보고하지 않도록 했다.

기존 로컬/원격 전체 마이그레이션 이력 불일치와 linked push/reset/repair 금지는 유지한다. 다른 기능의 개발·운영 스키마 차이까지 모두 해결했다고 주장하지 않는다. 백업·스키마 diff·보존 영수증·빌드 로그는 저장소 밖 `../output/ops/2026-10-03-preview-eligibility-repair/`에 보관한다.

## Vercel 원격 재배포 결과

- 같은 커밋 `ef8f7cd`를 Preview 대상으로 다시 빌드했다. 운영 대상으로 전환하지 않았다.
- 배포 `dpl_BGP6dN7GpXT4MJLbsS3QNtuk3Quc`, `https://fairground-bqd45mgk2-milestones-projects-d52c4dda.vercel.app`: **READY**.
- Vercel 원격에서도 DB 정합성 검사 통과, Next.js 컴파일 및 TypeScript 통과를 확인했다. 기존 실패 배포 기록은 감사 이력으로 남는다.
