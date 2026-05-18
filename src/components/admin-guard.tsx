"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
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
 * 운영 라우트 인증 가드 (P3 견고화).
 *
 * 동작:
 *  - 미초기화: 로딩 표시.
 *  - 미로그인: /login?returnTo=<현재경로> 로 클라 리다이렉트.
 *  - 로그인 O / 권한 부족(미승인 referee, role 불일치): 안내 화면.
 *  - 허용: children 렌더.
 *
 * 권한의 최종 강제는 서버측 RLS + RPC 트랜잭션이 책임진다.
 * 본 가드는 UX(불필요한 화면 진입 차단/안내) 레이어다.
 */
export function AdminGuard({ allow, children }: AdminGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, player, initialized } = useAuth();

  // 미로그인 시 로그인 페이지로 리다이렉트(의도경로 보존).
  useEffect(() => {
    if (!initialized) return;
    if (!user) {
      const rt = encodeURIComponent(pathname || "/admin");
      router.replace(`/login?returnTo=${rt}`);
    }
  }, [initialized, user, pathname, router]);

  if (!initialized) return <AdminLoading />;

  // 리다이렉트 진행 중(미로그인) — 깜빡임 방지용 로딩 유지.
  if (!user) return <AdminLoading />;

  const isAllowed = (() => {
    if (!player) return false;
    if (allow && allow.length > 0) return allow.includes(player.role);
    // 기본: admin 전체 허용, referee 는 승인된 경우만.
    if (player.role === "admin") return true;
    if (player.role === "referee" && player.isApproved) return true;
    return false;
  })();

  if (!isAllowed) {
    const isPendingReferee =
      !!player && player.role === "referee" && !player.isApproved;
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
          {isPendingReferee
            ? "심판 권한이 아직 승인되지 않았습니다. 관리자 승인 후 이용할 수 있습니다."
            : "관리자 또는 승인된 심판만 접근할 수 있습니다."}
        </p>
        <div className="mt-4 flex gap-2">
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
