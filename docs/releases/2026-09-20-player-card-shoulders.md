# 선수카드 어깨 잘림·아라 표기 운영 반영 — 2026-09-20

[운영 사이트](https://fairground-kor.com)에 선수사진 가로 폭 맞춤과 ALA 한글 표기 ‘아라’를 반영했다. 사진 원본을 다시 등록할 필요 없이 공통 표시 컴포넌트에 적용된다. 사용자가 직접 확대한 사진은 배율에 따라 일부가 잘릴 수 있다.

- 구현 커밋: `5fe0b37`.
- 새 배포: `dpl_FrSzMcd8bW8MaKaEyFmHjWqFR3En`, `READY`.
- 배포 URL: https://fairground-nwxvn7lt2-milestones-projects-d52c4dda.vercel.app
- 직전 운영 배포: `dpl_HkjZvRX9YGvYMpc9GbSPEavH3YdA`.
- 복구 대상: https://fairground-128mntajo-milestones-projects-d52c4dda.vercel.app

## 범위와 검증

직전 운영 소스 897개를 파일별 SHA-1으로 검증해 시스템 임시 폴더에 복원했다. 구현 커밋의 공통 사진 스타일·등록/수정/마이페이지 표기·기존 회귀 테스트 수정만 패치했다. 작업 브랜치 전체나 미완료 작업은 배포하지 않았다.

업로드 소스 897개가 검증본과 모두 일치했다. 직전 운영과 달라진 것은 요청한 소스 4개, 테스트 1개, 타입 검사에서 생성한 `tsconfig.tsbuildinfo`뿐이다. 변경 해시는 [배포 명세](2026-09-20-player-card-shoulders-manifest.json)에 기록했다.

- 분리 배포본 린트 오류 0/기존 경고 18, TypeScript, Supabase 안전장치 테스트 4개 및 선수카드 관련 테스트 통과.
- Vercel `npm run build` 통과. 도메인 연결 전에 새 배포 `/about`의 HTTP 200 및 사진 맞춤 스타일을 확인했다.
- `vercel promote` 후 공식 도메인이 새 배포를 가리키고 `READY`임을 확인했다.
- 실제 운영 브라우저에서 카드 4개의 사진 좌우 잘림 0px, 상반신 하단 오차 0.00003px 미만을 확인했다.
- 운영 `/my/player-setup`, `/my/card-edit`, `/my` 응답이 모두 HTTP 200이며, 각 페이지의 배포된 JS에서 ‘아라’ 포함·‘알라’ 미포함을 확인했다.
- 실제 회원 사진 등록·수정·저장은 수행하지 않았다.
- 기존 의존성의 원격 설치 로그에 감사 경고 5건(낮음 1/보통 3/높음 1)이 있었다. 이번 배포는 의존성을 변경하지 않았다.

## 환경과 정리

Supabase 개발/운영 분리와 원격 마이그레이션 이력을 읽기 전용으로 확인했다. 기존 이력 불일치는 남아 있으며, 이번에는 DB·Auth·Storage·회원 데이터·마이그레이션을 변경하거나 새 백업을 생성하지 않았다.

새 DB 참조는 없다. 분리 배포본의 DB 참조 150개를 2026-09-15 운영에서 읽은 기존 카탈로그와 대조해 누락 0개를 확인했으며, 이번에 카탈로그 전체를 새로 조회한 것은 아니다. Vercel Production의 기존 `SUPABASE_DB_URL` 미설정 때문에 배포 명령 한 번에만 `--build-env FAIRGROUND_SKIP_DB_PARITY=1`을 전달했다. 프로젝트의 지속 환경변수와 게이트 코드는 변경하지 않았다.

검증 후 복원 소스·연결한 의존성 심볼릭 링크·임시 응답과 명세를 정리했다. 원래 작업 폴더의 사용자 변경과 기존 의존성은 보존했다.
