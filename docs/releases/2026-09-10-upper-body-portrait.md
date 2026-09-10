# 상반신 사진 표시 — 2026-09-10

운영 배포 `dpl_4skGnUyZCTxuXYfdjQa9czKpNpwc` READY 및 `fairground-kor.com` 연결 확인. 구현 커밋 `95ffbf1`을 푸시했다. 배포 아티팩트 881개가 분리 배포 소스와 일치하며 누락 0개다. 실제 html2canvas 저장용 캡처도 상반신으로 생성되는 것을 브라우저에서 확인했다.

- 생성·저장된 원본 사진과 얼굴 합성은 변경하지 않는다. 기존 사진도 재등록 없이 표시가 바뀐다.
- 사진 등록/편집 미리보기와 모든 PlayerCard(공유 캡처 포함)에 같은 UpperBodyPortrait를 적용했다.
- 위쪽 72%를 먼저 표시 영역으로 자른 후 기존 확대·축소를 적용한다. 축소해도 원본 반바지/하단이 다시 나타나지 않으며 머리를 위에 고정한다. 모든 임의 전신 사진의 허리 위치를 자동 인식하는 기능은 아니다.
- 비율/위치 규칙은 src/lib/player-card/upper-body-portrait.ts, 렌더링은 src/components/upper-body-portrait.tsx로 분리했다.
- [Lazyweb의 인물 크롭 참고](https://www.lazyweb.com/agentic-search/078f64ad-7b57-427e-84af-1f2ea55a69e5)를 확인하고 원본 보존·미리보기 일관성에 적용했다.
- 메인: 린트 오류 0, TypeScript, 상반신 스타일 테스트, 카드 테스트 4종, 사진 읽기 예외 11개 및 빌드 통과.
- 분리 배포 소스: 린트 오류 0, TypeScript, 상반신 스타일 테스트, 사진 읽기 예외 11개, Supabase 안전장치 4개, 운영 공개 환경변수를 사용한 빌드 통과.
- 브라우저에서 남녀 준타스 기존 합성 파일을 상반신 미리보기/70점 브론즈 카드로 표시해 머리 보존과 반바지 제외를 확인했다. 실물 iPhone Safari와 실제 회원 데이터 저장은 이번에도 테스트하지 않았다.
- 운영 기준 dpl_9hJCeFJYmtBaxfFAFQ1kkmE2CHKQ에서 세 화면/컴포넌트만 수정하고 공유 컴포넌트·스타일·테스트를 추가했다. 생성된 타입 캐시 외에 다른 기존 기능 소스는 변경하지 않았다.
- 운영 카탈로그를 SELECT로 새로 확인했다. 분리 배포 소스의 함수 35개·릴레이션 27개·버킷 1개 누락 0. DB/마이그레이션 이력/사진 파일은 수정하지 않는다.
- Vercel SUPABASE_DB_URL 미설정은 기존 제약이다. 확인한 배포 명령 한 번에만 FAIRGROUND_SKIP_DB_PARITY=1을 사용하며 영구 설정은 바꾸지 않는다. 메인 전체 배포와 미배포 register_team 변경은 포함하지 않는다.
