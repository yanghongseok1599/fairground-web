"use client";

import { useCallback } from "react";
import { Button } from "@/components/ui/button";

/**
 * 오프라인 폴백 페이지의 재시도 버튼 — 클라이언트 전용.
 * 페이지 자체는 정적 prerender 유지를 위해 서버 컴포넌트로 두고,
 * 인터랙션만 이 작은 클라이언트 컴포넌트로 분리.
 */
export function OfflineRetry() {
  const retry = useCallback(() => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }, []);

  return (
    <Button
      type="button"
      onClick={retry}
      className="mt-8 min-h-[44px] px-6"
    >
      다시 시도
    </Button>
  );
}
