"use client";

import { useState, type FormEvent } from "react";
import { MoreHorizontal, MessageCircle } from "lucide-react";
import { useDataStore } from "@/stores/dataStore";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { MentionRenderer } from "@/components/mention-renderer";
import { MentionInput } from "@/components/mention-input";
import { HeartButton } from "@/components/heart-button";
import { ReportButton } from "@/components/report-button";
import { AuthorRoleBadge } from "@/components/author-role-badge";
import { mentionedUserIds } from "@/lib/mention-parser";
import { formatDate } from "@/utils/formatters";
import type { BoardComment } from "@/types";

const COMMENT_MAX = 2000;

interface Props {
  postId: string;
  comments: BoardComment[];
  onCommentsChanged: () => void;
  myReactions: Set<string>;
}

/**
 * 1-level nested comment thread.
 * - root 댓글에만 답글 버튼 노출 (서버 트리거가 nesting 강제).
 * - 본인 댓글에만 편집/삭제 메뉴 노출.
 * - 편집은 인라인 MentionInput, 삭제는 confirm.
 */
export function CommentThread({
  postId,
  comments,
  onCommentsChanged,
  myReactions,
}: Props) {
  const roots = comments.filter((c) => !c.parentCommentId);
  const repliesByParent = new Map<string, BoardComment[]>();
  for (const c of comments) {
    if (!c.parentCommentId) continue;
    const arr = repliesByParent.get(c.parentCommentId) ?? [];
    arr.push(c);
    repliesByParent.set(c.parentCommentId, arr);
  }

  if (roots.length === 0) {
    return (
      <p className="text-sm py-4" style={{ color: "var(--color-fg-ink-muted)" }}>
        아직 댓글이 없습니다. 첫 댓글을 남겨보세요.
      </p>
    );
  }

  return (
    <ul className="flex flex-col">
      {roots.map((root) => {
        const replies = repliesByParent.get(root.id) ?? [];
        return (
          <li
            key={root.id}
            id={`cm-${root.id}`}
            className="scroll-mt-24 py-4 target:rounded-md target:bg-[color:var(--color-fg-paper-3,#EEF3FF)]"
            style={{ borderBottom: "1px solid var(--color-fg-line-soft)" }}
          >
            <CommentNode
              comment={root}
              isReply={false}
              postId={postId}
              myReactions={myReactions}
              onChanged={onCommentsChanged}
            />
            {replies.length > 0 && (
              <ul
                className="mt-3 pl-6"
                style={{ borderLeft: "2px solid var(--color-fg-line-soft)" }}
              >
                {replies.map((r) => (
                  <li
                    key={r.id}
                    id={`cm-${r.id}`}
                    className="scroll-mt-24 py-3 target:rounded-md target:bg-[color:var(--color-fg-paper-3,#EEF3FF)]"
                  >
                    <CommentNode
                      comment={r}
                      isReply
                      postId={postId}
                      myReactions={myReactions}
                      onChanged={onCommentsChanged}
                    />
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

interface NodeProps {
  comment: BoardComment;
  isReply: boolean;
  postId: string;
  myReactions: Set<string>;
  onChanged: () => void;
}

function CommentNode({ comment, isReply, postId, myReactions, onChanged }: NodeProps) {
  const { user, player } = useAuth();
  const addComment = useDataStore((s) => s.addComment);
  const updateComment = useDataStore((s) => s.updateComment);
  const deleteComment = useDataStore((s) => s.deleteComment);
  const notifyMentions = useDataStore((s) => s.notifyMentions);

  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);

  const isOwner = !!user && user.uid === comment.authorId;
  const isAdmin = player?.role === "admin";
  const canModify = isOwner;
  const canDelete = isOwner || isAdmin;

  async function handleReplySubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || replySubmitting) return;
    const trimmed = replyBody.trim();
    if (!trimmed) {
      setReplyError("답글 내용을 입력해주세요");
      return;
    }
    setReplySubmitting(true);
    setReplyError(null);
    try {
      const newId = await addComment(postId, trimmed, user.uid, comment.id);
      const ids = mentionedUserIds(trimmed);
      if (ids.length > 0) {
        await notifyMentions("comment", newId, ids);
      }
      setReplyBody("");
      setShowReplyForm(false);
      onChanged();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "답글 등록 실패";
      setReplyError(msg);
    } finally {
      setReplySubmitting(false);
    }
  }

  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    if (editSubmitting) return;
    const trimmed = editBody.trim();
    if (!trimmed) {
      setEditError("내용을 입력해주세요");
      return;
    }
    if (trimmed === comment.body) {
      setEditing(false);
      return;
    }
    setEditSubmitting(true);
    setEditError(null);
    try {
      await updateComment(comment.id, trimmed);
      setEditing(false);
      onChanged();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "댓글 수정 실패";
      setEditError(msg);
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!confirm("댓글을 삭제하시겠습니까?")) return;
    setMenuOpen(false);
    try {
      await deleteComment(comment.id);
      onChanged();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "댓글 삭제 실패";
      alert(msg);
    }
  }

  return (
    <div>
      {/* Header: author/date + actions */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <div
          className="flex items-center gap-2 text-xs flex-wrap"
          style={{ color: "var(--color-fg-ink-muted)" }}
        >
          <span className="font-semibold" style={{ color: "var(--color-fg-ink)" }}>
            {comment.authorName ?? "익명"}
          </span>
          <AuthorRoleBadge role={comment.authorRole} />
          <span aria-hidden="true">·</span>
          <time dateTime={new Date(comment.createdAt).toISOString()}>
            {formatDate(comment.createdAt)}
          </time>
          {comment.isEdited && (
            <span style={{ color: "var(--color-fg-ink-muted)" }}>(수정됨)</span>
          )}
          {comment.isHidden && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{
                background: "rgba(255,107,107,0.10)",
                color: "var(--color-fg-red)",
                border: "1px solid rgba(255,107,107,0.24)",
              }}
              aria-label="숨김 처리된 댓글"
            >
              🚫 숨김
            </span>
          )}
        </div>

        {(canModify || canDelete) && !editing && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              onBlur={() => setTimeout(() => setMenuOpen(false), 150)}
              aria-label="댓글 메뉴"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-[color:var(--color-fg-paper-3,#EEF3FF)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ outlineColor: "var(--color-ring)" }}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 z-20 mt-1 min-w-[100px] rounded-md border shadow-md"
                style={{
                  background: "var(--color-fg-paper)",
                  borderColor: "var(--color-fg-line-soft)",
                }}
              >
                {canModify && (
                  <button
                    type="button"
                    role="menuitem"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setEditBody(comment.body);
                      setEditing(true);
                      setMenuOpen(false);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-[color:var(--color-fg-paper-3,#EEF3FF)]"
                    style={{ color: "var(--color-fg-ink)" }}
                  >
                    편집
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    role="menuitem"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      void handleDelete();
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-[color:var(--color-fg-paper-3,#EEF3FF)]"
                    style={{ color: "var(--color-fg-red)" }}
                  >
                    삭제
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Body or edit form */}
      {editing ? (
        <form onSubmit={handleEditSubmit} className="flex flex-col gap-2">
          <MentionInput
            value={editBody}
            onChange={setEditBody}
            maxLength={COMMENT_MAX}
            rows={3}
            placeholder="댓글 수정"
            className="px-3 py-2 rounded-md text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 resize-y w-full"
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-[36px]"
              onClick={() => {
                setEditing(false);
                setEditBody(comment.body);
                setEditError(null);
              }}
            >
              취소
            </Button>
            <Button
              type="submit"
              className="min-h-[36px]"
              disabled={editSubmitting}
              style={{ background: "var(--primary)", color: "#fff" }}
            >
              {editSubmitting ? "저장 중…" : "저장"}
            </Button>
          </div>
          {editError && (
            <p role="alert" className="text-sm font-medium" style={{ color: "var(--color-fg-red)" }}>
              {editError}
            </p>
          )}
        </form>
      ) : (
        <div className="text-sm leading-relaxed" style={{ color: "var(--color-fg-ink)" }}>
          <MentionRenderer body={comment.body} />
        </div>
      )}

      {/* Action row: heart + reply + report */}
      {!editing && (
        <div className="mt-2 flex items-center gap-1">
          <HeartButton
            target="comment"
            id={comment.id}
            initialLiked={myReactions.has(comment.id)}
            initialCount={comment.reactionCount ?? 0}
            size="sm"
          />
          {!isReply && user && (
            <button
              type="button"
              onClick={() => setShowReplyForm((v) => !v)}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors hover:bg-[color:var(--color-fg-paper-3,#EEF3FF)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ color: "var(--color-fg-ink-muted)", outlineColor: "var(--color-ring)" }}
              aria-expanded={showReplyForm}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              답글
            </button>
          )}
          <ReportButton
            targetType="comment"
            targetId={comment.id}
            ownerId={comment.authorId}
            variant="icon"
            className="ml-auto"
          />
        </div>
      )}

      {/* Reply form (root only) */}
      {!isReply && showReplyForm && user && (
        <form onSubmit={handleReplySubmit} className="mt-3 flex flex-col gap-2">
          <label htmlFor={`reply-body-${comment.id}`} className="sr-only">
            답글 입력
          </label>
          <MentionInput
            id={`reply-body-${comment.id}`}
            value={replyBody}
            onChange={setReplyBody}
            maxLength={COMMENT_MAX}
            rows={2}
            placeholder="답글을 입력하세요 · @로 멤버 멘션"
            className="px-3 py-2 rounded-md text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 resize-y w-full"
          />
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-[11px]" style={{ color: "var(--color-fg-ink-muted)" }}>
              {replyBody.length} / {COMMENT_MAX}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-[36px]"
                onClick={() => {
                  setShowReplyForm(false);
                  setReplyBody("");
                  setReplyError(null);
                }}
              >
                취소
              </Button>
              <Button
                type="submit"
                className="min-h-[36px]"
                disabled={replySubmitting}
                style={{ background: "var(--primary)", color: "#fff" }}
              >
                {replySubmitting ? "등록 중…" : "답글 등록"}
              </Button>
            </div>
          </div>
          {replyError && (
            <p role="alert" className="text-sm font-medium" style={{ color: "var(--color-fg-red)" }}>
              {replyError}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
