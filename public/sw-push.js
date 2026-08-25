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

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    if (event.data) payload = event.data.json();
  } catch {
    // 비정형 페이로드는 무시 — 사용자 가시 알림 의무(userVisibleOnly)는 아래 fallback 으로 충족.
  }
  const title = payload.title || "FairGround";
  const body = payload.body || "새 알림이 있습니다.";
  const url = payload.url || "/";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const sameOrigin = all.filter((c) => {
        try {
          return new URL(c.url).origin === self.location.origin;
        } catch {
          return false;
        }
      });
      if (sameOrigin.length > 0) {
        const client = sameOrigin[0];
        try {
          await client.focus();
          if ("navigate" in client) {
            await client.navigate(targetUrl);
          }
          return;
        } catch {
          // focus/navigate 실패 시 새 창으로 폴백.
        }
      }
      await self.clients.openWindow(targetUrl);
    })()
  );
});
