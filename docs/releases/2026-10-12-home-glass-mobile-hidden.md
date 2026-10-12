# 모바일 히어로 글래스 버튼 숨김

모바일에서 결과 선택 버튼이 영상을 가리지 않도록 768px 미만에서는 홈 글래스 버튼 레일을 숨겼다. `home-results-navigation.module.css`의 기본 `.overlay`를 `display: none`으로 바꾸고 기존 768px 이상 media query에서 `display: flex`를 복원했다. 수정은 CSS 두 선언뿐이다.

PC 버튼 스타일과 동작, 영상·재생 버튼, 영상 아래 대회 결과 패널은 유지한다. DB·환경변수·권한·미디어·의존성을 변경하지 않는다. 기존 [Rimini Wellness 화면](https://www.riminiwellness.com/en)과 [Lazyweb 근거](https://www.lazyweb.com/agentic-search/fcb156a7-5a74-441a-8b93-0b6da0939e33)를 재사용했다.

## 검증

기준 소스 `35f8859`의 격리 worktree에서 CSS 한 파일과 이 기록만 출시한다. 공유 작업의 dirty/untracked 138개 경로를 해시로 기록하고, fast-forward 전후 staged diff와 working 파일을 보존한다. 푸시와 운영 승격 직전에 primary·실제 원격 HEAD를 확인하여 다른 최신 커밋을 보존한다.

- `npm ci --include=dev` 후 잠금 파일과 추적 AGENTS 내용 유지. Lint 오류 0개·기존 경고 16개, 일반 `npx tsc --noEmit`, 기존 컵/순위 테스트 14/14 통과.
- safety/migrations 읽기 전용 확인과 개발·운영 실제 카탈로그 검사 통과. 정상 `vercel build --prod`의 DB/컬럼 게이트·제안서 미디어 52개 추적 검사·정적 페이지 56개·배포 출력 생성까지 통과.
- 실제 운영 DOM에 같은 표시 규칙을 임시 적용한 사전 검수: 390/767px 버튼 0개, 768/1440px 버튼 6개. 모든 폭에서 결과 패널 상단과 영상 하단이 일치하며 빈 공간·레이아웃 이동·가로 넘침이 없다.
- 개발 서버·임시 QA 페이지·새 테스트를 만들지 않았다. 배포 후 실제 CSS를 새로고침해 모바일·PC를 최종 확인한다.

자동 Preview의 실제 DB 게이트와 Ready를 확인한 뒤 정상 게이트를 통과한 Production 빌드를 배포한다. 기존 GitHub Actions의 DB secret 누락은 별도 설정 문제로 기록하며 정상 빌드 게이트를 우회하지 않는다.
