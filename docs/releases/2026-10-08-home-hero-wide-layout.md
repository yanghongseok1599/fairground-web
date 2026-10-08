# 홈 히어로 와이드 비율과 대회 결과 배치

데스크톱 히어로를 21:9로 바꿔 같은 너비에서 높이를 약 24% 줄였다. 기존 16:9 영상의 상하를 중앙 기준으로 크롭하며 모바일은 16:9를 유지한다. 영상 파일·재생 길이·무음 자동재생·반복·정지 동작은 그대로다.

우승·수상 정보를 표시하는 `HomeCupResults`를 히어로 바로 아래로 이동하고 홈 결과 영역의 상하 여백을 줄였다. 대회 상세의 여백, 결과 집계 로직, 실제 경기·선수·우승 데이터는 변경하지 않는다. 수정은 `src/app/page.tsx`, `src/components/home-video-hero.tsx`, `src/features/cup-results/{home-cup-results,cup-results-section}.tsx`에 한정한다.

화면 구성은 [Lazyweb 실제 사례](https://www.lazyweb.com/agentic-search/648211d8-7e52-4297-8055-5af3b5aeff73)를 확인했다. 원본 영상과 자산 검증은 [49차 기록](2026-10-08-home-hero-video.md)을 유지한다.

## 검증

기준 소스 `75ae755`의 격리 worktree에서 검증하며, 기존 dirty/untracked 파일 173개를 출시에서 제외한다.

- `npm ci --include=dev`: 잠금 파일 유지.
- `npm run lint`: 오류 0개, 기존 경고 16개. `npx tsc --noEmit`: 통과.
- 기존 컵 결과·최종순위 회귀 테스트: 14/14 통과.
- 실제 개발 DB 카탈로그 검사 통과. 운영 `vercel build --prod`에서 컬럼 계약370개·조회103개 대조 후 Next 빌드·54개 정적 페이지·배포 출력 생성까지 통과.
- 데스크톱 1425×610.711(21:9), 모바일 390×219.375(16:9)에서 무음 자동재생과 시간 증가를 확인했다. 단체 장면의 주요 얼굴·배너 구도도 실제 화면에서 확인했다.

개발에는 완료된 대회 데이터가 없어 실제 우승 정보의 표시 순서는 운영 배포 후 확인한다. 자동 Preview의 게이트·최종 Ready를 확인한 뒤 검증된 Production 빌드를 배포한다. 기존 GitHub Actions의 `SUPABASE_DB_URL` secret 누락은 별도 설정 문제이며 환경변수·DB·권한·의존성을 변경하거나 빌드 게이트를 우회하지 않는다.
