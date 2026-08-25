"use client";

import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  PUSH_SUPPORTED,
  getPushPermission,
  isCurrentlySubscribed,
  subscribeAndSave,
} from "@/lib/push";

/**
 * 푸시 알림 켜기 유도 배너 (하단 고정).
 *
 * 헤더의 종 토글(PushOptInButton)은 데스크톱(xl) 에서만 보여 모바일에서 노출되지
 * 않으므로, 알림을 아직 켜지 않은 로그인 사용자에게 접속할 때마다 배너로 안내한다.
 *
 * 표시 조건:
 *   - 브라우저가 푸시 지원(SW/PushManager/Notification) — iOS 미설치 Safari 등은 제외
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
  const { player } = useAuth();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!PUSH_SUPPORTED || !player?.id) return;
    if (typeof window === "undefined") return;
    try {
      if (window.sessionStorage.getItem(SESSION_DISMISS_KEY) === "1") return;
    } catch {
      // sessionStorage 사용 불가 환경 — 그냥 진행.
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      const perm = await getPushPermission();
      if (cancelled) return;
      if (perm === "denied") return;
      const subscribed = await isCurrentlySubscribed();
      if (cancelled) return;
      if (perm === "granted" && subscribed) return;
      timer = setTimeout(() => {
        if (!cancelled) setShow(true);
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
    // requestPermission 은 클릭(사용자 제스처) 안에서 호출되어야 한다.
    await subscribeAndSave();
    setBusy(false);
    // 성공(구독됨)이면 다음부터 표시 조건에서 걸러지고, 실패해도 이번 세션은
    // 닫고 다음 접속에 다시 안내한다.
    dismiss();
  };

  if (!show) return null;

  return (
    <div
      role="region"
      aria-label="푸시 알림 켜기 안내"
      className="fixed inset-x-0 bottom-0 z-[58] border-t px-4 py-3 shadow-[0_-8px_24px_rgba(0,71,171,0.12)]"
      style={{
        background: "var(--color-fg-paper, #ffffff)",
        borderColor: "var(--color-fg-line-soft)",
        color: "var(--color-fg-ink)",
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
            알림을 켜면 경기 일정과 중요 공지를 푸시로 바로 받을 수 있어요.
          </p>
        </div>
        <button
          type="button"
          onClick={handleEnable}
          disabled={busy}
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-3.5 py-2 text-xs font-black disabled:opacity-60 sm:text-sm"
          style={{ background: "var(--primary)", color: "var(--primary-foreground, #fff)" }}
        >
          <BellRing width={14} height={14} />
          {busy ? "켜는 중…" : "알림 켜기"}
        </button>
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
