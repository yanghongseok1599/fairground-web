/** iOS can expose notification APIs in a Safari tab without allowing Web Push. */
export function getPushEnvironment() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { ios: false, installed: false, needsInstall: false, supported: false, browser: "other" as const, inApp: false };
  }
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const installed = Boolean(window.matchMedia?.("(display-mode: standalone)").matches) ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  const needsInstall = ios && !installed;
  const inApp = /KAKAOTALK|NAVER\(| NAVER |Line\/|Instagram|FBAN|FBAV|FB_IAB/i.test(navigator.userAgent);
  const browser = inApp ? "in-app" : /CriOS|Chrome\//i.test(navigator.userAgent) ? "chrome"
    : /Safari\//i.test(navigator.userAgent) && !/FxiOS|EdgiOS|OPiOS/i.test(navigator.userAgent) ? "safari" : "other";
  const supported = !needsInstall && "serviceWorker" in navigator &&
    "PushManager" in window && "Notification" in window;
  return { ios, installed, needsInstall, supported, browser, inApp };
}

export type PushEnvironment = ReturnType<typeof getPushEnvironment>;
