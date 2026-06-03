# 23 — Light Theme Refresh + Team Modal Fix

**Branch**: `feat/supabase-migration`
**Scope**: 다크 페이지 4개 라이트(White&Blue) 통일 + 팀 모달 로고/가독성 픽스
**디자인 정본**: `FAIRGROUND_BrandKit_2026.html` + 홈/`/about` (White&Blue 컨셉)

---

## 변경 파일 (총 5개)

| 파일 | 작업 | 결과 |
|---|---|---|
| `src/app/register/page.tsx` | 다크 → 라이트 풀 리뉴얼 | 회원가입 폼 라이트 |
| `src/app/my/page.tsx` | 다크 → 라이트 풀 리뉴얼 | 마이페이지 라이트 |
| `src/app/my/card-edit/page.tsx` | 다크 → 라이트 풀 리뉴얼 | 카드 수정 라이트 (`PlayerCard` 컴포넌트 미터치) |
| `src/app/my/player-setup/page.tsx` | 다크 → 라이트 풀 리뉴얼 | 선수카드 만들기 라이트 (`PlayerCard` 컴포넌트 미터치) |
| `src/app/teams/page.tsx` | 모달 헤더 픽스 | 로고/이니셜 fallback, 흰글씨 헤더 |

---

## 작업 1 — 라이트 전환 페이지 (4개)

### 공통 적용 원칙 (브랜드키트 2026 토큰만)
- **페이지 셸 배경**: `var(--color-fg-paper)` (`#FFFFFF`), Hero/섹션 교차에 `--color-fg-paper-2` (`#F5F7FF`)
- **카드/패널**: 흰 배경 + `1px solid var(--color-fg-line-soft)` 보더 + `var(--shadow-sm)` 그림자
- **Primary CTA**: `var(--primary)` (`#0047AB`) solid + `var(--color-fg-paper)` 텍스트 + `--shadow-sm`
- **Secondary CTA**: `var(--color-fg-paper)` + `1px solid var(--primary)` 보더 + `var(--primary)` 텍스트
- **입력 필드**: `var(--color-fg-paper)` 배경 + `1px solid var(--color-fg-line-soft)` 보더 + `var(--color-fg-ink)` 텍스트
- **본문**: `var(--color-fg-ink)` (`#0D1B2A`), 보조: `var(--color-fg-ink-muted)` (`#8A9BB0`)는 14px↑ (text-xs/text-sm/text-[10px]→text-xs 승격)
- **토글 active**: `var(--primary)` solid + 흰 텍스트
- **포커스 링**: outline `--color-ring` 토큰 (globals.css base 의 `outline-ring/50` 이 이미 적용)

