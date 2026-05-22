"use client";

import { useEffect, useState } from "react";
import { BellOff, BellRing } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  PUSH_SUPPORTED,
  getPushPermission,
  isCurrentlySubscribed,
  subscribeAndSave,
  unsubscribeAndDelete,
} from "@/lib/push";

type PushState = "loading" | "off" | "on" | "denied";

/**
 * PWA Web Push opt-in 토글 — 헤더의 알림 종 옆에 배치.
 *
 * 비활성화 조건 (아무것도 렌더하지 않음):
 *   - 브라우저가 SW/PushManager 미지원 (Safari iOS PWA 미설치 등)
 *   - 로그인 안 한 사용자 (player 없음)
 *
 * 상태 전이:
 *   off  → 클릭 → 권한 요청 + 구독 + DB 저장 → on (실패 시 denied/off 유지)
 *   on   → 클릭 → 구독 해제 + DB 삭제 → off
 *   denied → 클릭 비활성 (사용자가 브라우저 설정으로만 해제 가능)
 *
 * 토스트 없이 silent transition. sr-only 라이브 영역으로 상태 변화 안내.
 */
export function PushOptInButton() {
  const { player } = useAuth();
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);

  // 초기 마운트 시 권한 + 구독 상태 확인.
  useEffect(() => {
    if (!PUSH_SUPPORTED || !player?.id) return;
    let cancelled = false;
    (async () => {
      const perm = await getPushPermission();
      if (cancelled) return;
      if (perm === "denied") {
        setState("denied");
        return;
      }
      const subscribed = await isCurrentlySubscribed();
      if (cancelled) return;
      // 권한 granted + 구독 있음 → on, 그 외 → off (default 포함).
      setState(perm === "granted" && subscribed ? "on" : "off");
    })();
    return () => {
      cancelled = true;
    };
  }, [player?.id]);

  if (!PUSH_SUPPORTED) return null;
  if (!player?.id) return null;

  const handleClick = async () => {
    if (busy) return;
    if (state === "denied") return;
    setBusy(true);
    if (state === "on") {
      await unsubscribeAndDelete();
      const stillSubscribed = await isCurrentlySubscribed();
      setState(stillSubscribed ? "on" : "off");
    } else if (state === "off") {
      const ok = await subscribeAndSave();
      if (ok) {
        setState("on");
      } else {
        // 권한이 brower 차단으로 굳어진 경우 denied 로 승격.
        const perm = await getPushPermission();
        setState(perm === "denied" ? "denied" : "off");
      }
    }
    setBusy(false);
  };

  const isOn = state === "on";
  const isDenied = state === "denied";
  const isLoading = state === "loading";

  const label = isOn
    ? "푸시 알림 켜짐 — 클릭하여 끄기"
    : isDenied
      ? "푸시 알림 차단됨 — 브라우저 설정에서 허용해주세요"
      : "푸시 알림 켜기";

  const announceText = isOn
    ? "푸시 알림이 켜졌습니다"
    : isDenied
      ? "푸시 알림이 브라우저에서 차단되어 있습니다"
      : "푸시 알림이 꺼져 있습니다";

  return (
    <>
      <button
        type="button"
        aria-label={label}
        title={
          isDenied ? "브라우저 설정에서 알림을 허용해주세요" : label
        }
        aria-pressed={isOn}
        disabled={isDenied || isLoading || busy}
        onClick={handleClick}
        className="relative flex h-10 w-10 items-center justify-center rounded-md hover:bg-[color:var(--color-fg-paper-3,#EEF3FF)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ outlineColor: "var(--color-ring)" }}
      >
        {isOn ? (
          <BellRing
            width={20}
            height={20}
            style={{ color: "var(--primary)" }}
          />
        ) : (
          <BellOff
            width={20}
            height={20}
            style={{
              color: isDenied
                ? "var(--color-fg-ink-ghost, #9aa3b2)"
                : "var(--color-fg-ink)",
            }}
          />
        )}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {announceText}
      </span>
    </>
  );
}
