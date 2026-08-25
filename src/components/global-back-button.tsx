"use client";

import { ArrowLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

const HIDDEN_PATHS = new Set(["/"]);

export function GlobalBackButton() {
  const pathname = usePathname();
  const router = useRouter();

  if (HIDDEN_PATHS.has(pathname)) {
    return null;
  }

  const goBack = () => {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/");
  };

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label="뒤로 가기"
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors hover:bg-[color:var(--color-fg-paper-3,#EEF3FF)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 md:h-10 md:w-auto md:px-3 md:gap-1.5"
      style={{
        borderColor: "var(--color-fg-line-soft, rgba(13,27,42,0.12))",
        color: "var(--color-fg-ink, #0D1B2A)",
        background: "rgba(255,255,255,0.72)",
        outlineColor: "var(--color-ring)",
      }}
    >
      <ArrowLeft className="h-4 w-4" />
      <span className="hidden text-[12px] font-bold md:inline">뒤로</span>
    </button>
  );
}
