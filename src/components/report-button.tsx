"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ReportDialog } from "@/components/report-dialog";
import type { ReportTarget } from "@/types";

interface Props {
  targetType: ReportTarget;
  targetId: string;
  ownerId?: string;
  targetTitle?: string;
  /** "icon"은 미니멀한 아이콘만, "label"은 아이콘+텍스트 표시. */
  variant?: "icon" | "label";
  className?: string;
}

/**
 * 조용한 신고 트리거.
 *
 * - 본인 콘텐츠(owner === user.uid) 일 때는 null 렌더 — 본인 글을 본인이 신고하는 경로 차단.
 * - 비로그인 사용자에게도 노출 (다이얼로그가 로그인 안내로 분기).
 * - 기본은 작은 ghost 버튼. variant='icon'이면 아이콘만.
 */
export function ReportButton({
  targetType,
  targetId,
  ownerId,
  targetTitle,
  variant = "label",
  className,
}: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  if (ownerId && user && ownerId === user.uid) return null;

  const isIcon = variant === "icon";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="신고"
        title="신고"
        className={[
          "inline-flex items-center justify-center gap-1.5 rounded-md transition-colors",
          "hover:bg-[color:var(--color-fg-paper-3,#EEF3FF)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
          isIcon ? "h-8 w-8" : "min-h-[36px] px-2 py-1 text-sm",
          className ?? "",
        ].join(" ")}
        style={{ color: "var(--color-fg-ink-muted)", outlineColor: "var(--color-ring)" }}
      >
        <Flag className={isIcon ? "w-4 h-4" : "w-3.5 h-3.5"} />
        {!isIcon && <span>신고</span>}
      </button>
      <ReportDialog
        open={open}
        onClose={() => setOpen(false)}
        targetType={targetType}
        targetId={targetId}
        targetTitle={targetTitle}
      />
    </>
  );
}
