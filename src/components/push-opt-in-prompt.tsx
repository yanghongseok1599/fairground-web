"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { BellRing, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { PUSH_CONNECTION_MESSAGE } from "@/lib/notifications/push-connection-result";
import { getPushEnvironment } from "@/features/tournament-readiness/push-environment";
import {
  PUSH_SUPPORTED,
  getPushPermission,
  isCurrentlySubscribed,
  connectPush,
} from "@/lib/push";

/**
 * 푸시 알림 켜기 유도 배너 (하단 고정).
 *
 * 헤더의 종 토글(PushOptInButton)은 데스크톱(xl) 에서만 보여 모바일에서 노출되지
 * 않으므로, 알림을 아직 켜지 않은 로그인 사용자에게 접속할 때마다 배너로 안내한다.
 *
 * 표시 조건:
 *   - 푸시 지원 브라우저 또는 홈 화면 설치가 필요한 iOS (설정 방법으로 연결)
 *   - 로그인 상태 (player 있음)
 *   - 아직 구독하지 않음 (권한 granted + 구독 보유가 아닌 경우)
 *   - 권한이 'denied'(브라우저 차단)가 아님 — 차단 상태면 클릭해도 켤 수 없어 숨김
 *
 * 노출 빈도: 세션당 1회(닫으면 그 방문 동안은 숨김). 다음 접속(새 세션)마다 다시 노출.
 * 한 번 켜면 구독되어 더 이상 뜨지 않는다.
 */

const SESSION_DISMISS_KEY = "fairground:push-prompt:dismissed-session";
const SHOW_DELAY_MS = 1500;

export function PushOptInPrompt() {
  const pathname = usePathname();
  const { player } = useAuth();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [needsInstall, setNeedsInstall] = useState(false);

  useEffect(() => {
    if (!player?.id) return;
    if (typeof window === "undefined") return;
    const device = getPushEnvironment();
    if (!PUSH_SUPPORTED && !device.needsInstall) return;
    try {
      if (window.sessionStorage.getItem(SESSION_DISMISS_KEY) === "1") return;
    } catch {
      // sessionStorage 사용 불가 환경 — 그냥 진행.
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      // Safari tabs need an installation guide, even if notification APIs exist.
      if (!device.needsInstall) {
        const perm = await getPushPermission();
        if (cancelled || perm === "denied") return;
        const subscribed = await isCurrentlySubscribed();
        if (cancelled || (perm === "granted" && subscribed)) return;
      }
      timer = setTimeout(() => {
        if (!cancelled) {
          setNeedsInstall(device.needsInstall);
          setShow(true);
        }
      }, SHOW_DELAY_MS);
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [player?.id]);

  const dismiss = () => {
    try {
      window.sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
    } catch {
      // 무시
    }
    setShow(false);
  };

  const handleEnable = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    // requestPermission 은 클릭(사용자 제스처) 안에서 호출되어야 한다.
    const result = await connectPush();
    setBusy(false);
    if (result.ok) dismiss();
    else setError(PUSH_CONNECTION_MESSAGE[result.reason]);
  };

  // These pages already contain a persistent, actionable readiness checklist.
  if (!show || !player?.id || pathname === "/my" || pathname.startsWith("/my/") ||
    /^\/(admin|referee)\/match\//.test(pathname)) return null;

  return (
    <div
      role="region"
      aria-label="푸시 알림 켜기 안내"
      className="fixed inset-x-0 bottom-0 z-[58] border-t px-4 py-3 shadow-[0_-8px_24px_rgba(0,71,171,0.12)]"
      style={{
        background: "var(--color-fg-paper, #ffffff)",
        borderColor: "var(--color-fg-line-soft)",
        color: "var(--color-fg-ink)",
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="mx-auto flex max-w-5xl items-center gap-3">
        <div
          className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full sm:flex"
          style={{ background: "var(--color-fg-paper-3, #EEF3FF)" }}
        >
          <BellRing width={18} height={18} style={{ color: "var(--primary)" }} />
        </div>
        <div className="flex-1 text-xs leading-snug sm:text-sm">
          <p className="font-bold">경기·공지 알림을 받아보세요.</p>
          <p style={{ color: "var(--color-fg-ink-muted)" }}>
            {needsInstall
              ? "아이폰은 홈 화면에 추가한 FairGround 앱에서 알림을 켤 수 있어요."
              : "알림을 켜면 경기 일정과 중요 공지를 푸시로 바로 받을 수 있어요."}
          </p>
          {error && <p role="alert" className="mt-1 text-destructive">{error}</p>}
        </div>
        {needsInstall ? <Link
          href="/my#participant-readiness"
          className="inline-flex min-h-11 shrink-0 items-center rounded-md px-3.5 py-2 text-xs font-black sm:text-sm"
          style={{ background: "var(--primary)", color: "var(--primary-foreground, #fff)" }}
        >설정 방법</Link> : <button
          type="button"
          onClick={handleEnable}
          disabled={busy}
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-3.5 py-2 text-xs font-black disabled:opacity-60 sm:text-sm"
          style={{ background: "var(--primary)", color: "var(--primary-foreground, #fff)" }}
        >
          <BellRing width={14} height={14} />
          {busy ? "켜는 중…" : "알림 켜기"}
        </button>}
        <button
          type="button"
          onClick={dismiss}
          aria-label="알림 안내 닫기"
          className="shrink-0 rounded-md p-1.5"
          style={{ color: "var(--color-fg-ink-muted)" }}
        >
          <X width={16} height={16} />
        </button>
      </div>
    </div>
  );
}
