"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";
import { useDataStore } from "@/stores/dataStore";
import { useAuth } from "@/hooks/useAuth";
import { NoticeForm } from "@/components/notice-form";
import { Button } from "@/components/ui/button";

function canWrite(role: string | undefined): boolean {
  return role === "admin" || role === "referee";
}

export default function NoticeNewPage() {
  const router = useRouter();
  const { user, player, initialized } = useAuth();
  const createNotice = useDataStore((s) => s.createNotice);

  // 미로그인 → 로그인 페이지 (returnTo 보존).
  useEffect(() => {
    if (!initialized) return;
    if (!user) {
      router.replace(
        `/login?returnTo=${encodeURIComponent("/notices/new")}`,
      );
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

  if (!canWrite(player?.role)) {
    return (
      <div
        className="pt-[60px] min-h-screen flex items-center justify-center px-5"
        style={{ background: "var(--color-fg-paper-2)" }}
      >
        <div
          className="max-w-md w-full text-center rounded-xl px-6 py-12"
          style={{
            background: "var(--color-fg-paper)",
            border: "1px solid var(--color-fg-line-soft)",
          }}
        >
          <Shield className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--color-fg-ink-muted)" }} />
          <h1 className="font-bold text-lg mb-1" style={{ color: "var(--color-fg-ink)" }}>
            작성 권한이 없습니다
          </h1>
          <p className="text-sm mb-4" style={{ color: "var(--color-fg-ink-muted)" }}>
            공지는 운영진(관리자 / 심판)만 작성할 수 있습니다.
          </p>
          <Button variant="outline" onClick={() => router.push("/notices")} className="min-h-[44px]">
            목록으로
          </Button>
        </div>
      </div>
    );
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

        <h1
          className="font-black mb-6"
          style={{
            fontSize: "clamp(24px, 4vw, 36px)",
            letterSpacing: "-1px",
            color: "var(--color-fg-ink)",
          }}
        >
          공지 작성
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
            submitLabel="발행"
            onSubmit={async (values) => {
              const id = await createNotice({
                title: values.title,
                body: values.body,
                category: values.category,
                isPinned: values.isPinned,
                isImportant: values.isImportant,
                authorId: user.uid,
              });
              router.push(`/notices/${id}`);
            }}
          />
        </div>
      </div>
    </div>
  );
}
