"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MessageSquare, Eye, Plus, X } from "lucide-react";
import { useDataStore } from "@/stores/dataStore";
import { useAuth } from "@/hooks/useAuth";
import { canPostInTeamBoard } from "@/lib/team-permissions";
import { Button } from "@/components/ui/button";
import { CategoryChip } from "@/components/category-chip";
import { BoardPostForm } from "@/components/board-post-form";
import { AuthorRoleBadge } from "@/components/author-role-badge";
import { POST_CATEGORIES, type BoardPost, type PostCategory, type Team } from "@/types";
import { formatDate } from "@/utils/formatters";
import { mentionedUserIds } from "@/lib/mention-parser";

type Filter = "전체" | PostCategory;
const FILTERS: readonly Filter[] = ["전체", ...POST_CATEGORIES] as const;
type Sort = "recent" | "comments";

/**
 * 팀 자유게시판.
 *
 * 읽기: 누구나 (RLS select using(true))
 * 쓰기: 로그인 회원 + 본인이 해당 팀 멤버여야 함 (board_posts.team_id 와 player.team_id 일치)
 *       RLS: author_id = auth.uid() AND (team_id IS NULL OR 본인이 그 팀 멤버)
 *
 * 라우트는 기존 /teams/[id]/chat 을 그대로 사용한다(팀 메인의 모듈카드 링크 유지).
 */
