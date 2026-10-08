# 제1회 혼성풋살페스티벌 만족도 조사

참가자 페이지: `/survey`. 회원 로그인 없이 주신 12개 문항에 응답한다.
문항 1~10과 5번의 여섯 행은 필수, 문항 11~12는 선택이다.

## 수정 위치

- `model.ts`: 설문 제목·안내·문항·선택지, 타입과 공유 검증.
- `components/festival-survey.tsx`, `survey.module.css`: 페이지 구성·진행률·완료 화면.
- `components/survey-fields.tsx`, `survey-fields.module.css`: 입력 컴포넌트와 모바일 만족도 그리드.
- `use-survey.ts`: 탭 내 초안 보관, 제출, 연결 실패 후 동일 응답 재전송.
- `server.ts`, `src/app/api/survey/route.ts`: 익명 제출 API와 전용 RPC.
- `supabase/migrations/20261008010000_festival_survey.sql`: 응답 저장과 DB 검증.

## 익명성과 저장

별도 익명 클라이언트가 제출 전용 RPC `submit_festival_survey`를 호출한다.
이름·연락처·회원 ID·팀명·IP·사용자 에이전트는 응답 데이터에 저장하지 않는다.
답변에 직접 적은 내용은 그대로 저장되며, 호스팅 서비스의 기본 접근 로그와는 별개다.
`festival_survey_responses`에는 무작위 응답 UUID, 답변 JSON, 서버 제출 시각만 있다.
공개/회원/서비스 API 역할의 직접 조회·수정·삭제·삽입을 차단하고, 공개 조회 API는 두지 않는다.
운영자는 Supabase SQL Editor 등 DB 소유자 권한으로 응답을 확인할 수 있다.

```sql
select created_at, answers
from public.festival_survey_responses
order by created_at desc;
```

초안은 설문 전용 `sessionStorage` 키 `fairground-festival-survey-v1`로 현재 탭에만 보관한다.
전송 직전에 UUID와 정규화된 응답을 저장한다. 전송 결과가 불확실하면 입력을 잠시 잠그고
같은 답변·UUID로 재전송한다. 새로고침 후에도 이어서 확인할 수 있으며, DB는 중복 저장하지 않는다.
성공 영수증을 받은 뒤 초안과 전송 대기 답변을 지우고 완료 표시만 남긴다.
익명 응답이므로 참가자의 다른 기기까지 식별하거나 한 사람의 모든 중복 응답을 막지는 않는다.

공통 회원 기능·알림·설치 팝업은 이 페이지에서 시작하지 않으며, 실제 경기 기록 대기열은 건드리지 않는다.
설문 페이지는 검색 색인과 사이트맵에서 제외한다.

## 검증과 배포

```sh
node --experimental-strip-types --test tests/festival-survey.test.ts
node --test tests/festival-survey-api.test.mjs
# 별도 localhost DB에서만 실행; 테스트가 요구하는 환경변수는 파일 상단 참조
node --test tests/festival-survey-database.test.mjs
node scripts/survey/verify-migration.mjs
```

새 RPC를 사용하는 소스를 푸시하기 전 개발 DB에 검증된 단일 SQL을 반영한다.
운영 공개 전 운영 대상도 별도 백업·격리 복원·정의/권한 diff·역할 테스트를 통과해야 한다.
기존 마이그레이션 이력을 보존하며 linked `db push/reset/repair`나 DB 정합성 게이트 우회는 사용하지 않는다.
