"use client";

import { useEffect } from "react";

/**
 * Service Worker 등록 — 프로덕션에서만 (P4 / ADR-004).
 *
 * 안전 설계:
 *  - process.env.NODE_ENV === "production" 일 때만 등록 → dev 캐시 stale/디버깅 방해 방지.
 *  - 새 SW 감지 시 자동 skipWaiting 하지 않고, 설치 완료 후 SKIP_WAITING 메시지로
 *    제어된 교체 → controllerchange 에서 1회 reload 로 최신 app-shell 반영(stale 고착 회복).
 *  - 등록 실패는 콘솔 경고만 — 앱 동작에 영향 없음(점진적 향상).
 */
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let reloaded = false;

    const onControllerChange = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange
    );

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        // 대기 중 SW 가 이미 있으면 즉시 활성화 요청.
        if (reg.waiting) {
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
        }
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (
              installing.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              // 갱신 설치 완료 → 제어된 교체.
              reg.waiting?.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });
      })
      .catch((err) => {
        console.warn("[sw] registration failed", err);
      });

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange
      );
    };
  }, []);

  return null;
}
