# 컵 운영 가이드 공식 도메인 연결

공유 주소: https://fairground-kor.com/cup-ops

ChatGPT Sites에 있던 운영 가이드를 공식 도메인의 독립 정적 페이지로 옮겼다. 시간표, 경기 방식, 역할 분담과 선수 이미지가 포함된 승급 카드가 그대로 표시된다. 선수 이미지의 머리 위 여백 수정도 유지했다. 별도 로그인 없이 주소를 공유할 수 있다.

## 변경과 배포

- 구현 커밋: `25ea349` — 컵 운영 가이드 공식 도메인 연결 1차 완성.
- 배포: `dpl_Dgwsh7dNvefj2Yrj9xFJf1gps8Sc` (`READY`).
- 배포 URL: https://fairground-c6i0i6uzl-milestones-projects-d52c4dda.vercel.app
- 이전 운영/복구 대상: `dpl_2T6oV8MoQAUq66unvaYHSrtMnCCr`, https://fairground-55xv2bdce-milestones-projects-d52c4dda.vercel.app
- 관리 위치: `public/cup-ops/`. 수정 안내는 [cup-ops.md](../cup-ops.md).

직전 운영 소스 938개를 SHA-1 검증해 시스템 임시 폴더에 복원했다. 기존 파일 변경은 `next.config.ts`의 `/cup-ops` rewrite와 `next-sitemap.config.js`의 검색 제외 설정뿐이다. 가이드 13개 파일과 관리 문서를 추가했으며, 기존 `src/`, 의존성, 잠금 파일은 동일하다. 작업 브랜치의 다른 변경은 운영에 포함하지 않았다.

업로드 소스 953개의 해시를 모두 확인했고 누락·불일치는 없다. CLI가 생성한 `supabase/.temp/cli-latest` 버전 캐시 1개도 업로드에 포함됐으며 서비스 동작이나 자격증명과 무관하다. [파일 매니페스트](2026-09-23-cup-ops-domain-manifest.json)에 변경과 해시를 기록했다.

## 검증

- 격리한 운영 소스의 전체 lint 오류 0, 기존 경고 18; TypeScript 통과.
- 가이드 JavaScript 구문, Git diff 검사와 Supabase 안전장치 테스트 4개 통과.
- Vercel `npm run build` 성공.
- 후보 `/cup-ops` HTTP 200 및 HTML 원본 바이트 일치 확인 후 promote.
- 공식 도메인의 `/cup-ops`와 나머지 가이드 파일 12개를 인증 없이 조회해 HTTP 200 및 원본 바이트 일치 확인. 홈페이지도 HTTP 200.
- 공식 도메인 alias가 새 배포와 일치함을 확인.
- 390px 모바일 브라우저에서 선수 이미지 3개 표시, 하위 경로 자산 로딩과 가로 넘침 없음 확인.
- HTML의 `noindex, nofollow`와 공식 canonical 주소 유지. 운영 `robots.txt`는 기존 정적 파일을 반환하며 추가 disallow 문구는 반영되지 않았다. HTML의 검색 제외 지시는 정상 제공된다.

## 환경

개발·운영 분리와 마이그레이션 이력을 읽기 전용으로 확인했다. 새 DB 참조는 없다. 현재 운영 카탈로그를 SELECT로 조회해 배포본의 함수 35개·릴레이션 27개·버킷 1개가 모두 존재함을 확인했다. 기존 Production의 `SUPABASE_DB_URL` 미설정을 보완하기 위해, 이 검증 후 이번 배포 명령에만 `FAIRGROUND_SKIP_DB_PARITY=1`을 전달했다. 영구 환경변수와 검사 코드는 바꾸지 않았다.

운영 웹 배포는 변경했다. Supabase 데이터·스키마·Auth·Storage·마이그레이션 이력은 변경하지 않았다. 검증용 서버·브라우저 공간과 복원한 임시 소스·렌더 파일은 작업 완료 후 정리한다.
