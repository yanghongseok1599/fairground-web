# 25 — 공지사항 / 자유게시판 MVP 구현 리포트

## 작업 요약

- **브랜치**: `feat/supabase-migration`
- **기획안**: `_workspace/24_board-notices-plan.md` (정본 준수)
- **범위**: UI/스토어만. DB·RLS·types 재생성은 토대로 이미 완료된 상태에서 진행.
- **결과**: TS `src` 에러 0, `npm run build` Compiled successfully.

## 변경/신규 파일

### 수정 (5)
1. `src/types/index.ts` — `PostCategory`, `NoticeCategory`, `BoardPost`, `BoardComment`, `Notice` 타입 + `POST_CATEGORIES`, `NOTICE_CATEGORIES` 상수 추가.
2. `src/lib/mappers.ts` — Notice/BoardPost/BoardComment 매퍼 추가:
   - `rowToNotice`, `noticeToInsert`, `noticePatchToRow`
   - `rowToBoardPost`, `boardPostToInsert`, `boardPostPatchToRow`
   - `rowToBoardComment`, `boardCommentToInsert`
   - 입력 인터페이스: `NoticeInputCreate`, `BoardPostInputCreate`, `BoardCommentInputCreate`
   - `AuthorJoin` 헬퍼로 `profiles:author_id(name)` 조인 결과(객체/배열) 안전 처리.
3. `src/stores/dataStore.ts` — DataState 인터페이스 + 구현에 13개 메서드 추가 (공개 기존 시그니처 무파손).
4. `src/app/notices/page.tsx` — "준비 중" 스텁을 핀 우선 + 카테고리 필터 + 리스트 + 작성 CTA UI로 교체.
5. `src/app/board/page.tsx` — "준비 중" 스텁을 카테고리 필터 + 정렬 + 리스트 + 글쓰기 CTA UI로 교체.

### 신규 (7)
- `src/components/category-chip.tsx` — 공지/게시판 공용 카테고리 칩 (브랜드 블루 active, 흰 보더 비활성, 44px hit target).
- `src/components/notice-form.tsx` — 공지 작성/수정 폼 (제목/카테고리/본문/핀/중요, a11y 준수).
- `src/components/board-post-form.tsx` — 게시글 작성/수정 폼 (제목/카테고리/본문, a11y 준수).
- `src/app/notices/[id]/page.tsx` — 공지 상세 (admin/referee 본인 시 수정·삭제 버튼).
- `src/app/notices/new/page.tsx` — 공지 작성 (admin/referee 가드).
- `src/app/notices/[id]/edit/page.tsx` — 공지 수정 (admin/referee 가드).
- `src/app/board/[id]/page.tsx` — 게시글 상세 + 댓글 스레드 + 댓글 입력. StrictMode 이중 마운트 가드(`useRef`)로 `bump_post_view` 1회만 호출.
- `src/app/board/new/page.tsx` — 게시글 작성 (로그인 가드).
- `src/app/board/[id]/edit/page.tsx` — 게시글 수정 (본인 가드).

총 **신규 9 파일 + 수정 5 파일 = 14 파일 변경**.

## 신규 스토어 메서드 (`src/stores/dataStore.ts`)

```ts
// Notices (RLS: read 누구나, write is_referee_or_admin)
fetchNotices(opts?: { category?: string }): Promise<Notice[]>      // 핀 우선 + published_at 내림차순
fetchNotice(id): Promise<Notice | null>
createNotice(input: NoticeInputCreate): Promise<string>
updateNotice(id, patch: Partial<NoticeInputCreate>): Promise<void>
deleteNotice(id): Promise<void>

// Board posts (RLS: read 누구나, write 본인, delete 본인+admin)
fetchBoardPosts(opts?: { category?: PostCategory; sort?: "recent"|"comments" }): Promise<BoardPost[]>
fetchBoardPost(id, opts?: { bumpView?: boolean }): Promise<BoardPost | null>  // bumpView 시 rpc('bump_post_view') 호출
createBoardPost(input: BoardPostInputCreate): Promise<string>
updateBoardPost(id, patch): Promise<void>
deleteBoardPost(id): Promise<void>

// Board comments
fetchComments(postId): Promise<BoardComment[]>     // created_at 오름차순
addComment(postId, body, authorId): Promise<string>
deleteComment(commentId): Promise<void>
```

모든 read 메서드는 `profiles:author_id(name)` PostgREST 조인으로 작성자 이름을 같이 가져옴 → 별도 fetchPlayer 캐시 의존 없음.

데모 모드는 비활성 (Supabase 전용). 데모 환경에서 fetch는 빈 배열, write는 명시적 에러 throw.

