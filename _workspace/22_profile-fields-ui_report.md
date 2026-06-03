# 22 · 선수 프로필 신규 필드 UI 결선 리포트

작업 디렉토리: `/Users/seok/footsal project/fairground-web` (브랜치 `feat/supabase-migration`)
원칙: 공개 라우트 무회귀 · player-card / store 시그니처 / DB / 인증 미터치 · 색은 토큰만(기존 hex 코드 패턴 유지)

## 변경 파일

| # | 파일 | 변경 요지 |
|---|---|---|
| 1 | `src/app/register/page.tsx` | MBTI · 성향 · 가치관 + (FA 한정) 자기소개 폼 컨트롤 / `register()` 후 `updatePlayer()` 후속 저장 |
| 2 | `src/app/my/page.tsx` | 프로필 편집 모드 4필드 추가 + 디스플레이 모드 칩/가치관 노출 + "About Me" 섹션(bio) |
| 3 | `src/app/players/[id]/page.tsx` | 공개 선수 페이지 하단에 MBTI/성향 칩 + 가치관 카드 + 자기소개 카드(있는 것만) |

총 3 파일 변경 (+698, −236)

## 신규 컨트롤 사양

### `register/page.tsx`
- 위치: "선수 경력 여부" 블록 ↓, "비밀번호" 블록 ↑ — 가입 흐름 자연스러운 자리.
- 필드:
  1. **MBTI** `<select id="register-mbti">` — 첫 옵션 "선택 안 함", 이후 16종(`INTJ … ESFP`).
  2. **성향** `<input id="register-disposition" type="text" maxLength=200>` — placeholder "예: 적극적 / 분석적 / 협동적", helper에 글자수 카운트, `aria-describedby="register-disposition-help"`.
  3. **추구하는 가치관** `<textarea id="register-values" rows=3 maxLength=500>` — placeholder "내가 그라운드에서 중요하게 여기는 것", `aria-describedby`로 카운트 연결.
  4. **자기소개 (FA)** `<textarea id="register-bio" rows=5 maxLength=2000>` — `isFreeAgent = !invitedTeamId` 일 때만 렌더, placeholder "내 플레이 스타일·강점·연락처 등을 자유롭게 — 팀 영입 안내에 사용됩니다".
- a11y: 모든 신규 컨트롤이 `<label htmlFor>` 와 매칭, maxLength 안내는 `aria-describedby` 로 연결.
- 모바일 반응형: 기존 `space-y-4` 폼 흐름과 동일 — `max-w-sm` 카드형 레이아웃 유지.

### `my/page.tsx`
- 편집 모드(`editingProfile`) 폼: 기존 hasPlayerExperience 토글 ↓ 에 동일 4필드 추가. MBTI 드롭다운 / 성향 1줄 / 가치관 3줄 / 자기소개 5줄 — register 와 동일한 컨트롤 구성·문구·a11y(`htmlFor` + `aria-describedby` 카운터).
- 디스플레이 모드:
  - 기존 InfoRow 리스트 끝(국적 ↓)에 `mbti || disposition || personalValues` 있을 때만 칩 + 가치관 본문 블록 노출.
    - 칩 디자인: 기존 Hero 영역 포지션 칩과 동일한 토큰(파스텔 청록 `rgba(79,195,247,*)`·그린 `rgba(0,200,83,*)`).
    - 가치관: 라벨 "가치관" + `whitespace-pre-wrap` 본문.
  - "About Me" 별도 섹션: `player.bio` 있을 때만 Team+Profile row ↓ 에 풀폭 카드로 노출 (`SectionLabel text="About Me"`).
- `profileForm` 초기화 / 취소 / 저장 핸들러에 mbti·disposition·personalValues·bio 모두 반영. 빈 문자열은 `undefined` 로 보내 mapper 의 null 처리 경로(`playerPatchToRow`) 사용.

### `players/[id]/page.tsx`
- 본인용 "카드 수정" 버튼 ↓ 에 `max-w-[560px]` 의 보강 영역 — `player.mbti || disposition || personalValues || bio` 중 하나라도 있을 때만 렌더.
- MBTI/성향 칩 + 가치관 카드 + About Me 카드 — 모두 각각 값이 있는 것만 노출. 없으면 전체 영역 미렌더(공개 라우트 무회귀).

## 저장 동작

### Register 직후 후속 저장 — store 시그니처 비변경
```ts
await register({...기존 필드});           // 1차 가입(저장된 필드 그대로)
const extraUpdate: Record<string, string | undefined> = {};
if (mbti.trim())            extraUpdate.mbti           = mbti.trim();
if (disposition.trim())     extraUpdate.disposition    = disposition.trim();
if (personalValues.trim())  extraUpdate.personalValues = personalValues.trim();
if (isFreeAgent && bio.trim()) extraUpdate.bio         = bio.trim();
if (Object.keys(extraUpdate).length > 0) {
  try { await updatePlayer(extraUpdate); }
  catch (err) { console.warn("[register] optional profile fields update skipped:", err); }
}
```
- 가입 자체와 분리 try — 후속 저장 실패가 가입 결과(승인 대기)를 막지 않음. 마이페이지에서 재시도 가능.
- `useAuth` 가 이미 `updatePlayer = store.updatePlayer` 를 export 하므로 시그니처 영향 0.
- `RegisterData` / `authStore` / `dataStore` / `register()` 본체는 그대로.

### My page 저장
- 기존 `handleProfileSave` 의 `updatePlayer({...})` 호출에 `mbti / disposition / personalValues / bio` 를 trim 후 빈문자열은 `undefined` 로 추가. mapper(`playerPatchToRow`)가 `undefined → null` 로 처리해 컬럼을 비울 수 있게 함.

### FA 분기 동작
- `register` 페이지: `isFreeAgent = !invitedTeamId` 일 때만 자기소개(bio) 필드 노출 — 팀 초대코드(`?teamId=`)로 들어온 가입은 bio 입력 미노출(요구사항).
- `my` 페이지: FA/팀 소속 구분 없이 모든 사용자가 bio 편집 가능(요구사항: "디스플레이 모드에서 bio 있으면 노출").

## 검증 결과

| 항목 | 명령 | 결과 |
|---|---|---|
| 타입 체크 (src) | `npx tsc --noEmit` | `src/` 에러 0 |
| 빌드 | `npm run build` | `✓ Compiled successfully in 2.5s` — 모든 정적/동적 라우트 정상 생성 |

공개 라우트(`/`, `/about`, `/standings`, `/live`, `/players`, `/teams`, `/tournaments`)는 변경된 컴포넌트 트리에 포함되지 않으며(`/players/[id]` 만 변경), 그 페이지도 신규 필드가 비어있을 때 전체 보강 블록을 미렌더해 무회귀.

## 미세 노트
- player-card 시각/스토어 시그니처/DB/인증 미터치 — 토대(컬럼·매퍼·타입)를 그대로 사용.
- 색은 기존 파일의 hex/rgba 토큰 패턴을 일관 적용(브랜드 hex 신규 도입 없음).
- 모바일 반응형: 모든 신규 컨트롤이 기존 `space-y-*` 흐름·`grid-cols-2`/풀폭과 정렬 — 별도 미디어 쿼리 불요.
- 글자수 카운터는 실시간 표기(`{x.length}/N`) — UX 명료.
