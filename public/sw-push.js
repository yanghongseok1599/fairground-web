/*
 * FairGround — Web Push Service Worker (Push 결선)
 *
 * 주의: 본 파일은 push + notificationclick 핸들러의 "정본 (source of truth)"이며,
 *   동일 핸들러가 /sw.js 에도 병합 등록되어 있다. 이유:
 *   - 기존 /sw.js 가 이미 scope='/' 를 점유 (P4/ADR-004 app-shell SW)
 *   - 같은 origin 에 2개 SW 를 동일 scope 으로 등록하면 충돌 → 후순위 등록이 기존 SW 를 대체
 *   - 따라서 클라이언트는 /sw.js (병합본) 만 등록하고, 본 파일은 패치 추적용으로 보존한다.
 *   - push.ts 의 registerPushSw() 는 /sw.js 를 register 한다 (별도 등록 금지).
 *
 * 핸들러는 sw.js 의 push/notificationclick 와 동일해야 한다. 변경 시 두 파일 동시 수정.
 */

// Only same-origin destinations may be opened from a notification.
function notificationUrl(value) {
  try {
    const url = new URL(typeof value === "string" ? value : "/", self.location.origin);
    if (url.origin === self.location.origin) return url.pathname + url.search + url.hash;
  } catch { /* malformed or external URL: use the home page */ }
  return "/";
}

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    const data = event.data && event.data.json();
    if (data && typeof data === "object") payload = data;
  } catch { /* Always show a visible fallback notification. */ }
  const title = payload.title || "FairGround";
  const body = payload.body || "새 알림이 있습니다.";
  const url = notificationUrl(payload.url);
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/notification-badge-96.png?v=1",
      // Retries of one notification replace it; different match events remain separate.
      ...(payload.notificationId ? { tag: `fg-notification-${payload.notificationId}` } : {}),
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = notificationUrl(event.notification.data && event.notification.data.url);
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const destination = new URL(targetUrl, self.location.origin).href;
      const exact = all.find((client) => client.url === destination);
      if (exact) {
        try { await exact.focus(); return; } catch { /* Open a new window below. */ }
      }
      // Do not navigate away from a referee, card editor, or other unfinished form.
      const reusable = all.find((client) => {
        try {
          const url = new URL(client.url);
          return url.origin === self.location.origin && ["/", "/live"].includes(url.pathname);
        } catch { return false; }
      });
      if (reusable && "navigate" in reusable) {
        try {
          const navigated = await reusable.navigate(destination);
          if (navigated) { await navigated.focus(); return; }
        } catch { /* A closed client or failed navigation needs a new window. */ }
      }
      await self.clients.openWindow(destination);
    })()
  );
});
