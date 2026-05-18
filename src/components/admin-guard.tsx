"use client";

import { useRouter } from "next/navigation";
import { Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { AdminLoading } from "@/components/admin-loading";
import type { PlayerRole } from "@/types";

interface AdminGuardProps {
  /** 허용 역할. 미지정 시 admin·승인 referee 기본. */
  allow?: PlayerRole[];
  children: React.ReactNode;
}

/**
 * 운영 라우트 기본 인증 가드 (P2 스코프 — 기본 가드만).
 *
 * P3 인증 결선 포인트:
 *  - 미들웨어/서버 세션 검증은 P3 가 추가 (현재는 클라이언트 authStore.user 기준).
 *  - 미로그인 시 /login 리다이렉트 UX/세션 만료 처리도 P3 소관.
 *  - 본 가드는 authStore.user + player.role 기반 클라이언트 차단만 수행.
 *
 * 권한 강제는 서버측 RLS 가 최종 책임(클라이언트 가드는 UX 레이어).
 */
export function AdminGuard({ allow, children }: AdminGuardProps) {
  const router = useRouter();
  const { user, player, initialized } = useAuth();

  if (!initialized) return <AdminLoading />;

  const isAllowed = (() => {
    if (!user || !player) return false;
    if (allow && allow.length > 0) return allow.includes(player.role);
    // 기본: admin 전체 허용, referee 는 승인된 경우만.
    if (player.role === "admin") return true;
    if (player.role === "referee" && player.isApproved) return true;
    return false;
  })();

  if (!isAllowed) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-4 text-center">
        <Shield
          className="mb-4 h-12 w-12"
          style={{ color: "var(--muted-foreground)" }}
        />
        <h1 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
          접근 권한이 없습니다
        </h1>
        <p
          className="mt-2 text-sm"
          style={{ color: "var(--muted-foreground)" }}
        >
          {user
            ? "관리자 또는 승인된 심판만 접근할 수 있습니다."
            : "로그인이 필요합니다."}
        </p>
        <div className="mt-4 flex gap-2">
          {!user && (
            <Button
              className="min-h-[44px]"
              onClick={() => router.push("/login")}
            >
              로그인
            </Button>
          )}
          <Button
            variant="outline"
            className="min-h-[44px]"
            onClick={() => router.push("/")}
          >
            홈으로
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