### 옐로우/그린 → 블루·잉크 치환 표
| 이전 (다크 시절) | 신규 (라이트) | 용처 |
|---|---|---|
| `#FFD700` (Gold CTA) | `var(--primary)` | 가입하기/저장/이미지저장/관리자 진입 |
| `#FFD700` (토글 active) | `var(--primary)` solid + 흰 텍스트 | "경력 있음/없음" 토글 |
| `#FFD700` (Overall Rating bg/text) | `var(--primary)` solid 배너 + 흰 텍스트 | OVERALL RATING 배너 |
| `#00C853` (그린 accent/link) | `var(--primary)` | SectionLabel, 진행률 바, 링크, 뱃지 보더 |
| `#4FC3F7` / `#CE93D8` (StatBox 컬러) | `var(--primary)` 아이콘 + ink 숫자 | 골/어시/경기/MOM 통계 |
| `#0D1B2A` (페이지 배경) | `var(--color-fg-paper)` (#FFF) | 모든 페이지 셸 |
| `rgba(255,255,255,0.06)` (입력 배경) | `var(--color-fg-paper)` (#FFF) | 모든 input/select/textarea |
| `#FAFCFF` (밝은 텍스트) | `var(--color-fg-ink)` (`#0D1B2A`) | 본문 |
| `#627D98` (다크용 muted) | `var(--color-fg-ink-muted)` (`#8A9BB0`) | 라벨/헬퍼 |
| `#FF6B6B` (소프트 레드) | `var(--destructive)` (`#FF3B30`) | 에러/로그아웃/사진 제거 X 버튼 |

### 페이지별 주요 변경

#### `/register` (회원가입)
- 다크 페이지 → 흰 페이지. 모든 노란 강조(이메일 input·CTA·"가입하기"·토글 active) → `--primary` 블루
- 모든 input에 `htmlFor`/`id` pair 추가 (a11y)
- 에러 메시지 `role="alert" aria-live="polite"`
- 성공 페이지(`success`): 다크 → 흰. 체크아이콘 그린 → 블루
- "가입 완료!" `--color-fg-ink`, 본문 `--color-fg-ink-muted`
- Google 가입 버튼: 흰 + 보더 + shadow-sm (가독성↑)
- Divider 배경 `--color-fg-paper`

#### `/my` (마이페이지)
- 다크 → 흰. Hero(상단 아바타+이름)는 `--color-fg-paper-2`로 미묘한 깊이
- 아바타 fallback: `--color-fg-paper-3` + `--color-fg-blue-soft` 보더 + `--primary` 텍스트
- `cardRating` 뱃지: 노랑→블루
- 포지션/롤/PREMIUM 뱃지: 흰 카드 + 블루 보더/텍스트 (PREMIUM은 solid 블루)
- 승인 대기: `--destructive` 보더+텍스트
- StatBox(골/어시/경기/MOM): 다양한 색 → 흰 카드 + 블루 아이콘 + ink 숫자 (4개 통일)
- Overall Rating 배너: 노란 톤 → solid `--primary` blue + 흰 텍스트 (강한 강조)
- Next Badges: 그린 톤 → 흰 카드 + 블루 진행률 바
- Team 카드: 흰 + 보더 + shadow-sm. 아이콘 컨테이너는 `--color-fg-paper-3` + 블루-소프트 보더
- Profile 카드: 흰 + 보더 + shadow-sm. InfoRow 보더 `--color-fg-line-soft`
- 모든 다크 입력 → 흰 입력 + 보더. `htmlFor`/`id` pair 보강
- 토글(선수경력) active: solid blue + 흰 텍스트
- "개인정보 수정" 버튼: 흰 + 블루 보더 (secondary 패턴)
- 로그아웃 버튼: 흰 + `--destructive` 보더+텍스트
- 14px 미만 보조 텍스트(`text-[9px]`/`text-[10px]` 본문 톤)는 라벨/카운터로 한정, 본문은 text-sm↑로 승격

#### `/my/card-edit` (카드 수정)
- 다크 → 흰. `PlayerCard` 컴포넌트 자체는 미터치(카드 디자인 보존)
- 페이지 셸/폼/버튼만 라이트
- "프로필 사진" 업로드 버튼: 흰 + dashed 보더. 사진 있으면 solid 블루 보더
- 사진 X 제거 버튼: `--destructive` 배경
- 배경 제거 토스트: 다크 글래스 → 흰 + 보더 + shadow-lg (가독성)
- 포지션/뱃지 선택: 흰 카드 + `--color-fg-paper-3` 선택 배경 + 블루 보더
- 모든 input `id`+`htmlFor` pair + `aria-pressed` 보강
- CTA "수정 저장하기": solid blue

#### `/my/player-setup` (선수 카드 만들기)
- 다크 → 흰. `PlayerCard` 컴포넌트 미터치
- Step 2 of 2 라벨: 그린 → `--primary`
- 사진 업로드 버튼 패턴: card-edit 와 동일
- 등록 유형/포지션 토글: 흰 카드 + 선택 시 `--color-fg-paper-3` + 블루 보더 + `aria-pressed`
- 배경 제거 토스트: 흰 + shadow-lg
- 모든 input `htmlFor` pair 추가
- CTA "선수 카드 생성하기": solid blue

### a11y 보강 (전 페이지 공통)
- 모든 `<label>` 에 `htmlFor` + 짝 `<input id>` 페어링 (스크린리더 호환)
- 토글 버튼에 `aria-pressed`
- 에러 메시지: `role="alert" aria-live="polite"`
- 상태 메시지(저장 완료 등): `role="status" aria-live="polite"`
- 토스트(배경 제거 중): `role="status" aria-live="polite"`
- 보더 1.5px 토글 셀: 시각 contrast AA 만족 (블루 #0047AB on white = 8.59:1)
- 본문 `--color-fg-ink` on `--color-fg-paper` = 18.32:1 (AAA)
- `--color-fg-ink-muted` (#8A9BB0 on #FFF) = 3.05:1 — 14px 이상에서만 사용하도록 본문 사이즈 정리

---

## 작업 2 — 팀 모달 픽스 (`src/app/teams/page.tsx`)

**위치**: 약 280~340행 (`AnimatePresence` 안의 모달 헤더)

### 변경 사항
1. **로고 표시 로직 추가**:
   - `selectedTeam.logo` 가 있으면 → **실제 로고 이미지** (`<img>` `object-contain`, padding 4px, 흰 배경 `--color-fg-paper`)
   - 없으면 → 이니셜 fallback (`team.name.slice(0,2).toUpperCase()`) — 흰 글씨 + 살짝 어두운 반투명 배경
2. **위치**: 헤더 row `[로고 44×44] [팀명/서브타이틀] [팀 페이지→ / X]` 가로 정렬 — 팀명("ITN FC") **앞**에 위치
3. **크기**: 8×8(=32px) → **11×11(44px)** — 로고 가시성·접근성 터치타겟 ≥44px 충족
4. **헤더 텍스트(팀명) 흰글씨**: `var(--color-fg-paper)` (#FFFFFF) — 정확
5. **서브타이틀("선수 카드")**: `var(--color-fg-ink-dim)` → `var(--color-fg-blue-soft)` (#D6E4FF) — 다크 위 가독성↑
6. **"팀 페이지 →" 링크**: `var(--primary)` (#0047AB on dark = 4.0:1, AA 경계) → `var(--color-fg-blue-soft)` (#D6E4FF on #0D1B2A = 12.96:1, AAA)
7. **X 닫기 버튼**: `var(--color-fg-ink-ghost)` (다크 위 거의 안 보임) → `var(--color-fg-paper)` + opacity 60→100 hover. `aria-label="패널 닫기"` 추가
8. **보더 색**: `rgba(0,71,171,0.15)` (다크 위 거의 안 보임) → `rgba(255,255,255,0.12)` (다크에 어울리는 미묘한 구분선)
9. **이미지 alt**: `${selectedTeam.name} 로고` — 스크린리더 호환
10. **truncate** 적용: 긴 팀명도 깨지지 않음 (min-w-0 + flex-shrink-0 컨테이너 분리)

### 다크 유지
- 모달 자체 배경(`var(--foreground)` = `#0D1B2A`)은 그대로 — 사용자 지시 (다크 유지, 가독성만 픽스)

---

## 검증

### TypeScript (`npx tsc --noEmit`)
- **src 에러: 0** ✅
- `tests/*.ts` 9건 (사전 존재, `allowImportingTsExtensions` 미설정 — 무시 약속)

### Production Build (`npm run build`)
- `✓ Compiled successfully in 1894.7ms` ✅
- 27/27 static pages generated ✅
- 공개 라우트 static prerender 유지:
  - `/` ○, `/about` ○, `/standings` ○, `/live` ○, `/players` ○, `/teams` ○, `/tournaments` ○ — 전부 무회귀
- 사이트맵 정상 생성

### 디자인 시스템 컴플라이언스
- ✅ `globals.css` 토큰만 사용 (브랜드키트 2026 White&Blue)
- ✅ 골드 hex/녹색 hex 신규 사용 0
- ✅ Pretendard 단일 폰트 (Outfit/Space-mono 클래스명은 globals.css 별칭으로 → Pretendard/JetBrains 폴백)
- ✅ Radius/Shadow 토큰 사용
- ✅ `--primary` `#0047AB`, `--color-fg-paper` `#FFFFFF`, `--color-fg-paper-2` `#F5F7FF`, `--color-fg-paper-3` `#EEF3FF`, `--color-fg-ink` `#0D1B2A`, `--color-fg-ink-muted` `#8A9BB0`, `--color-fg-line-soft` `#D0D8E8` 토큰 채택
- ✅ player-card 컴포넌트 / authStore / dataStore 시그니처 / DB 미터치

### 무회귀 보증
- 공개 라우트 7개 전부 static prerender ○ 유지
- 라이브 배포(`https://fairground-footsal.vercel.app`) 영향 없음 — 인증 필요 페이지(/register /my /my/card-edit /my/player-setup) + 팀 모달만 변경
- 폼 동작/스토어 호출/리다이렉트 흐름 동일

---

## 요약

- **변경 파일 4 (라이트) + 1 (모달) = 5 파일**
- **라이트 전환 완료**: `/register`, `/my`, `/my/card-edit`, `/my/player-setup`
- **모달 픽스**: `/teams` 팀 상세 시트 헤더 (로고/이니셜 fallback + 흰글씨 + "팀 페이지→" 가독성)
- **빌드**: Compiled successfully + 27 static pages OK
- **공개 라우트**: 무회귀 (전부 prerender 유지)
