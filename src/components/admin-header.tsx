"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

interface AdminHeaderProps {
  title?: string;
  showBack?: boolean;
}

export function AdminHeader({ title = "운영", showBack = true }: AdminHeaderProps) {
  const router = useRouter();
  const { user, logout } = useAuth();

  return (
    <header
      className="sticky top-0 z-30 border-b fg-glass-header"
      style={{
        background: "rgba(255,255,255,0.86)",
        color: "var(--color-fg-ink)",
        borderColor: "rgba(0,71,171,0.12)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="mx-auto flex h-[60px] max-w-[1320px] items-center justify-between px-4 md:px-10">
        <div className="flex min-w-0 items-center">
          {showBack && (
            <Button
              variant="ghost"
              size="icon"
              className="mr-2 h-11 w-11 hover:bg-blue-50"
              style={{ color: "var(--primary)" }}
              onClick={() => router.back()}
              aria-label="뒤로 가기"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div>
            <div className="fg-mono text-[10px] leading-none" style={{ color: "var(--primary)" }}>
              FAIRGROUND OPS
            </div>
            <span
              className="fg-display text-lg font-black tracking-tight"
              style={{ color: "var(--color-fg-ink)" }}
            >
              {title}
            </span>
          </div>
        </div>

        {user && (
          <Button
            variant="outline"
            className="h-10 gap-2 rounded-none border px-4 text-xs font-bold"
            style={{
              background: "rgba(255,59,48,0.08)",
              borderColor: "rgba(255,59,48,0.22)",
              color: "var(--destructive)",
            }}
            onClick={async () => {
              await logout();
              router.push("/");
            }}
          >
            <LogOut className="h-4 w-4" />
            로그아웃
          </Button>
        )}
      </div>
    </header>
  );
}
