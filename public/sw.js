/*
 * FairGround — 경량 커스텀 Service Worker (P4 / ADR-004)
 *
 * 채택 사유:
 *   @serwist/next 는 webpack 플러그인이며 Next.js 16 기본 빌드(Turbopack)와 비호환
 *   (빌드 시 "This build is using Turbopack, with a `webpack` config" 오류로 실패).
 *   라이브 프로덕션 빌드 파이프라인(Turbopack)을 변경하지 않기 위해
 *   계획서 P4 폴백 지침대로 경량 커스텀 SW 채택. 빌드 도구 영향 0.
 *
 * 범위(과스코프 금지):
 *   - 정적/Next 자산 캐시 + 오프라인 안내. 경기 기록 화면만 계정 데이터 없는 HTML 셸을 저장
 *   - 동적 데이터(Supabase, Firebase RTDB)는 캐시 절대 금지 → stale 방지
 *   - 쓰기 큐는 앱 IndexedDB에서 관리하며 SW는 POST를 재전송하지 않음
 *
 * kill-switch / 단계 안전:
 *   - CACHE_VERSION 키로 캐시 네임스페이스 격리, activate 시 구 버전 일괄 제거
 *   - install 단계 skipWaiting 자동 호출 안 함 → 클라이언트가 명시 갱신할 때만 교체
 *     (stale 고착 시 sw-register.tsx 의 controllerchange + reload 로 회복)
 */

const CACHE_VERSION = "v4";
const PRECACHE = `fg-precache-${CACHE_VERSION}`;
const RUNTIME_STATIC = `fg-static-${CACHE_VERSION}`;
const RECORDING_SHELL = `fg-recording-shell-${CACHE_VERSION}`;
const KNOWN_CACHES = [PRECACHE, RUNTIME_STATIC, RECORDING_SHELL];

// app-shell 최소 자산. /offline 은 오프라인 문서 폴백.
const PRECACHE_URLS = ["/offline", "/manifest.webmanifest"];

// 동적 데이터 출처 — 절대 캐시 금지(NetworkOnly).
function isDynamicDataRequest(url) {
  const h = url.hostname;
  return (
    h.endsWith(".supabase.co") ||
    h.endsWith(".supabase.in") ||
    h.endsWith(".firebaseio.com") ||
    h.endsWith(".firebasedatabase.app")
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PRECACHE).then((cache) =>
      // 개별 실패가 install 전체를 깨지 않도록 allSettled
      Promise.allSettled(PRECACHE_URLS.map((u) => cache.add(u)))
    )
    // skipWaiting() 자동 호출 안 함 — 제어된 갱신.
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("fg-") && !KNOWN_CACHES.includes(k))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// 클라이언트가 명시적으로 갱신을 요청할 때만 새 SW 활성화 (kill-switch).
// Keep this allowlist aligned with src/features/app-updates/safe-refresh.ts.
function canRefreshClient(pathname) {
  return pathname === "/" || pathname === "/admin/matches" || pathname === "/live" || pathname === "/standings" ||
    pathname === "/leaderboard" || pathname === "/about" || /^\/(tournaments|teams|players)(\/[^/]+)?\/?$/.test(pathname);
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "PREPARE_RECORDING_SHELL" && event.source?.url) {
    const url = new URL(event.source.url);
    if (url.origin === self.location.origin && /^\/admin\/match\/[0-9a-f-]+$/.test(url.pathname)) {
      event.waitUntil(fetch(url.href, { cache: "no-store", headers: { Accept: "text/html" } }).then(async response => {
        if (response.ok && response.headers.get("content-type")?.includes("text/html")) await (await caches.open(RECORDING_SHELL)).put(url.href, response);
      }).catch(() => {}));
    }
  }
  if (event.data && event.data.type === "SKIP_WAITING") {
    // Even an old client may send this message automatically. Never replace the
    // worker while a referee/coach or another editing screen remains open.
    event.waitUntil((async () => {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (clients.every(client => canRefreshClient(new URL(client.url).pathname))) await self.skipWaiting();
    })());
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // GET 외(POST/PUT 등 쓰기)는 절대 개입하지 않음 — endMatch 멱등/Supabase 쓰기 보호.
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // 1) 동적 데이터: NetworkOnly. SW 가 응답을 가로채지 않음(브라우저 기본 동작).
  if (isDynamicDataRequest(url)) return;

  // 2) 동일 출처 /api/*: NetworkOnly (방어적).
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) {
    return;
  }

  // 3) HTML is always fresh. Never restore an obsolete admin or simulation app shell.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(req, { cache: "no-store" });
          if (response.ok && /^\/admin\/match\/[0-9a-f-]+$/.test(url.pathname)) {
            await (await caches.open(RECORDING_SHELL)).put(req, response.clone());
          }
          return response;
        } catch {
          const saved = /^\/admin\/match\/[0-9a-f-]+$/.test(url.pathname) ? await (await caches.open(RECORDING_SHELL)).match(req) : null;
          if (saved) return saved;
          const offline = await caches.match("/offline");
          return (
            offline ||
            new Response("오프라인 상태입니다.", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            })
          );
        }
      })()
    );
    return;
  }

  // 4) Next 정적 빌드 자산(_next/static): CacheFirst (해시 파일명 → 안전).
  if (
    url.origin === self.location.origin &&
    url.pathname.startsWith("/_next/static/")
  ) {
    event.respondWith(cacheFirst(req, RUNTIME_STATIC));
    return;
  }

  // 5) 동일 출처 정적 이미지/폰트/미디어: StaleWhileRevalidate.
  if (
    url.origin === self.location.origin &&
    /\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|otf|mp4|webm)$/i.test(
      url.pathname
    )
  ) {
    event.respondWith(staleWhileRevalidate(req, RUNTIME_STATIC));
    return;
  }

  // 6) 폰트 CDN(Google Fonts / jsdelivr Pretendard): SWR.
  if (
    url.hostname === "fonts.googleapis.com" ||
    url.hostname === "fonts.gstatic.com" ||
    url.hostname === "cdn.jsdelivr.net"
  ) {
    event.respondWith(staleWhileRevalidate(req, RUNTIME_STATIC));
    return;
  }

  // 그 외: 개입 안 함(브라우저 기본 = 네트워크). cross-origin 데이터 stale 방지.
});

async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(req, fresh.clone());
    }
    return fresh;
  } catch {
    return cached || Response.error();
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((res) => {
      if (res && res.status === 200) cache.put(req, res.clone());
      return res;
    })
    .catch(() => undefined);
  return cached || (await network) || Response.error();
}

/*
 * Web Push 핸들러 — sw-push.js 와 동기 유지 (정본은 sw-push.js).
 * 기존 /sw.js 가 이미 scope='/' 점유 → 별도 SW 등록은 충돌하므로 본 SW 에 병합.
 * 페이로드: { title, body, url, kind } (JSON 문자열, push-dispatch Edge Function).
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
