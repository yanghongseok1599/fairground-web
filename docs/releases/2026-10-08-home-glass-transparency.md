# 홈 글래스 버튼 투명도 조정

홈 결과 선택 버튼의 배경이 영상을 더 잘 비추도록 일반 상태의 불투명도를 78/76%에서 24/36%로, 선택 상태를 97/92%에서 68/52%로 줄였다. 배경 흐림은 18px에서 10px로 줄이고 hover 배경은 48%로 조정했다. 글자 그림자·테두리·선택 글자색을 보완해 실사 장면과 밝은 배경에서 글자와 선택 상태를 구분할 수 있게 했다.

수정은 `src/features/cup-results/home-results-navigation.module.css` 한 파일에 한정한다. 버튼의 영상 우측하단 배치·가로 이동·상단 sticky·키보드 탐색·영상 재생·결과 집계와 투명도 감소/필터 미지원 fallback은 유지한다. DB·환경변수·권한·미디어·의존성을 변경하지 않는다.

[Rimini Wellness 홈페이지](https://www.riminiwellness.com/en)와 [기존 Lazyweb 화면 근거](https://www.lazyweb.com/agentic-search/fcb156a7-5a74-441a-8b93-0b6da0939e33)를 재사용했다. 추가 조회는 HTTP 429로 제한되어 새 검색 근거를 사용하지 않았다.

## 검증

다른 사용자 작업의 최신 커밋 `87ad230`을 포함한 격리 소스에서 검증한다. CSS와 이 기록만 공유 primary에 반영하고 동시 작업의 dirty 파일을 출시에서 제외한다. cherry-pick·푸시 및 운영 승격 직전에 primary와 실제 원격 branch HEAD를 대조해 오래된 소스로 최신 배포를 덮지 않게 한다.

- `npm ci --include=dev`: 잠금 파일 유지. 추적 `AGENTS.md` 내용 유지. `npm run lint`: 오류 0개, 기존 경고 16개. 공식 Next 타입 생성 후 일반 `npx tsc --noEmit` 통과.
- 정상 `vercel build --prod`의 prebuild에서 컬럼 계약 370개·조회 103개를 실제 운영 카탈로그와 대조하고 Next 빌드·55개 정적 페이지·배포 출력 생성까지 통과.
- 기존 컵 결과·최종순위 테스트 14/14 통과. 최신 설문 기능을 포함한 소스 461개·RPC 45개 기준으로 실제 개발·운영 DB 카탈로그 검사 모두 실행되어 누락 0개.
- 실제 운영 DOM에 같은 CSS를 임시 적용해 PC 1440px의 실사 2.7초·흰 배경 0.3초 장면 및 모바일 390px에서 영상 비침·글자 읽힘·선택 구분을 확인했다. 개발 서버나 임시 QA 페이지를 만들지 않았다.

자동 Preview의 실제 DB 게이트와 Ready를 확인한 뒤 검증된 Production 빌드를 배포한다. 기존 GitHub Actions의 `SUPABASE_DB_URL` secret 누락은 별도 설정 문제로 기록하며 정상 빌드 게이트를 우회하지 않는다. 운영 배포 후 실제 코드의 PC·모바일 화면을 최종 검수한다.
