"use client";

import { useEffect, useState } from "react";
import { ExternalLink, X } from "lucide-react";

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
  const raw = window.localStorage.getItem(DISMISS_KEY);
  return raw ? Number(raw) : 0;
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

  if (isIOS()) {
    // iOS Chrome scheme. Chrome 미설치면 Safari fallback — clipboard copy + 안내.
    const httpsUrl = url.startsWith("https://") ? url : `https://${url.replace(/^http:\/\//, "")}`;
    const chromeUrl = httpsUrl.replace(/^https:\/\//, "googlechromes://");
    const beforeNav = Date.now();
    window.location.href = chromeUrl;
    // Chrome 미설치 시 fallback — 500ms 후 여전히 같은 페이지면 클립보드 안내
    setTimeout(() => {
      if (Date.now() - beforeNav < 1500) {
        navigator.clipboard?.writeText(httpsUrl).catch(() => undefined);
        alert("URL이 복사되었습니다. Safari를 열어 붙여넣기 해주세요.");
      }
    }, 500);
    return;
  }

  // 데스크톱이거나 미지원 OS — 단순 클립보드 복사
  navigator.clipboard?.writeText(url).catch(() => undefined);
  alert("URL이 복사되었습니다. 다른 브라우저에서 열어주세요.");
}

export function InAppBanner() {
  const [visible, setVisible] = useState(false);
  const [browser, setBrowser] = useState<InAppBrowser>(null);

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
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
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
      <div className="mx-auto flex max-w-5xl items-center gap-3">
        <p className="flex-1 leading-snug">
          <span className="font-semibold">{label}</span>에서는 푸시 알림이 동작하지 않습니다.
          Chrome/Safari에서 열면 알림을 받을 수 있어요.
        </p>
        <button
          type="button"
          onClick={openInExternalBrowser}
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-bold"
          style={{ background: "var(--primary)", color: "var(--primary-foreground, #fff)" }}
        >
          <ExternalLink width={14} height={14} />
          외부 브라우저로 열기
        </button>
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
