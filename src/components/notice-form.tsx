"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { NOTICE_CATEGORIES } from "@/types";
import { Button } from "@/components/ui/button";
import { MentionInput } from "@/components/mention-input";

const TITLE_MAX = 200;
const BODY_MAX = 8000;

export interface NoticeFormValues {
  title: string;
  body: string;
  category: string;
  isPinned: boolean;
  isImportant: boolean;
}

interface NoticeFormProps {
  initial?: Partial<NoticeFormValues>;
  /** 폼 제출 시 호출. 실패 시 throw → 폼이 에러를 표시. */
  onSubmit: (values: NoticeFormValues) => Promise<void>;
  submitLabel: string;
  cancelHref?: string;
}

/**
 * 공지 작성/수정 폼.
 * - plain text (no markdown) — XSS 방지.
 * - a11y: label htmlFor, aria-describedby, maxLength 표시.
 */
export function NoticeForm({
  initial,
  onSubmit,
  submitLabel,
  cancelHref = "/notices",
}: NoticeFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [category, setCategory] = useState<string>(
    initial?.category ?? NOTICE_CATEGORIES[0],
  );
  const [isPinned, setIsPinned] = useState(initial?.isPinned ?? false);
  const [isImportant, setIsImportant] = useState(initial?.isImportant ?? false);
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
      await onSubmit({
        title: trimmedTitle,
        body: trimmedBody,
        category,
        isPinned,
        isImportant,
      });
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
          htmlFor="notice-title"
          className="text-xs font-semibold"
          style={{ color: "var(--color-fg-ink)" }}
        >
          제목 <span style={{ color: "var(--color-fg-red)" }}>*</span>
        </label>
        <input
          id="notice-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={TITLE_MAX}
          required
          aria-describedby="notice-title-help"
          className="h-11 px-3 rounded-md text-sm focus-visible:outline-none focus-visible:ring-2"
          style={{
            background: "var(--color-fg-paper)",
            color: "var(--color-fg-ink)",
            border: "1px solid var(--color-fg-line-soft)",
            ['--tw-ring-color' as string]: "var(--primary)",
          }}
        />
        <p
          id="notice-title-help"
          className="text-[11px]"
          style={{ color: "var(--color-fg-ink-muted)" }}
        >
          {title.length} / {TITLE_MAX}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="notice-category"
          className="text-xs font-semibold"
          style={{ color: "var(--color-fg-ink)" }}
        >
          카테고리
        </label>
        <select
          id="notice-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-11 px-3 rounded-md text-sm focus-visible:outline-none focus-visible:ring-2"
          style={{
            background: "var(--color-fg-paper)",
            color: "var(--color-fg-ink)",
            border: "1px solid var(--color-fg-line-soft)",
            ['--tw-ring-color' as string]: "var(--primary)",
          }}
        >
          {NOTICE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-4 flex-wrap">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isPinned}
            onChange={(e) => setIsPinned(e.target.checked)}
            className="w-4 h-4"
            style={{ accentColor: "var(--primary)" }}
          />
          <span className="text-sm" style={{ color: "var(--color-fg-ink)" }}>
            상단 고정
          </span>
        </label>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isImportant}
            onChange={(e) => setIsImportant(e.target.checked)}
            className="w-4 h-4"
            style={{ accentColor: "var(--primary)" }}
          />
          <span className="text-sm" style={{ color: "var(--color-fg-ink)" }}>
            중요 표시
          </span>
        </label>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="notice-body"
          className="text-xs font-semibold"
          style={{ color: "var(--color-fg-ink)" }}
        >
          본문 <span style={{ color: "var(--color-fg-red)" }}>*</span>
        </label>
        <MentionInput
          id="notice-body"
          value={body}
          onChange={setBody}
          maxLength={BODY_MAX}
          rows={14}
          aria-describedby="notice-body-help"
          className="px-3 py-3 rounded-md text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 resize-y w-full"
        />
        <p
          id="notice-body-help"
          className="text-[11px]"
          style={{ color: "var(--color-fg-ink-muted)" }}
        >
          {body.length} / {BODY_MAX} · 일반 텍스트만 지원합니다 (HTML/마크다운 미적용)
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="text-sm font-medium"
          style={{ color: "var(--color-fg-red)" }}
        >
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
