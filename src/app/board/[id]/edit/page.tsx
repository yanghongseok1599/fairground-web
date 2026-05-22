"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";
import { useDataStore } from "@/stores/dataStore";
import { useAuth } from "@/hooks/useAuth";
import { BoardPostForm } from "@/components/board-post-form";
import { Button } from "@/components/ui/button";
import { mentionedUserIds } from "@/lib/mention-parser";
import type { BoardPost } from "@/types";

export default function BoardEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const { user, initialized } = useAuth();
  const fetchBoardPost = useDataStore((s) => s.fetchBoardPost);
  const updateBoardPost = useDataStore((s) => s.updateBoardPost);
  const notifyMentions = useDataStore((s) => s.notifyMentions);

  const [post, setPost] = useState<BoardPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    void fetchBoardPost(id).then((p) => {
      if (active) {
        setPost(p);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [id, fetchBoardPost]);

  useEffect(() => {
    if (!initialized) return;
    if (!user) {
      router.replace(
        `/login?returnTo=${encodeURIComponent(`/board/${id}/edit`)}`,
      );
    }
  }, [initialized, user, id, router]);

  if (!initialized || !user || loading) {
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

  if (!post) {
    return (
      <div className="pt-[60px] min-h-screen" style={{ background: "var(--color-fg-paper-2)" }}>
        <div className="max-w-3xl mx-auto px-5 md:px-8 py-12 text-center">
          <p className="text-sm" style={{ color: "var(--color-fg-ink-muted)" }}>
            글을 찾을 수 없습니다.
          </p>
        </div>
      </div>
    );
  }

  if (post.authorId !== user.uid) {
    return (
      <div
        className="pt-[60px] min-h-screen flex items-center justify-center px-5"
        style={{ background: "var(--color-fg-paper-2)" }}
      >
        <div
          className="max-w-md w-full text-center rounded-xl px-6 py-12"
          style={{ background: "var(--color-fg-paper)", border: "1px solid var(--color-fg-line-soft)" }}
        >
          <Shield className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--color-fg-ink-muted)" }} />
          <h1 className="font-bold text-lg mb-1" style={{ color: "var(--color-fg-ink)" }}>
            수정 권한이 없습니다
          </h1>
          <p className="text-sm mb-4" style={{ color: "var(--color-fg-ink-muted)" }}>
            본인이 작성한 글만 수정할 수 있습니다.
          </p>
          <Button
            variant="outline"
            onClick={() => router.push(`/board/${post.id}`)}
            className="min-h-[44px]"
          >
            돌아가기
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-[60px] min-h-screen" style={{ background: "var(--color-fg-paper-2)" }}>
      <div className="max-w-3xl mx-auto px-5 md:px-8 py-8">
        <Link
          href={`/board/${post.id}`}
          className="inline-flex items-center gap-1 text-sm font-medium mb-6"
          style={{ color: "var(--primary)" }}
        >
          <ArrowLeft className="w-4 h-4" /> 글로 돌아가기
        </Link>

        <h1
          className="font-black mb-6"
          style={{
            fontSize: "clamp(24px, 4vw, 36px)",
            letterSpacing: "-1px",
            color: "var(--color-fg-ink)",
          }}
        >
          글 수정
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
            initial={{
              title: post.title,
              body: post.body,
              category: post.category,
            }}
            submitLabel="저장"
            cancelHref={`/board/${post.id}`}
            onSubmit={async (values) => {
              await updateBoardPost(post.id, values);
              const ids = mentionedUserIds(values.body);
              if (ids.length > 0) {
                await notifyMentions("post", post.id, ids);
              }
              router.push(`/board/${post.id}`);
            }}
          />
        </div>
      </div>
    </div>
  );
}
