"use client";

import { Suspense, useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, MessageSquare, Eye } from "lucide-react";
import { useDataStore } from "@/stores/dataStore";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { CategoryChip } from "@/components/category-chip";
import { AuthorRoleBadge } from "@/components/author-role-badge";
import { POST_CATEGORIES, type BoardPost, type PostCategory } from "@/types";
import { formatDate } from "@/utils/formatters";

type Filter = "전체" | PostCategory;
const FILTERS: readonly Filter[] = ["전체", ...POST_CATEGORIES] as const;

type Sort = "recent" | "comments";

function isFilter(v: string | null): v is Filter {
  return !!v && (FILTERS as readonly string[]).includes(v);
}

// useSearchParams 는 Suspense 경계가 필요 (Next.js App Router CSR bail-out 규칙).
export default function BoardPage() {
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <BoardPageInner />
    </Suspense>
  );
}

function BoardSkeleton() {
  return (
    <div
      className="pt-[60px] min-h-screen flex items-center justify-center text-sm"
      style={{ background: "var(--color-fg-paper-2)", color: "var(--color-fg-ink-muted)" }}
    >
      불러오는 중…
    </div>
  );
}

function BoardPageInner() {
  const fetchBoardPosts = useDataStore((s) => s.fetchBoardPosts);
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL ?cat=... 을 단일 소스로 사용 (state 미러링은 동기화 비용만 추가됨).
  const catParam = searchParams.get("cat");
  const filter: Filter = isFilter(catParam) ? catParam : "전체";

  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [sort, setSort] = useState<Sort>("recent");
  const [loading, setLoading] = useState(true);

  const setFilter = useCallback(
    (next: Filter) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "전체") {
        params.delete("cat");
      } else {
        params.set("cat", next);
      }
      const qs = params.toString();
      router.push(qs ? `/board?${qs}` : "/board", { scroll: false });
    },
    [router, searchParams],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    const category = filter === "전체" ? undefined : filter;
    void fetchBoardPosts({ category, sort }).then((list) => {
      if (active) {
        setPosts(list);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [fetchBoardPosts, filter, sort]);

  const writeHref = user ? "/board/new" : `/login?returnTo=${encodeURIComponent("/board/new")}`;

  const sortLabel = useMemo(
    () => (sort === "recent" ? "최신순" : "댓글많은순"),
    [sort],
  );

  return (
    <div className="pt-[60px] min-h-screen" style={{ background: "var(--color-fg-paper-2)" }}>
      {/* Header */}
      <header className="px-5 md:px-10 pt-12 pb-8" style={{ background: "var(--color-fg-paper)" }}>
        <div className="max-w-4xl mx-auto">
          <p className="fg-label mb-3" style={{ color: "var(--primary)" }}>
            FREE BOARD
          </p>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1
                className="font-black leading-none"
                style={{
                  fontSize: "clamp(32px, 5vw, 48px)",
                  letterSpacing: "-1.5px",
                  color: "var(--color-fg-ink)",
                }}
              >
                자유게시판
              </h1>
              <p className="mt-3 text-sm" style={{ color: "var(--color-fg-ink-muted)" }}>
                리그 참가자 누구나 자유롭게 소통하는 공간입니다
              </p>
            </div>
            <Link href={writeHref}>
              <Button className="min-h-[44px]" style={{ background: "var(--primary)", color: "#fff" }}>
                <Plus className="w-4 h-4" />
                글쓰기
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Filter chips + sort */}
      <div
        className="px-5 md:px-10 py-5"
        style={{ background: "var(--color-fg-paper)", borderTop: "1px solid var(--color-fg-line-soft)" }}
      >
        <div className="max-w-4xl mx-auto flex gap-3 items-center justify-between flex-wrap">
          <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label="카테고리 필터">
            {FILTERS.map((f) => (
              <CategoryChip
                key={f}
                label={f}
                active={filter === f}
                onClick={() => setFilter(f)}
                role="radio"
                ariaPressed={filter === f}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="board-sort" className="sr-only">
              정렬
            </label>
            <select
              id="board-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="h-9 px-3 rounded-md text-xs font-semibold focus-visible:outline-none focus-visible:ring-2"
              style={{
                background: "var(--color-fg-paper)",
                color: "var(--color-fg-ink)",
                border: "1px solid var(--color-fg-line-soft)",
                ['--tw-ring-color' as string]: "var(--primary)",
              }}
              aria-label={`정렬: ${sortLabel}`}
            >
              <option value="recent">최신순</option>
              <option value="comments">댓글많은순</option>
            </select>
          </div>
        </div>
      </div>

      {/* List */}
      <main className="px-5 md:px-10 py-10">
        <div className="max-w-4xl mx-auto">
          {loading ? (
            <div className="py-16 text-center text-sm" style={{ color: "var(--color-fg-ink-muted)" }}>
              불러오는 중…
            </div>
          ) : posts.length === 0 ? (
            <div
              className="py-16 text-center rounded-xl"
              style={{ background: "var(--color-fg-paper)", border: "1px solid var(--color-fg-line-soft)" }}
            >
              <p className="text-sm font-semibold mb-1" style={{ color: "var(--color-fg-ink)" }}>
                아직 게시글이 없습니다
              </p>
              <p className="text-xs" style={{ color: "var(--color-fg-ink-muted)" }}>
                첫 글의 주인공이 되어보세요!
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {posts.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/board/${p.id}`}
                    className="block rounded-xl px-5 py-4 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2"
                    style={{
                      background: "var(--color-fg-paper)",
                      border: "1px solid var(--color-fg-line-soft)",
                      boxShadow: "var(--shadow-sm)",
                      ['--tw-ring-color' as string]: "var(--primary)",
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <CategoryChip label={p.category} />
                    </div>
                    <h2
                      className="font-bold text-base leading-snug mb-2"
                      style={{ color: "var(--color-fg-ink)" }}
                    >
                      {p.title}
                    </h2>
                    <div
                      className="flex items-center gap-3 text-xs flex-wrap"
                      style={{ color: "var(--color-fg-ink-muted)" }}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {p.authorName ?? "익명"}
                        <AuthorRoleBadge role={p.authorRole} />
                      </span>
                      <span aria-hidden="true">·</span>
                      <time dateTime={new Date(p.createdAt).toISOString()}>{formatDate(p.createdAt)}</time>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1" aria-label={`댓글 ${p.commentCount}개`}>
                        <MessageSquare className="w-3.5 h-3.5" />
                        {p.commentCount}
                      </span>
                      <span className="inline-flex items-center gap-1" aria-label={`조회수 ${p.viewCount}`}>
                        <Eye className="w-3.5 h-3.5" />
                        {p.viewCount}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