export default function TeamBoardPage() {
  const { id: teamId } = useParams<{ id: string }>();
  const fetchTeam = useDataStore((s) => s.fetchTeam);
  const fetchBoardPosts = useDataStore((s) => s.fetchBoardPosts);
  const createBoardPost = useDataStore((s) => s.createBoardPost);
  const notifyMentions = useDataStore((s) => s.notifyMentions);
  const { user, player } = useAuth();

  const [team, setTeam] = useState<Team | null>(null);
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [filter, setFilter] = useState<Filter>("전체");
  const [sort, setSort] = useState<Sort>("recent");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchTeam(teamId).then((t) => {
      if (active) setTeam(t);
    });
    return () => {
      active = false;
    };
  }, [fetchTeam, teamId]);

  const reload = async () => {
    setLoading(true);
    const category = filter === "전체" ? undefined : filter;
    const list = await fetchBoardPosts({ category, sort, teamId });
    setPosts(list);
    setLoading(false);
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, filter, sort]);

  // 클라 UX 가드 — lib/team-permissions로 통일. 최종 강제는 RLS.
  const canWrite = useMemo(
    () => Boolean(user) && canPostInTeamBoard(player, teamId),
    [user, player, teamId],
  );

  const sortLabel = useMemo(() => (sort === "recent" ? "최신순" : "댓글많은순"), [sort]);

  return (
    <div className="pt-[60px] min-h-screen" style={{ background: "var(--color-fg-paper-2)" }}>
      {/* Header — text-led counterpart to the visual-led gallery header.
          Same hierarchy depth, intentionally different visual identity:
          MessageSquare mark + posts/authors stats on the right. */}
      <header className="px-5 md:px-10 pt-10 pb-7" style={{ background: "var(--color-fg-paper)" }}>
        <div className="max-w-4xl mx-auto">
          <Link
            href={`/teams/${teamId}`}
            className="inline-flex items-center gap-1 text-sm font-medium mb-5"
            style={{ color: "var(--primary)" }}
          >
            <ArrowLeft className="w-4 h-4" /> 팀 홈
          </Link>
          <div
            className="flex flex-col gap-5 border p-6 md:flex-row md:items-end md:justify-between md:p-7"
            style={{
              background: "rgba(255,255,255,0.94)",
              borderColor: "rgba(0,71,171,0.16)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div className="flex items-start gap-4">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center border"
                style={{
                  background: "rgba(0,71,171,0.06)",
                  borderColor: "rgba(0,71,171,0.18)",
                  color: "var(--primary)",
                }}
              >
                <MessageSquare className="h-6 w-6" />
              </div>
              <div>
                <p
                  className="fg-label text-[10px]"
                  style={{ color: "var(--primary)" }}
                >
                  TEAM BOARD
                </p>
                <h1
                  className="fg-display mt-1 font-black leading-none"
                  style={{
                    fontSize: "clamp(22px, 4vw, 32px)",
                    letterSpacing: "-0.6px",
                    color: "var(--color-fg-ink)",
                  }}
                >
                  {team?.name ? `${team.name} 게시판` : "팀 게시판"}
                </h1>
                <p
                  className="mt-2 text-sm"
                  style={{ color: "var(--color-fg-ink-muted)" }}
                >
                  팀 멤버들이 자유롭게 소통하는 공간입니다.
                </p>
              </div>
            </div>
            <div className="flex items-end gap-4 md:gap-6">
              <div>
                <div className="fg-mono text-[10px]" style={{ color: "var(--color-fg-ink-muted)" }}>
                  POSTS
                </div>
                <div className="fg-display text-2xl font-black tabular-nums md:text-3xl" style={{ color: "var(--color-fg-ink)" }}>
                  {posts.length}
                </div>
              </div>
              <div>
                <div className="fg-mono text-[10px]" style={{ color: "var(--color-fg-ink-muted)" }}>
                  AUTHORS
                </div>
                <div className="fg-display text-2xl font-black tabular-nums md:text-3xl" style={{ color: "var(--color-fg-ink)" }}>
                  {new Set(posts.map((p) => p.authorId).filter(Boolean)).size || "-"}
                </div>
              </div>
              {!showForm && (
                <Button
                  className="min-h-[44px]"
                  style={{ background: "var(--primary)", color: "#fff" }}
                  onClick={() => {
                    if (!user) {
                      window.location.href = `/login?returnTo=${encodeURIComponent(`/teams/${teamId}/chat`)}`;
                      return;
                    }
                    if (!canWrite) {
                      alert("이 팀의 멤버만 글을 작성할 수 있습니다.");
                      return;
                    }
                    setShowForm(true);
                  }}
                >
                  <Plus className="w-4 h-4" />
                  글쓰기
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Filter chips + sort */}
      <div
        className="px-5 md:px-10 py-5"
        style={{
          background: "var(--color-fg-paper)",
          borderTop: "1px solid var(--color-fg-line-soft)",
        }}
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
            <label htmlFor="team-board-sort" className="sr-only">
              정렬
            </label>
            <select
              id="team-board-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="h-9 px-3 rounded-md text-xs font-semibold focus-visible:outline-none focus-visible:ring-2"
              style={{
                background: "var(--color-fg-paper)",
                color: "var(--color-fg-ink)",
                border: "1px solid var(--color-fg-line-soft)",
                ["--tw-ring-color" as string]: "var(--primary)",
              }}
              aria-label={`정렬: ${sortLabel}`}
            >
              <option value="recent">최신순</option>
              <option value="comments">댓글많은순</option>
            </select>
          </div>
        </div>
      </div>

      {/* Write form (inline) */}
      {showForm && canWrite && user && (
        <section className="px-5 md:px-10 py-6">
          <div
            className="max-w-4xl mx-auto rounded-2xl px-5 md:px-8 py-6 md:py-8"
            style={{
              background: "var(--color-fg-paper)",
              border: "1px solid var(--color-fg-line-soft)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2
                className="font-bold text-base flex items-center gap-2"
                style={{ color: "var(--color-fg-ink)" }}
              >
                <MessageSquare className="w-4 h-4" /> 새 글
              </h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                aria-label="작성 취소"
                className="p-2 rounded-md transition-colors hover:bg-[#F5F7FF]"
                style={{ color: "var(--color-fg-ink-muted)" }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <BoardPostForm
              submitLabel="등록"
              cancelHref={`/teams/${teamId}/chat`}
              onSubmit={async (values) => {
                const newId = await createBoardPost({
                  title: values.title,
                  body: values.body,
                  category: values.category,
                  authorId: user.uid,
                  teamId,
                });
                const ids = mentionedUserIds(values.body);
                if (ids.length > 0) {
                  await notifyMentions("post", newId, ids);
                }
                setShowForm(false);
                await reload();
              }}
            />
          </div>
        </section>
      )}

      {/* List */}
      <main className="px-5 md:px-10 py-10">
        <div className="max-w-4xl mx-auto">
          {loading ? (
            <div
              className="py-16 text-center text-sm"
              style={{ color: "var(--color-fg-ink-muted)" }}
            >
              불러오는 중…
            </div>
          ) : posts.length === 0 ? (
            <div
              className="py-16 text-center rounded-xl"
              style={{
                background: "var(--color-fg-paper)",
                border: "1px solid var(--color-fg-line-soft)",
              }}
            >
              <p
                className="text-sm font-semibold mb-1"
                style={{ color: "var(--color-fg-ink)" }}
              >
                아직 글이 없습니다
              </p>
              <p className="text-xs" style={{ color: "var(--color-fg-ink-muted)" }}>
                팀 멤버끼리 첫 대화를 시작해보세요.
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
                      ["--tw-ring-color" as string]: "var(--primary)",
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
                      <time dateTime={new Date(p.createdAt).toISOString()}>
                        {formatDate(p.createdAt)}
                      </time>
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
