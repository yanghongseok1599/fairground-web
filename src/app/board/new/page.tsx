"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useDataStore } from "@/stores/dataStore";
import { useAuth } from "@/hooks/useAuth";
import { BoardPostForm } from "@/components/board-post-form";
import { mentionedUserIds } from "@/lib/mention-parser";

export default function BoardNewPage() {
  const router = useRouter();
  const { user, initialized } = useAuth();
  const createBoardPost = useDataStore((s) => s.createBoardPost);
  const notifyMentions = useDataStore((s) => s.notifyMentions);

  // 미로그인 → 로그인 페이지 (returnTo 보존).
  useEffect(() => {
    if (!initialized) return;
    if (!user) {
      router.replace(`/login?returnTo=${encodeURIComponent("/board/new")}`);
    }
  }, [initialized, user, router]);

  if (!initialized || !user) {
    return (
      <div
        className="pt-[60px] min-h-screen flex items-center justify-center"
        style={{ background: "var(--color-fg-paper-2)" }}
      >
        <p className="text-sm" style={{ color: "var(--color-fg-ink-muted)" }}>
          확인 중…
        </p>
      </div>
    );
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

        <h1
          className="font-black mb-6"
          style={{
            fontSize: "clamp(24px, 4vw, 36px)",
            letterSpacing: "-1px",
            color: "var(--color-fg-ink)",
          }}
        >
          글쓰기
        </h1>

        <div
          className="rounded-2xl px-5 md:px-8 py-6 md:py-8"
          style={{
            background: "var(--color-fg-paper)",
            border: "1px solid var(--color-fg-line-soft)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <BoardPostForm
            submitLabel="등록"
            onSubmit={async (values) => {
              const id = await createBoardPost({
                title: values.title,
                body: values.body,
                category: values.category,
                authorId: user.uid,
              });
              const ids = mentionedUserIds(values.body);
              if (ids.length > 0) {
                await notifyMentions("post", id, ids);
              }
              router.push(`/board/${id}`);
            }}
          />
        </div>
      </div>
    </div>
  );
}
