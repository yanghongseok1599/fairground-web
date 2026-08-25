"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";
import { useDataStore } from "@/stores/dataStore";
import { useAuth } from "@/hooks/useAuth";
import { NoticeForm } from "@/components/notice-form";
import { Button } from "@/components/ui/button";
import type { Notice } from "@/types";

function canWrite(role: string | undefined): boolean {
  return role === "admin" || role === "referee";
}

export default function NoticeEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const { user, player, initialized } = useAuth();
  const fetchNotice = useDataStore((s) => s.fetchNotice);
  const updateNotice = useDataStore((s) => s.updateNotice);

  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let active = true;
    queueMicrotask(() => {
      if (active) setLoading(true);
    });
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

  // 미로그인 → 로그인 페이지.
  useEffect(() => {
    if (!initialized) return;
    if (!user) {
      router.replace(
        `/login?returnTo=${encodeURIComponent(`/notices/${id}/edit`)}`,
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

  if (!canWrite(player?.role)) {
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
            공지는 운영진(관리자 / 심판)만 수정할 수 있습니다.
          </p>
          <Button variant="outline" onClick={() => router.push(`/notices/${id}`)} className="min-h-[44px]">
            돌아가기
          </Button>
        </div>
      </div>
    );
  }

  if (!notice) {
    return (
      <div className="pt-[60px] min-h-screen" style={{ background: "var(--color-fg-paper-2)" }}>
        <div className="max-w-3xl mx-auto px-5 md:px-8 py-12 text-center">
          <p className="text-sm" style={{ color: "var(--color-fg-ink-muted)" }}>
            공지를 찾을 수 없습니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-[60px] min-h-screen" style={{ background: "var(--color-fg-paper-2)" }}>
      <div className="max-w-3xl mx-auto px-5 md:px-8 py-8">
        <Link
          href={`/notices/${notice.id}`}
          className="inline-flex items-center gap-1 text-sm font-medium mb-6"
          style={{ color: "var(--primary)" }}
        >
          <ArrowLeft className="w-4 h-4" /> 공지로 돌아가기
        </Link>

        <h1
          className="font-black mb-6"
          style={{
            fontSize: "clamp(24px, 4vw, 36px)",
            letterSpacing: "-1px",
            color: "var(--color-fg-ink)",
          }}
        >
          공지 수정
        </h1>

        <div
          className="rounded-2xl px-5 md:px-8 py-6 md:py-8"
          style={{
            background: "var(--color-fg-paper)",
            border: "1px solid var(--color-fg-line-soft)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <NoticeForm
            initial={{
              title: notice.title,
              body: notice.body,
              category: notice.category,
              isPinned: notice.isPinned,
              isImportant: notice.isImportant,
            }}
            submitLabel="저장"
            cancelHref={`/notices/${notice.id}`}
            onSubmit={async (values) => {
              await updateNotice(notice.id, values);
              router.push(`/notices/${notice.id}`);
            }}
          />
        </div>
      </div>
    </div>
  );
}
