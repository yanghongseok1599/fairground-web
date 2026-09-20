"use client";

import type { ComponentProps } from "react";
import { DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Dialog portals live outside the court, so they need the same CSS rotation. */
export function MatchDialogContent({
  landscapeFallback = false,
  className,
  style,
  ...props
}: ComponentProps<typeof DialogContent> & { landscapeFallback?: boolean }) {
  return (
    <DialogContent
      {...props}
      data-match-orientation={landscapeFallback ? "rotated" : "native"}
      className={cn("max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain", className)}
      style={{
        ...style,
        ...(landscapeFallback ? {
          // Swap the available dimensions as well as rotating the contents.
          // The individual rotate property preserves Radix's centering/animation.
          rotate: "90deg",
          width: "min(32rem, calc(100dvh - 2rem))",
          maxWidth: "calc(100dvh - 2rem)",
          maxHeight: "calc(100dvw - 2rem)",
        } : {}),
      }}
    />
  );
}
