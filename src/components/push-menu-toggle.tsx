"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BellRing, Check, Loader2 } from "lucide-react";
import {
  PUSH_SUPPORTED,
  getPushPermission,
  isCurrentlySubscribed,
  subscribeAndSave,
} from "@/lib/push";

/**
 * 모바일 햄버거 메뉴용 알림 행.
 *
 * 헤더의 종 토글은 `hidden xl:flex` 라 모바일에서 보이지 않는다. 메뉴는
 * 모바일 사용자가 확실히 여는 곳이라 여기에 진입점을 둔다.
 *
 * 바로 켤 수 있으면 그 자리에서 켜고, 켤 수 없는 상태(iOS 미설치·브라우저
 * 차단·미지원)면 설명이 있는 마이페이지로 보낸다. 메뉴 행은 좁아서 해결
 * 방법을 다 적을 수 없기 때문이다.
 */
export function PushMenuToggle({ onNavigate }: { onNavigate: () => void }) {
  const [state, setState] = useState<"loading" | "on" | "off" | "blocked">("loading");
  const [busy, setBusy] = useState(false);

  const sync = useCallback(async () => {
    if (!PUSH_SUPPORTED) {
      setState("blocked");
      return;
    }
    const permission = await getPushPermission();
    if (permission === "denied") {
      setState("blocked");
      return;
    }
    const subscribed = await isCurrentlySubscribed();
    setState(permission === "granted" && subscribed ? "on" : "off");
  }, []);

  useEffect(() => {
    void sync();
  }, [sync]);

  if (state === "loading") return null;

  const rowStyle = {
    fontFamily: "var(--font-body)",
    background: "transparent",
    borderColor: "transparent",
    outlineColor: "var(--color-ring)",
  } as const;
  const rowClass =
    "mt-2 flex w-full items-center justify-between gap-2 border-l-2 px-3 py-3 text-base font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

  // 이미 켜져 있거나(끄기는 오조작 위험이 있어 메뉴에서 처리하지 않는다)
  // 켤 수 없는 상태(iOS 미설치·차단·미지원)면 설명과 끄기가 있는 마이페이지로
  // 보낸다. 메뉴 행은 좁아서 해결 방법을 다 적을 수 없다.
  if (state === "blocked" || state === "on") {
    const on = state === "on";
    return (
      <Link
        href="/my"
        onClick={onNavigate}
        className={rowClass}
        style={{ ...rowStyle, color: on ? "var(--primary)" : "var(--color-fg-blue)" }}
      >
        <span className="flex items-center gap-2">
          {on
            ? <Check className="h-4 w-4" style={{ color: "var(--primary)" }} />
            : <BellRing className="h-4 w-4" style={{ color: "var(--color-fg-ink-ghost)" }} />}
          {on ? "경기·공지 알림 켜짐" : "알림 설정"}
        </span>
        <span className="fg-label" style={{ color: "var(--color-fg-ink-ghost)" }}>→</span>
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (busy) return;
        setBusy(true);
        try {
          // requestPermission 은 사용자 제스처 안에서 호출되어야 한다.
          await subscribeAndSave();
          await sync();
        } finally {
          setBusy(false);
        }
      }}
      className={`${rowClass} disabled:opacity-60`}
      style={{ ...rowStyle, color: "var(--color-fg-blue)" }}
    >
      <span className="flex items-center gap-2">
        {busy
          ? <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--primary)" }} />
          : <BellRing className="h-4 w-4" style={{ color: "var(--primary)" }} />}
        {busy ? "켜는 중..." : "경기·공지 알림 켜기"}
      </span>
      {!busy && <span className="fg-label" style={{ color: "var(--color-fg-ink-ghost)" }}>OFF</span>}
    </button>
  );
}
