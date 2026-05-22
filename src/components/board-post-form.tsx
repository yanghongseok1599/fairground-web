"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { POST_CATEGORIES, type PostCategory } from "@/types";
import { Button } from "@/components/ui/button";
import { MentionInput } from "@/components/mention-input";

const TITLE_MAX = 200;
const BODY_MAX = 8000;

export interface BoardPostFormValues {
  title: string;
  body: string;
  category: PostCategory;
}

interface BoardPostFormProps {
  initial?: Partial<BoardPostFormValues>;
  onSubmit: (values: BoardPostFormValues) => Promise<void>;
  submitLabel: string;
  cancelHref?: string;
}

/**
 * 자유게시판 작성/수정 폼.
 * - plain text 본문 (XSS 방지).
 * - 카테고리 enum: 자유/매치후기/팁/모집/질문.
 */
export function BoardPostForm({
  initial,
  onSubmit,
  submitLabel,
  cancelHref = "/board",
}: BoardPostFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [category, setCategory] = useState<PostCategory>(
    initial?.category ?? POST_CATEGORIES[0],
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedTitle) {
      setError("제목을 입력해주세요");
      return;
    }
    if (!trimmedBody) {
      setError("본문을 입력해주세요");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ title: trimmedTitle, body: trimmedBody, category });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "저장에 실패했습니다";
      setError(msg);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="post-title"
          className="text-xs font-semibold"
          style={{ color: "var(--color-fg-ink)" }}
        >
          제목 <span style={{ color: "var(--color-fg-red)" }}>*</span>
        </label>
        <input
          id="post-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={TITLE_MAX}
          required
          aria-describedby="post-title-help"
          className="h-11 px-3 rounded-md text-sm focus-visible:outline-none focus-visible:ring-2"
          style={{
            background: "var(--color-fg-paper)",
            color: "var(--color-fg-ink)",
            border: "1px solid var(--color-fg-line-soft)",
            ['--tw-ring-color' as string]: "var(--primary)",
          }}
        />
        <p
          id="post-title-help"
          className="text-[11px]"
          style={{ color: "var(--color-fg-ink-muted)" }}
        >
          {title.length} / {TITLE_MAX}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="post-category"
          className="text-xs font-semibold"
          style={{ color: "var(--color-fg-ink)" }}
        >
          카테고리
        </label>
        <select
          id="post-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as PostCategory)}
          className="h-11 px-3 rounded-md text-sm focus-visible:outline-none focus-visible:ring-2"
          style={{
            background: "var(--color-fg-paper)",
            color: "var(--color-fg-ink)",
            border: "1px solid var(--color-fg-line-soft)",
            ['--tw-ring-color' as string]: "var(--primary)",
          }}
        >
          {POST_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="post-body"
          className="text-xs font-semibold"
          style={{ color: "var(--color-fg-ink)" }}
        >
          본문 <span style={{ color: "var(--color-fg-red)" }}>*</span>
        </label>
        <MentionInput
          id="post-body"
          value={body}
          onChange={setBody}
          maxLength={BODY_MAX}
          rows={14}
          aria-describedby="post-body-help"
          className="px-3 py-3 rounded-md text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 resize-y w-full"
        />
        <p
          id="post-body-help"
          className="text-[11px]"
          style={{ color: "var(--color-fg-ink-muted)" }}
        >
          {body.length} / {BODY_MAX} · 일반 텍스트만 지원합니다 · @를 입력하면 멤버를 멘션할 수 있습니다
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium" style={{ color: "var(--color-fg-red)" }}>
          {error}
        </p>
      )}

      <div className="flex gap-2 justify-end pt-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px]"
          onClick={() => router.push(cancelHref)}
          disabled={submitting}
        >
          취소
        </Button>
        <Button
          type="submit"
          className="min-h-[44px]"
          disabled={submitting}
          style={{ background: "var(--primary)", color: "#fff" }}
        >
          {submitting ? "저장 중…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
