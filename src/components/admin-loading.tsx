import { cn } from "@/lib/utils";

/**
 * 운영 콘솔 로딩 스피너 — 디자인 토큰만 사용(하드코딩 hex 금지).
 */
export function AdminLoading({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex items-center justify-center py-12", className)}
      role="status"
      aria-label="로딩 중"
    >
      <div
        className="h-8 w-8 animate-spin rounded-full border-4"
        style={{
          borderColor: "var(--border)",
          borderTopColor: "var(--primary)",
        }}
      />
    </div>
  );
}
