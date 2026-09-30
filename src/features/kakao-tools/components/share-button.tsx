"use client";

import { useState } from "react";
import { Share2, Copy } from "lucide-react";
import { isKakaoShareConfigured } from "@/lib/kakao-sdk";
import { shareEvent, type EventShareContent } from "../share";

export function EventShareButton({ content, label = "대회 공유" }: { content: EventShareContent; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  async function share() {
    setBusy(true); setFailed(false); setMessage("");
    try { setMessage(await shareEvent(content)); }
    catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) {
        setFailed(true); setMessage("공유하지 못했습니다. 링크를 복사해 전달해주세요.");
      }
    } finally { setBusy(false); }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(`${content.title}\n${content.description}\n${content.url}`);
      setFailed(false); setMessage("공유할 내용과 링크를 복사했습니다.");
    } catch { setMessage("복사하지 못했습니다. 브라우저 주소를 복사해주세요."); }
  }
  return <div>
    <button type="button" disabled={busy} onClick={() => void share()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#FEE500] px-4 py-2 text-sm font-bold text-[#191919] disabled:opacity-60">
      <Share2 className="h-4 w-4" aria-hidden="true" />{busy ? "공유 준비 중…" : isKakaoShareConfigured() ? `카카오톡 ${label}` : label}
    </button>
    {message && <p role="status" className="mt-2 text-xs">{message}</p>}
    {failed && <button type="button" onClick={() => void copy()} className="mt-1 inline-flex min-h-11 items-center gap-2 text-sm underline"><Copy className="h-4 w-4" aria-hidden="true" />링크 복사</button>}
  </div>;
}
