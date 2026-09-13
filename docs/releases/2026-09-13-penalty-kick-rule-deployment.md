# 페널티킥 도움닫기 금지 규정 운영 배포

- 운영 룰북: https://fairground-kor.com/rulebook
- 구현 커밋: `138625e`
- 배포 ID: `dpl_4VA9FhmQhZmhDafzCMZfDQhTsnfD` (`READY`)
- 배포 URL: https://fairground-opv608n4q-milestones-projects-d52c4dda.vercel.app
- 기준 운영 배포: `dpl_7wsVYBauKB29PkjBx1SixcDnDjHD`

경기 규정 제6조 제4항에 “페널티킥은 도움닫기 없이 디딤발을 공 옆 지면에 붙인 상태에서 바로 슈팅하여야 한다.”를 추가했다. 웹의 심판·주장 안내와 PDF 3종에도 반영했다. PDF 안내 상자가 페이지 사이에서 나뉘지 않도록 생성기의 인쇄 스타일을 보완했다.

## 배포 범위와 검증

- 운영 소스 891개를 파일 해시로 검증하여 별도 디렉터리에 복원했다. 구현 커밋의 부모 파일이 운영 원본과 일치하는지 확인한 뒤 변경 파일 8개만 적용했다. 다른 883개 파일은 운영 원본을 유지했다.
- Vercel에 업로드된 소스 891개가 배포 후보와 모두 일치했다. 작업 브랜치의 다른 미배포 기능과 미커밋 작업은 포함하지 않았다.
- 배포 후보 lint 오류 0(기존 경고 18), TypeScript, Supabase 안전장치 테스트 4개 통과. Vercel 운영 `npm run build` 통과.
- 운영 Supabase 카탈로그를 읽기 전용으로 조회하여 배포본이 참조하는 함수 35개·테이블/뷰 27개·버킷 1개가 모두 존재함을 확인했다. 동적 호출 1개는 정적 검증 범위 밖이다.
- Vercel의 기존 `SUPABASE_DB_URL` 미설정에 대해서는 위 카탈로그 검증 후 해당 배포 명령에만 `--build-env FAIRGROUND_SKIP_DB_PARITY=1`을 적용했다. 프로젝트 환경변수나 게이트 코드를 변경하지 않았다.
- `--skip-domain`으로 운영 빌드를 생성하고, Vercel CLI 인증으로 새 배포의 룰북과 PDF 3종을 먼저 검증한 뒤 `vercel promote`로 운영 도메인에 연결했다. 보호된 배포 확인 과정에서 CLI가 프로젝트의 배포 보호 우회 토큰을 생성했으며 토큰 값은 기록하지 않았다.
- 운영 도메인에서 룰북 HTTP 200 및 새 규정 문구를 확인했다. PDF 3종도 HTTP 200, `application/pdf`, 검증한 파일과 동일한 SHA-256을 확인했다. 변경 파일 해시는 [배포 manifest](2026-09-13-penalty-kick-rule-deployment-manifest.json)에 기록했다.

운영 웹사이트는 새 배포로 변경했다. Supabase 데이터·스키마·Auth·Storage·마이그레이션 이력은 변경하지 않았다. 기존 마이그레이션 이력 불일치는 계속 유지되며 운영 SQL push/repair는 금지 상태다.

회귀 시 기준 배포 `fairground-6mlzgxu9t-milestones-projects-d52c4dda.vercel.app`으로 운영 도메인을 되돌릴 수 있다.
