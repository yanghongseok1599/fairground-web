"use client";

import { useEffect, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { BrowserLinkHelp } from "@/features/browser-handoff/components/browser-link-help";

const DISMISS_KEY = "fairground:inapp-banner:dismissed";
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000;

type InAppBrowser = "kakao" | "naver" | "line" | "instagram" | "facebook" | null;

function detectInAppBrowser(): InAppBrowser {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent;
  if (/KAKAOTALK/i.test(ua)) return "kakao";
  if (/NAVER\(/i.test(ua) || / NAVER /i.test(ua)) return "naver";
  if (/Line\//i.test(ua)) return "line";
  if (/Instagram/i.test(ua)) return "instagram";
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return "facebook";
  return null;
}

function isAndroid(): boolean {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

function isIOS(): boolean {
  return (
    typeof navigator !== "undefined" &&
    (/iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints! > 1))
  );
}

function readDismissedAt(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    return raw ? Number(raw) : 0;
  } catch {
    return 0;
  }
}

function openInExternalBrowser(): void {
  const url = typeof window !== "undefined" ? window.location.href : "";
  if (!url) return;

  if (isAndroid()) {
    // Chrome으로 강제 오픈 (intent URL)
    const stripped = url.replace(/^https?:\/\//, "");
    window.location.href = `intent://${stripped}#Intent;scheme=https;package=com.android.chrome;end`;
    return;
  }

}

export function InAppBanner() {
  const [visible, setVisible] = useState(false);
  const [browser, setBrowser] = useState<InAppBrowser>(null);
  const [device, setDevice] = useState({ ios: false, android: false });

  useEffect(() => {
    let active = true;
    const b = detectInAppBrowser();
    if (!b) return () => {
      active = false;
    };
    const dismissedAt = readDismissedAt();
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_TTL_MS) {
      return () => {
        active = false;
      };
    }
    queueMicrotask(() => {
      if (!active) return;
      setBrowser(b);
      setDevice({ ios: isIOS(), android: isAndroid() });
      setVisible(true);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!visible) return null;

  const label =
    browser === "kakao"
      ? "카카오톡 인앱 브라우저"
      : browser === "naver"
        ? "네이버 인앱 브라우저"
        : browser === "line"
          ? "라인 인앱 브라우저"
          : browser === "instagram"
            ? "인스타그램 인앱 브라우저"
            : browser === "facebook"
              ? "페이스북 인앱 브라우저"
              : "인앱 브라우저";

  const dismiss = () => {
    if (typeof window !== "undefined") {
      try { window.localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* Dismiss still works when storage is unavailable. */ }
    }
    setVisible(false);
  };

  return (
    <div
      role="region"
      aria-label="외부 브라우저 안내"
      className="fixed inset-x-0 top-0 z-[60] border-b px-4 py-2 text-xs sm:text-sm"
      style={{
        background: "var(--color-fg-paper-3, #EEF3FF)",
        borderColor: "var(--color-fg-line-soft)",
        color: "var(--color-fg-ink)",
      }}
    >
      <div className="mx-auto flex max-w-5xl items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="leading-snug">
            <span className="font-semibold">{label}</span>에서는 푸시 알림을 받을 수 없습니다.{" "}
            {device.ios ? "아이폰 알림은 홈 화면에 추가한 FairGround 앱에서 설정해주세요." : "외부 브라우저에서 알림 설정을 확인해주세요."}
          </p>
          {!device.android && <details className="mt-2">
            <summary className="cursor-pointer py-2 font-bold">외부 브라우저에서 여는 방법</summary>
            <BrowserLinkHelp browserName={device.ios ? "Chrome 또는 Safari" : "브라우저"} />
          </details>}
        </div>
        {device.android && <button
          type="button"
          onClick={openInExternalBrowser}
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-bold"
          style={{ background: "var(--primary)", color: "var(--primary-foreground, #fff)" }}
        >
          <ExternalLink width={14} height={14} />
          외부 브라우저로 열기
        </button>}
        <button
          type="button"
          onClick={dismiss}
          aria-label="배너 닫기 (24시간)"
          className="shrink-0 rounded-md p-1.5"
          style={{ color: "var(--color-fg-ink-muted)" }}
        >
          <X width={14} height={14} />
        </button>
      </div>
    </div>
  );
}
