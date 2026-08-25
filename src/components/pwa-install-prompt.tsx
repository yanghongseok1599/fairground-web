"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

/**
 * PWA 설치 유도 프롬프트.
 *
 * iOS Safari Web Push는 홈 화면 추가 후에만 동작하므로, 설치 안내가 iOS 푸시 활성화의 전제 조건.
 *
 * 비표시 조건:
 *   - 이미 standalone 모드 (display-mode: standalone 또는 iOS navigator.standalone)
 *   - 카카오/네이버 등 인앱 브라우저 (InAppBanner 와 중복 방지)
 *   - 7일 이내 디스미스 이력
 *
 * Android/Desktop Chrome: beforeinstallprompt 캡처 → 하단 배너 → 클릭 시 prompt() 호출.
 * iOS Safari/Chrome/Firefox: 정적 안내 모달 (공유 → 홈 화면에 추가).
 *
 * z-index: 55 (InAppBanner z-[60] 보다 낮아 인앱 안내가 우선).
 */

const DISMISS_KEY = "fairground:pwa-prompt:dismissed_at";
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SHOW_DELAY_MS = 5000;

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: ReadonlyArray<string>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

type PromptMode = "android" | "ios" | null;

function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /KAKAOTALK/i.test(ua) ||
    /NAVER\(/i.test(ua) ||
    / NAVER /i.test(ua) ||
    /Line\//i.test(ua) ||
    /Instagram/i.test(ua) ||
    /FBAN|FBAV|FB_IAB/i.test(ua)
  );
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" &&
      (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints! > 1)
  );
}

function isAndroid(): boolean {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

// 설치 안내 배너는 모바일(iOS/Android)에서만 노출한다. 데스크톱(웹)에서는
// beforeinstallprompt 를 preventDefault 로 억제만 하고 배너를 띄우지 않는다.
function isMobileDevice(): boolean {
  return isIOS() || isAndroid();
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return Boolean(nav.standalone);
}

function readDismissedAt(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(DISMISS_KEY);
  return raw ? Number(raw) : 0;
}

function markDismissed(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
}

export function PwaInstallPrompt() {
  const [mode, setMode] = useState<PromptMode>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;
    if (isInAppBrowser()) return;

    const dismissedAt = readDismissedAt();
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_TTL_MS) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const onBeforeInstall = (e: Event) => {
      // 모든 기기에서 브라우저 기본 설치 배너는 억제한다.
      e.preventDefault();
      if (cancelled) return;
      // 데스크톱(웹)에서는 우리 배너도 띄우지 않는다 — 모바일에서만 노출.
      if (!isMobileDevice()) return;
      const evt = e as BeforeInstallPromptEvent;
      setDeferredPrompt(evt);
      timer = setTimeout(() => {
        if (!cancelled) setMode("android");
      }, SHOW_DELAY_MS);
    };

    const onInstalled = () => {
      setMode(null);
      setDeferredPrompt(null);
      markDismissed();
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    // iOS: beforeinstallprompt 이벤트 미발생 → 지연 후 정적 안내 노출
    if (isIOS()) {
      timer = setTimeout(() => {
        if (!cancelled) setMode("ios");
      }, SHOW_DELAY_MS);
    }

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!mode) return null;

  const dismiss = () => {
    markDismissed();
    setMode(null);
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    } catch {
      // 사용자가 prompt 닫거나 브라우저 오류 — 무시하고 디스미스
    } finally {
      markDismissed();
      setDeferredPrompt(null);
      setMode(null);
    }
  };

  if (mode === "android") {
    return (
      <div
        role="region"
        aria-label="앱 설치 안내"
        className="fixed inset-x-0 bottom-0 z-[55] border-t px-4 py-3 shadow-lg"
        style={{
          background: "var(--color-fg-paper, #ffffff)",
          borderColor: "var(--color-fg-line-soft)",
          color: "var(--color-fg-ink)",
        }}
      >
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <div className="flex-1 text-xs leading-snug sm:text-sm">
            <p className="font-semibold">FairGround를 앱처럼 설치하세요.</p>
            <p style={{ color: "var(--color-fg-ink-muted)" }}>
              홈 화면에 추가하면 푸시 알림을 받을 수 있어요.
            </p>
          </div>
          <button
            type="button"
            onClick={handleInstallClick}
            className="inline-flex shrink-0 items-center gap-1 rounded-md px-3 py-2 text-xs font-bold sm:text-sm"
            style={{ background: "var(--primary)", color: "var(--primary-foreground, #fff)" }}
          >
            <Download width={14} height={14} />
            설치
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="설치 안내 닫기 (7일)"
            className="shrink-0 rounded-md p-1.5"
            style={{ color: "var(--color-fg-ink-muted)" }}
          >
            <X width={16} height={16} />
          </button>
        </div>
      </div>
    );
  }

  // iOS 정적 안내
  return (
    <div
      role="region"
      aria-label="iOS 앱 설치 안내"
      className="fixed inset-x-0 bottom-0 z-[55] border-t px-4 py-3 shadow-lg"
      style={{
        background: "var(--color-fg-paper, #ffffff)",
        borderColor: "var(--color-fg-line-soft)",
        color: "var(--color-fg-ink)",
      }}
    >
      <div className="mx-auto flex max-w-5xl items-start gap-3">
        <div className="flex-1 text-xs leading-snug sm:text-sm">
          <p className="font-semibold">iPhone에서 FairGround를 설치하세요</p>
          <p className="mt-1" style={{ color: "var(--color-fg-ink-muted)" }}>
            하단 <Share width={12} height={12} className="inline-block align-text-bottom" />{" "}
            공유 버튼 → <span className="font-semibold">&apos;홈 화면에 추가&apos;</span>를
            눌러주세요. 푸시 알림은 홈 추가 후 활성화됩니다.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="설치 안내 닫기 (7일)"
          className="shrink-0 rounded-md p-1.5"
          style={{ color: "var(--color-fg-ink-muted)" }}
        >
          <X width={16} height={16} />
        </button>
      </div>
    </div>
  );
}
