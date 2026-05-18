"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AdminHeaderProps {
  title?: string;
  showBack?: boolean;
}

/**
 * 운영/심판 콘솔 전용 헤더 — 공개 SiteHeader 와 분리.
 * 현장(야외·한손) 사용 가정: 큰 백버튼(44px+), 명확한 타이틀.
 * 색은 fairground-web 디자인 토큰만 사용(하드코딩 hex 금지).
 */
export function AdminHeader({ title = "운영", showBack = true }: AdminHeaderProps) {
  const router = useRouter();

  return (
    <header
      className="sticky top-0 z-30 border-b"
      style={{
        background: "var(--primary)",
        color: "var(--primary-foreground)",
        borderColor: "var(--border)",
      }}
    >
      <div className="flex h-14 items-center px-3">
        {showBack && (
          <Button
            variant="ghost"
            size="icon"
            className="mr-2 h-11 w-11 hover:bg-white/10"
            style={{ color: "var(--primary-foreground)" }}
            onClick={() => router.back()}
            aria-label="뒤로 가기"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <span
          className="fg-display text-lg font-bold tracking-tight"
          style={{ color: "var(--primary-foreground)" }}
        >
          {title}
        </span>
      </div>
    </header>
  );
}
