"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pin, AlertCircle, Pencil, Trash2 } from "lucide-react";
import { useDataStore } from "@/stores/dataStore";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { CategoryChip } from "@/components/category-chip";
import { MentionRenderer } from "@/components/mention-renderer";
import { formatDate } from "@/utils/formatters";
import type { Notice } from "@/types";

function canManageNotice(role: string | undefined): boolean {
  return role === "admin" || role === "referee";
}

export default function NoticeDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;
  const fetchNotice = useDataStore((s) => s.fetchNotice);
  const deleteNotice = useDataStore((s) => s.deleteNotice);
  const { player } = useAuth();

  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    void fetchNotice(id).then((n) => {
      if (active) {
        setNotice(n);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [id, fetchNotice]);

  const canManage = canManageNotice(player?.role);

  async function handleDelete() {
    if (!notice) return;
    if (!confirm("이 공지를 삭제하시겠습니까?")) return;
    setDeleting(true);
    try {
      await deleteNotice(notice.id);
      router.push("/notices");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "삭제 실패";
      alert(msg);
      setDeleting(false);
    }
  }

  return (
    <div className="pt-[60px] min-h-screen" style={{ background: "var(--color-fg-paper-2)" }}>
      <div className="max-w-3xl mx-auto px-5 md:px-8 py-8">
        <Link
          href="/notices"
          className="inline-flex items-center gap-1 text-sm font-medium mb-6"
          style={{ color: "var(--primary)" }}
        >
          <ArrowLeft className="w-4 h-4" /> 목록으로
        </Link>

        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: "var(--color-fg-ink-muted)" }}>
            불러오는 중…
          </div>
        ) : !notice ? (
          <div
            className="py-16 px-6 text-center rounded-xl"
            style={{
              background: "var(--color-fg-paper)",
              border: "1px solid var(--color-fg-line-soft)",
            }}
          >
            <p className="text-sm font-semibold" style={{ color: "var(--color-fg-ink)" }}>
              공지를 찾을 수 없습니다
            </p>
          </div>
        ) : (
          <article
            className="rounded-2xl px-6 md:px-10 py-8 md:py-10"
            style={{
              background: "var(--color-fg-paper)",
              border: "1px solid var(--color-fg-line-soft)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {notice.isPinned && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded"
                  style={{ background: "var(--primary)", color: "#fff" }}
                >
                  <Pin className="w-3 h-3" /> 고정
                </span>
              )}
              {notice.isImportant && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded"
                  style={{ background: "var(--color-fg-red)", color: "#fff" }}
                >
                  <AlertCircle className="w-3 h-3" /> 중요
                </span>
              )}
              <CategoryChip label={notice.category} />
            </div>

            <h1
              className="font-black leading-tight mb-3"
              style={{
                fontSize: "clamp(24px, 4vw, 36px)",
                letterSpacing: "-1px",
                color: "var(--color-fg-ink)",
              }}
            >
              {notice.title}
            </h1>

            <div
              className="flex items-center gap-3 text-xs pb-5 mb-6"
              style={{
                color: "var(--color-fg-ink-muted)",
                borderBottom: "1px solid var(--color-fg-line-soft)",
              }}
            >
              <span>{notice.authorName ?? "운영"}</span>
              <span aria-hidden="true">·</span>
              <time dateTime={new Date(notice.publishedAt).toISOString()}>
                {formatDate(notice.publishedAt)}
              </time>
            </div>

            {/* plain text + 멘션 칩만 허용 — XSS 방지(no HTML, no markdown). */}
            <div
              className="text-[15px] leading-relaxed"
              style={{ color: "var(--color-fg-ink)" }}
            >
              <MentionRenderer body={notice.body} />
            </div>

            {canManage && (
              <div
                className="mt-8 pt-6 flex gap-2 justify-end"
                style={{ borderTop: "1px solid var(--color-fg-line-soft)" }}
              >
                <Link href={`/notices/${notice.id}/edit`}>
                  <Button variant="outline" className="min-h-[40px]">
                    <Pencil className="w-4 h-4" /> 수정
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  className="min-h-[40px]"
                  onClick={handleDelete}
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
        )}
      </div>
    </div>
  );
}
