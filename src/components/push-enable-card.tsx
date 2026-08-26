"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, BellOff, Check, Loader2, Share } from "lucide-react";
import {
  PUSH_SUPPORTED,
  getPushPermission,
  isCurrentlySubscribed,
  subscribeAndSave,
  unsubscribeAndDelete,
} from "@/lib/push";

/**
 * 알림 켜기 카드 — 상시 노출용.
 *
 * 기존에는 알림을 켤 수 있는 곳이 두 군데뿐이었다.
 *   1) 헤더의 종 토글 — site-header 의 `hidden xl:flex` 안에 있어 데스크톱 전용
 *   2) 하단 세션 배너(PushOptInPrompt) — 닫으면 그 방문 동안 다시 안 뜸
 * 참가자 대부분이 모바일이라 실질적으로 1)은 존재하지 않고, 2)를 한 번 닫으면
 * 되돌아갈 방법이 없었다. 구독자가 2명에 그친 이유다.
 *
 * 이 카드는 닫히지 않으며, 현재 상태(미지원/차단/켜짐/꺼짐)를 그대로 보여주고
 * 각 상태에서 다음에 뭘 해야 하는지 알려준다.
 */

type PushState = "loading" | "unsupported" | "denied" | "on" | "off";

function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  return (
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    // iPadOS 13+ 는 데스크톱 Safari 로 위장한다
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return Boolean(nav.standalone);
}

export function PushEnableCard({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(true);

  const sync = useCallback(async () => {
    if (!PUSH_SUPPORTED) {
      setState("unsupported");
      return;
    }
    const permission = await getPushPermission();
    if (permission === "denied") {
      setState("denied");
      return;
    }
    const subscribed = await isCurrentlySubscribed();
    setState(permission === "granted" && subscribed ? "on" : "off");
  }, []);

  useEffect(() => {
    setIos(isIosDevice());
    setInstalled(isStandalone());
    void sync();
  }, [sync]);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // requestPermission 은 사용자 제스처 안에서 호출되어야 한다.
      if (state === "on") await unsubscribeAndDelete();
      else await subscribeAndSave();
      await sync();
    } finally {
      setBusy(false);
    }
  };

  const shell = compact
    ? "rounded-2xl p-4"
    : "rounded-2xl p-5";
  const box = {
    background: "var(--color-fg-paper)",
    border: "1px solid var(--color-fg-line-soft)",
  };

  if (state === "loading") return null;

  // iOS 는 홈 화면에 추가해야 웹푸시가 동작한다. 설치 전에는 PushManager 자체가
  // 없으므로 '미지원'으로 잡히는데, 사용자에게는 설치하면 된다고 알려야 한다.
  if (state === "unsupported") {
    if (ios && !installed) {
      return (
        <div className={shell} style={box}>
          <div className="flex items-center gap-2">
            <Share className="h-4 w-4" style={{ color: "var(--primary)" }} />
            <h3 className="text-sm font-bold" style={{ color: "var(--color-fg-ink)" }}>
              알림을 받으려면 홈 화면에 추가하세요
            </h3>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--color-fg-ink-muted)" }}>
            iPhone은 홈 화면에 추가한 뒤에만 알림을 받을 수 있습니다.
            사파리 하단 <strong>공유</strong> → <strong>홈 화면에 추가</strong> 를 누르고,
            추가된 아이콘으로 다시 들어와 주세요.
          </p>
        </div>
      );
    }
    return (
      <div className={shell} style={box}>
        <div className="flex items-center gap-2">
          <BellOff className="h-4 w-4" style={{ color: "var(--color-fg-ink-muted)" }} />
          <h3 className="text-sm font-bold" style={{ color: "var(--color-fg-ink)" }}>
            이 브라우저는 알림을 지원하지 않습니다
          </h3>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--color-fg-ink-muted)" }}>
          크롬·사파리 최신 버전에서 다시 시도해 주세요.
        </p>
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className={shell} style={box}>
        <div className="flex items-center gap-2">
          <BellOff className="h-4 w-4" style={{ color: "var(--destructive)" }} />
          <h3 className="text-sm font-bold" style={{ color: "var(--color-fg-ink)" }}>
            알림이 차단되어 있습니다
          </h3>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--color-fg-ink-muted)" }}>
          브라우저 주소창의 자물쇠 아이콘 → 알림 → <strong>허용</strong> 으로 바꾼 뒤
          이 페이지를 새로고침해 주세요.
        </p>
      </div>
    );
  }

  const on = state === "on";
  return (
    <div className={shell} style={box}>
      <div className="flex items-center gap-2">
        {on
          ? <Check className="h-4 w-4" style={{ color: "var(--primary)" }} />
          : <BellRing className="h-4 w-4" style={{ color: "var(--primary)" }} />}
        <h3 className="text-sm font-bold" style={{ color: "var(--color-fg-ink)" }}>
          {on ? "경기·공지 알림 켜짐" : "경기·공지 알림 받기"}
        </h3>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--color-fg-ink-muted)" }}>
        {on
          ? "다음 경기 시작, 대회 공지, 팀 가입 승인 알림을 받고 있습니다."
          : "다음 경기가 언제 시작하는지, 대회 공지가 올라왔는지 바로 알 수 있습니다. 대회 당일 코트 배정 변경도 즉시 전달됩니다."}
      </p>
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={busy}
        className="mt-4 inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl text-sm font-bold transition-opacity disabled:opacity-60"
        style={on
          ? { background: "var(--color-fg-paper)", border: "1px solid var(--color-fg-line-soft)", color: "var(--color-fg-ink-muted)" }
          : { background: "var(--primary)", color: "var(--color-fg-paper)" }}
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {busy ? "처리 중..." : on ? "알림 끄기" : "알림 켜기"}
      </button>
    </div>
  );
}
