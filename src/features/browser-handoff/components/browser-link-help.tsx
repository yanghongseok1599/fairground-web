"use client";

import { useEffect, useState } from "react";

/** In-app browsers cannot reliably launch another browser. Provide a manual path. */
export function BrowserLinkHelp({ browserName = "Chrome 또는 Safari" }: { browserName?: string }) {
  const [url, setUrl] = useState("https://fairground-kor.com/");
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  useEffect(() => {
    const current = new URL(window.location.href);
    current.hash = "";
    queueMicrotask(() => setUrl(current.toString()));
  }, []);

  const copy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(url);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  };

  return <div className="mt-3 space-y-2 text-sm">
    <p>{browserName} 앱을 직접 열고 아래 주소를 주소창에 붙여넣어 주세요.</p>
    <div className="flex min-w-0 gap-2">
      <input aria-label={`${browserName}에서 열 주소`} readOnly value={url}
        onFocus={(event) => event.currentTarget.select()}
        className="min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-base text-foreground" />
      <button type="button" onClick={() => void copy()} className="min-h-11 shrink-0 rounded-lg border border-border bg-background px-3 font-bold text-foreground">주소 복사</button>
    </div>
    <p role="status" className="text-xs leading-relaxed">
      {status === "copied" ? `주소를 복사했습니다. ${browserName} 주소창에 붙여넣어 주세요.`
        : status === "failed" ? "자동 복사를 사용할 수 없습니다. 주소 칸을 길게 눌러 직접 복사해주세요."
        : "자동 복사가 안 되면 주소 칸을 길게 눌러 직접 복사할 수 있습니다."}
    </p>
  </div>;
}