## 페이지 · 폼 · 가드 위치

### 공지 (`/notices/*`)
| 라우트 | 파일 | 권한 가드 |
|--------|------|----------|
| `/notices` | `src/app/notices/page.tsx` | anon |
| `/notices/[id]` | `src/app/notices/[id]/page.tsx` | anon (관리 버튼은 admin/referee) |
| `/notices/new` | `src/app/notices/new/page.tsx` | 미로그인 → `/login?returnTo=...`, 로그인+player.role≠admin/referee → 권한 안내 |
| `/notices/[id]/edit` | `src/app/notices/[id]/edit/page.tsx` | 동일 |

### 자유게시판 (`/board/*`)
| 라우트 | 파일 | 권한 가드 |
|--------|------|----------|
| `/board` | `src/app/board/page.tsx` | anon |
| `/board/[id]` | `src/app/board/[id]/page.tsx` | anon 읽기, 댓글은 로그인 필요 (미로그인 시 로그인 CTA 박스), 본인/admin 시 글 삭제 버튼 |
| `/board/new` | `src/app/board/new/page.tsx` | 미로그인 → `/login?returnTo=/board/new` |
| `/board/[id]/edit` | `src/app/board/[id]/edit/page.tsx` | 미로그인 → 로그인, `post.authorId !== user.uid` → 권한 안내 |

### 폼 컴포넌트
- `NoticeForm` (공지): 제목 200자 / 본문 8000자 maxLength + 카운트, 핀·중요 토글, 카테고리 셀렉트, label htmlFor + aria-describedby, plain text only.
- `BoardPostForm` (게시글): 동일 패턴, 카테고리 enum 셀렉트(자유/매치후기/팁/모집/질문).
- 댓글 입력은 `/board/[id]/page.tsx`에 인라인 폼(2000자 maxLength + 카운트, 로그인 필요).

## 보안 · 디자인 원칙 준수

- **본문은 plain text 저장·렌더** — `whitespace-pre-line` CSS로 줄바꿈만 보존, HTML/markdown 미적용 → XSS 방지.
- **브랜드 토큰만 사용**: `var(--primary)` / `var(--color-fg-paper)` / `var(--color-fg-ink)` / `var(--color-fg-ink-muted)` / `var(--color-fg-line-soft)` / `var(--shadow-sm)` / `var(--color-fg-red)`. 하드코딩 컬러 없음.
- **카테고리 칩 일관성**: 단일 `CategoryChip` 컴포넌트로 active/inactive 통일 (active=`--primary`, inactive=`--color-fg-paper` + `--color-fg-line-soft` border).
- **모바일 반응형**: max-w-3xl/4xl, clamp() 폰트, flex-wrap 활용. 라이트 셸(`--color-fg-paper-2` 배경).
- **a11y**: form `<label htmlFor>`, `aria-describedby`로 카운트 안내, `role="radiogroup"`로 필터, `aria-pressed`, `<time dateTime>`, `aria-label`로 카운트 라벨, 44px 최소 hit area, focus-visible ring.

## 무회귀 영역 (변경 없음)

- 공개 라우트 prerender 보존: `/`, `/about`, `/standings`, `/live`, `/players`, `/teams`, `/tournaments` 전부 ○(Static).
- `dataStore`/`authStore` 기존 read/write 시그니처 100% 유지. 신규 메서드만 추가.
- DB 스키마 / RLS / RPC 미터치. 토대 마이그레이션 결과 그대로 사용.
- `player-card.tsx`, 기존 components/ui/* 변경 없음.

## 검증 결과

```
npx tsc --noEmit (src 에러)
  → 0
npm run build
  → ✓ Compiled successfully in 1893.2ms
  → next-sitemap 생성 완료
  → 공개 라우트 모두 prerender ○ 유지
```

신규 라우트 prerender 상태:
- ○ `/notices`, `/notices/new`, `/board`, `/board/new`
- ƒ `/notices/[id]`, `/notices/[id]/edit`, `/board/[id]`, `/board/[id]/edit`

## 후속 (MVP 외 — 기획안 ❌ 표시)
- 좋아요 · 신고 · 이미지 첨부(Storage) · markdown · 검색 · 무한스크롤 · 이전/다음 공지 네비.
- 본문 markdown 도입 시 `react-markdown` + `rehype-sanitize` 조합으로 XSS 방어선 유지.

## 완료 요약 (1줄)

**14 파일 변경 (신규 9 + 수정 5), TS src 에러 0, 빌드 통과, 공개 라우트 prerender 무회귀. 신규 라우트 8개 (`/notices` 4개 + `/board` 4개) 추가.**
