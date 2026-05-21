"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  MessageSquare,
  Eye,
  Send,
} from "lucide-react";
import { useDataStore } from "@/stores/dataStore";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { CategoryChip } from "@/components/category-chip";
import { formatDate } from "@/utils/formatters";
import type { BoardPost, BoardComment } from "@/types";

const COMMENT_MAX = 2000;

export default function BoardDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const fetchBoardPost = useDataStore((s) => s.fetchBoardPost);
  const deleteBoardPost = useDataStore((s) => s.deleteBoardPost);
  const fetchComments = useDataStore((s) => s.fetchComments);
  const addComment = useDataStore((s) => s.addComment);
  const deleteComment = useDataStore((s) => s.deleteComment);
  const { user, player } = useAuth();

  const [post, setPost] = useState<BoardPost | null>(null);
  const [comments, setComments] = useState<BoardComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentInput, setCommentInput] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // StrictMode 이중 마운트 가드 — bump_post_view 멱등 미보장 → 1회만 호출.
  const bumpedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    const shouldBump = bumpedRef.current !== id;
    if (shouldBump) bumpedRef.current = id;
    void Promise.all([
      fetchBoardPost(id, { bumpView: shouldBump }),
      fetchComments(id),
    ]).then(([p, cs]) => {
      if (active) {
        setPost(p);
        setComments(cs);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [id, fetchBoardPost, fetchComments]);

  const isAuthor = !!post && !!user && post.authorId === user.uid;
  const isAdmin = player?.role === "admin";

  async function handleDeletePost() {
    if (!post) return;
    if (!confirm("이 글을 삭제하시겠습니까?")) return;
    setDeleting(true);
    try {
      await deleteBoardPost(post.id);
      router.push("/board");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "삭제 실패";
      alert(msg);
      setDeleting(false);
    }
  }

  async function handleAddComment(e: FormEvent) {
    e.preventDefault();
    if (!post || !user || submittingComment) return;
    const trimmed = commentInput.trim();
    if (!trimmed) {
      setCommentError("댓글 내용을 입력해주세요");
      return;
    }
    setSubmittingComment(true);
    setCommentError(null);
    try {
      await addComment(post.id, trimmed, user.uid);
      // 댓글 목록 + 댓글 수 재로딩.
      const [fresh, freshPost] = await Promise.all([
        fetchComments(post.id),
        fetchBoardPost(post.id),
      ]);
      setComments(fresh);
      if (freshPost) setPost(freshPost);
      setCommentInput("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "댓글 등록 실패";
      setCommentError(msg);
    } finally {
      setSubmittingComment(false);
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!confirm("댓글을 삭제하시겠습니까?")) return;
    try {
      await deleteComment(commentId);
      if (post) {
        const [fresh, freshPost] = await Promise.all([
          fetchComments(post.id),
          fetchBoardPost(post.id),
        ]);
        setComments(fresh);
        if (freshPost) setPost(freshPost);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "댓글 삭제 실패";
      alert(msg);
    }
  }

  return (
    <div className="pt-[60px] min-h-screen" style={{ background: "var(--color-fg-paper-2)" }}>
      <div className="max-w-3xl mx-auto px-5 md:px-8 py-8">
        <Link
          href="/board"
          className="inline-flex items-center gap-1 text-sm font-medium mb-6"
          style={{ color: "var(--primary)" }}
        >
          <ArrowLeft className="w-4 h-4" /> 목록으로
        </Link>

        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: "var(--color-fg-ink-muted)" }}>
            불러오는 중…
          </div>
        ) : !post ? (
          <div
            className="py-16 px-6 text-center rounded-xl"
            style={{ background: "var(--color-fg-paper)", border: "1px solid var(--color-fg-line-soft)" }}
          >
            <p className="text-sm font-semibold" style={{ color: "var(--color-fg-ink)" }}>
              글을 찾을 수 없습니다
            </p>
          </div>
        ) : (
          <>
            {/* Post */}
            <article
              className="rounded-2xl px-6 md:px-10 py-8 md:py-10"
              style={{
                background: "var(--color-fg-paper)",
                border: "1px solid var(--color-fg-line-soft)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div className="mb-3">
                <CategoryChip label={post.category} />
              </div>
              <h1
                className="font-black leading-tight mb-3"
                style={{
                  fontSize: "clamp(22px, 4vw, 32px)",
                  letterSpacing: "-1px",
                  color: "var(--color-fg-ink)",
                }}
              >
                {post.title}
              </h1>
              <div
                className="flex items-center gap-3 text-xs pb-5 mb-6 flex-wrap"
                style={{
                  color: "var(--color-fg-ink-muted)",
                  borderBottom: "1px solid var(--color-fg-line-soft)",
                }}
              >
                <span>{post.authorName ?? "익명"}</span>
                <span aria-hidden="true">·</span>
                <time dateTime={new Date(post.createdAt).toISOString()}>{formatDate(post.createdAt)}</time>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5" />
                  {post.viewCount}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5" />
                  {post.commentCount}
                </span>
              </div>

              <div
                className="whitespace-pre-line text-[15px] leading-relaxed"
                style={{ color: "var(--color-fg-ink)" }}
              >
                {post.body}
              </div>

              {(isAuthor || isAdmin) && (
                <div
                  className="mt-8 pt-6 flex gap-2 justify-end"
                  style={{ borderTop: "1px solid var(--color-fg-line-soft)" }}
                >
                  {isAuthor && (
                    <Link href={`/board/${post.id}/edit`}>
                      <Button variant="outline" className="min-h-[40px]">
                        <Pencil className="w-4 h-4" /> 수정
                      </Button>
                    </Link>
                  )}
                  <Button
                    variant="outline"
                    className="min-h-[40px]"
                    onClick={handleDeletePost}
                    disabled={deleting}
                    style={{
                      color: "var(--color-fg-red)",
                      borderColor: "var(--color-fg-red)",
                    }}
                  >
                    <Trash2 className="w-4 h-4" /> 삭제
                  </Button>
                </div>
              )}
            </article>

            {/* Comments */}
            <section
              className="mt-6 rounded-2xl px-6 md:px-10 py-6 md:py-8"
              style={{
                background: "var(--color-fg-paper)",
                border: "1px solid var(--color-fg-line-soft)",
                boxShadow: "var(--shadow-sm)",
              }}
              aria-labelledby="comments-heading"
            >
              <h2
                id="comments-heading"
                className="font-bold text-base mb-4 flex items-center gap-2"
                style={{ color: "var(--color-fg-ink)" }}
              >
                <MessageSquare className="w-4 h-4" /> 댓글 {post.commentCount}
              </h2>

              {comments.length === 0 ? (
                <p className="text-sm py-4" style={{ color: "var(--color-fg-ink-muted)" }}>
                  아직 댓글이 없습니다. 첫 댓글을 남겨보세요.
                </p>
              ) : (
                <ul className="flex flex-col">
                  {comments.map((c) => (
                    <li
                      key={c.id}
                      className="py-4"
                      style={{ borderBottom: "1px solid var(--color-fg-line-soft)" }}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div
                          className="flex items-center gap-2 text-xs"
                          style={{ color: "var(--color-fg-ink-muted)" }}
                        >
                          <span className="font-semibold" style={{ color: "var(--color-fg-ink)" }}>
                            {c.authorName ?? "익명"}
                          </span>
                          <span aria-hidden="true">·</span>
                          <time dateTime={new Date(c.createdAt).toISOString()}>
                            {formatDate(c.createdAt)}
                          </time>
                        </div>
                        {(user?.uid === c.authorId || isAdmin) && (
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(c.id)}
                            className="text-xs font-medium"
                            style={{ color: "var(--color-fg-red)" }}
                            aria-label="댓글 삭제"
                          >
                            삭제
                          </button>
                        )}
                      </div>
                      <p
                        className="whitespace-pre-line text-sm leading-relaxed"
                        style={{ color: "var(--color-fg-ink)" }}
                      >
                        {c.body}
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              {/* Comment input */}
              <div className="mt-6 pt-4" style={{ borderTop: "1px solid var(--color-fg-line-soft)" }}>
                {!user ? (
                  <div
                    className="text-center py-6 rounded-lg"
                    style={{
                      background: "var(--color-fg-paper-2)",
                      border: "1px dashed var(--color-fg-line-soft)",
                    }}
                  >
                    <p className="text-sm mb-3" style={{ color: "var(--color-fg-ink-muted)" }}>
                      댓글을 작성하려면 로그인이 필요합니다
                    </p>
                    <Link href={`/login?returnTo=${encodeURIComponent(`/board/${post.id}`)}`}>
                      <Button
                        className="min-h-[40px]"
                        style={{ background: "var(--primary)", color: "#fff" }}
                      >
                        로그인
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <form onSubmit={handleAddComment} className="flex flex-col gap-2">
                    <label htmlFor="comment-body" className="sr-only">
                      댓글 입력
                    </label>
                    <textarea
                      id="comment-body"
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      maxLength={COMMENT_MAX}
                      rows={3}
                      placeholder="댓글을 입력하세요"
                      aria-describedby="comment-body-help"
                      className="px-3 py-2 rounded-md text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 resize-y"
                      style={{
                        background: "var(--color-fg-paper)",
                        color: "var(--color-fg-ink)",
                        border: "1px solid var(--color-fg-line-soft)",
                        ['--tw-ring-color' as string]: "var(--primary)",
                        minHeight: "80px",
                      }}
                    />
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p
                        id="comment-body-help"
                        className="text-[11px]"
                        style={{ color: "var(--color-fg-ink-muted)" }}
                      >
                        {commentInput.length} / {COMMENT_MAX}
                      </p>
                      <Button
                        type="submit"
                        className="min-h-[40px]"
                        disabled={submittingComment}
                        style={{ background: "var(--primary)", color: "#fff" }}
                      >
                        <Send className="w-4 h-4" />
                        {submittingComment ? "등록 중…" : "댓글 등록"}
                      </Button>
                    </div>
                    {commentError && (
                      <p role="alert" className="text-sm font-medium" style={{ color: "var(--color-fg-red)" }}>
                        {commentError}
                      </p>
                    )}
                  </form>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
