# 보안 수정·의존성 패치 운영 배포

운영 소스 5025746 + 검인 release.patch + 전담 권한 operators.patch + 카카오 3e1a2c5를 재구성하고 보안 수정 2d5b9aa 및 의존성 수정 15b9391을 추가했다. Next.js의 새 GHSA-vcvr-r3jv-pc5j가 배포 직전 재감사에서 확인되어 Next.js·eslint-config-next를 16.3.8로 갱신했다. 퀴즈·제안서 등 기존 미완료 작업은 릴리스 소스에 포함하지 않았다.

공식 advisory: https://github.com/advisories/GHSA-vcvr-r3jv-pc5j

새 npm ci 후 전체 감사 0건, 기존 보안 테스트와 수정 회귀 테스트 통과. 소스 lint 오류 0(기존 경고), TypeScript 통과. 운영 DB 카탈로그 검사를 우회하지 않은 Vercel production prebuild·빌드 통과. 배포 산출물의 임시 DB 비밀번호 검사도 통과했다.

운영 스키마 백업 579,105바이트를 격리 PostgreSQL에 복원하여 4,805개 정의의 일치를 확인했다. 이번 SQL의 함수 2개 변경과 롤백도 검증했다. 다만 전체 로컬/원격 마이그레이션 이력은 불일치하고 완전한 이력 재현은 미완료다. fairground-supabase-safety 원격 변경 조건에 따라 SQL 20261001010000은 운영·개발에 적용하지 않았다. 운영 DB·회원·경기 데이터 및 이력 72건은 변경하지 않았다. 따라서 DB 관련 보안 지적 3건은 운영에서 아직 해소되지 않았다.

백업·검수·빌드 기록: ../output/ops/2026-10-01-security-deployment (저장소 바깥, 비공개 보관). 롤백 웹 배포: dpl_AEkon9PJhjUJm2BHdie8U4gjhqWi.

## 운영 웹 반영 완료

2026-10-01 KST 새 배포 dpl_FQnjnWb4oPScojPg2SzNL9QH6hou READY 확인 후 vercel promote로 공식 도메인에 연결했다. fairground-kor.com과 www의 홈·로그인·대회 목록 HTTP 200을 확인했다. 웹의 내부 복귀 주소 검사 및 CSV 수식 중립화, 빌드 연결 TLS 검증과 새 의존성이 반영됐다. DB 수정 미적용 상태는 위 기록과 같다.
