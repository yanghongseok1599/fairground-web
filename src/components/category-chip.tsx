"use client";

import { cn } from "@/lib/utils";

interface CategoryChipProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
  /** a11y: 라디오 그룹의 한 항목임을 표시. */
  role?: "radio" | "button";
  ariaPressed?: boolean;
}

/**
 * 공지·게시판 카테고리 필터/표시용 칩.
 * 브랜드 토큰만 사용 (White & Blue). active 시 primary 블루, 비활성은 흰 보더.
 * 44px hit target 보장 (모바일 a11y).
 */
export function CategoryChip({
  label,
  active = false,
  onClick,
  role,
  ariaPressed,
}: CategoryChipProps) {
  const isButton = typeof onClick === "function";
  const Comp = (isButton ? "button" : "span") as "button" | "span";
  return (
    <Comp
      type={isButton ? "button" : undefined}
      onClick={onClick}
      role={role}
      aria-pressed={ariaPressed}
      className={cn(
        "inline-flex items-center justify-center px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors min-h-[32px]",
        isButton && "cursor-pointer min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
      )}
      style={{
        background: active ? "var(--primary)" : "var(--color-fg-paper)",
        color: active ? "#ffffff" : "var(--color-fg-ink)",
        borderColor: active ? "var(--primary)" : "var(--color-fg-line-soft)",
        ...(isButton
          ? {
              ['--tw-ring-color' as string]: "var(--primary)",
            }
          : {}),
      }}
    >
      {label}
    </Comp>
  );
}
