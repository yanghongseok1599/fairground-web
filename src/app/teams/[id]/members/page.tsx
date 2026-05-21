"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";

export default function TeamSubroutePage() {
  const { id } = useParams<{ id: string }>();
  return (
    <main className="min-h-screen px-5 py-12 md:px-10" style={{ background: "var(--color-fg-paper)" }}>
      <div className="mx-auto max-w-3xl">
        <Link href={`/teams/${id}`} className="mb-8 inline-flex min-h-[44px] items-center gap-2 border px-4 text-sm font-bold rounded-md" style={{ background: "rgba(255,255,255,0.86)", borderColor: "rgba(0,71,171,0.18)", color: "var(--primary)", boxShadow: "var(--shadow-sm)" }}>
          <ArrowLeft className="h-4 w-4" /> 팀 홈
        </Link>
        <div className="border p-8 md:p-12 text-center rounded-md" style={{ background: "var(--color-fg-paper-2)", borderColor: "var(--border)", boxShadow: "var(--shadow-md)" }}>
          <div className="mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "var(--color-fg-paper-3, #EEF3FF)", color: "var(--primary)" }}>
            <Users className="h-6 w-6" />
          </div>
          <h1 className="fg-display text-3xl font-black mb-3" style={{ color: "var(--color-fg-ink)" }}>멤버관리</h1>
          <p className="text-sm md:text-base leading-relaxed" style={{ color: "var(--color-fg-ink-muted)" }}>초대 링크·선수 승인 흐름을 준비 중입니다.</p>
          <p className="mt-5 fg-label text-[11px]" style={{ color: "var(--primary)" }}>COMING SOON</p>
        </div>
      </div>
    </main>
  );
}
