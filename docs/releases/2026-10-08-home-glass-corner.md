# 홈 결과 글래스 버튼 영상 우측하단 배치

홈의 대회 결과 선택 버튼 6개를 영상 우측하단으로 옮겼다. 영상 뒤에 배치한 sticky 레일을 음수 여백으로 겹치게 해 영상 비율을 유지하며, 결과를 보는 동안 버튼은 상단에 남는다. 영상 재생·정지 버튼은 좌하단으로 옮겨 선택 버튼과 충돌하지 않게 했다.

모바일에서는 좌측 재생 버튼 공간을 확보하고 선택 레일만 가로로 이동한다. 데스크톱 21:9·모바일 16:9, 무음 자동재생·반복·정지, 6개 결과 패널·키보드 탐색·동작 감소 설정은 유지한다. 변경은 `home-results-explorer.tsx`, `home-results-navigation.module.css`, `home-video-hero.tsx`에 한정하며 집계 모델·API·DB·미디어 파일을 수정하지 않는다.

[Rimini Wellness 홈페이지](https://www.riminiwellness.com/en)와 [51차에서 확인한 Lazyweb 화면 근거](https://www.lazyweb.com/agentic-search/fcb156a7-5a74-441a-8b93-0b6da0939e33)를 재사용했다. 이번 추가 조회는 HTTP 429로 제한되어 새 검색 근거를 사용하지 않았다.

## 검증

기준 소스 `2f95bc3`의 격리 worktree에서 코드 3개와 이 기록만 출시한다. 기존 dirty/untracked 파일 173개를 해시·상태로 보존하고 임시 QA 페이지를 제거했다.

- `npm ci --include=dev`: 잠금 파일 유지. `npm run lint`: 오류 0개, 기존 경고 16개. 공식 Next 타입 생성 후 일반 `npx tsc --noEmit` 통과.
- 기존 컵 결과·최종순위 테스트 14/14 통과. 실제 개발·운영 DB 카탈로그 검사 모두 실행되어 누락 0개.
- 정상 `vercel build --prod`의 prebuild에서 함수 44개·릴레이션 28개·버킷 1개와 컬럼 계약 370개·조회 103개를 대조하고 Next 빌드·54개 정적 페이지·배포 출력 생성까지 통과.
- 로컬 PC 1440px에서 선택 레일 우측·하단 20px, 재생 버튼 좌측·하단 20px 확인. 모바일 390px에서 선택 레일 왼쪽 64px 공간·우측/하단 12px, 재생 버튼 좌측 12px에서 정상 클릭을 확인했다. 768px 태블릿도 레일 왼쪽 84px와 재생 버튼 오른끝 64px가 겹치지 않으며 페이지 가로 넘침이 없다.
- Home·End 키의 선택·가로 이동, 클릭 후 PC 패널 상단 160px·모바일 144px, 기존 영상 비율·무음 자동재생을 확인했다. QA 브라우저의 유일한 콘솔 경고는 브라우저 도구가 주입한 `body ap-style`의 hydration 차이였다.

자동 Preview의 실제 DB 게이트와 Ready를 확인한 뒤 검증된 Production 빌드를 배포한다. 기존 GitHub Actions의 `SUPABASE_DB_URL` secret 누락은 별도 설정 문제로 기록하며 환경변수·DB·권한·의존성을 변경하거나 정상 빌드 게이트를 우회하지 않는다.
