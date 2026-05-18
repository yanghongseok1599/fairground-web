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
 *   - app-shell + 정적/Next 자산 캐시 → 오프라인 graceful degradation
 *   - 동적 데이터(Supabase, Firebase RTDB)는 캐시 절대 금지 → stale 방지
 *   - 오프라인 쓰기 큐는 범위 외 (endMatch 멱등 충돌)
 *
 * kill-switch / 단계 안전:
 *   - CACHE_VERSION 키로 캐시 네임스페이스 격리, activate 시 구 버전 일괄 제거
 *   - install 단계 skipWaiting 자동 호출 안 함 → 클라이언트가 명시 갱신할 때만 교체
 *     (stale 고착 시 sw-register.tsx 의 controllerchange + reload 로 회복)
 */

const CACHE_VERSION = "v1";
const PRECACHE = `fg-precache-${CACHE_VERSION}`;
const RUNTIME_STATIC = `fg-static-${CACHE_VERSION}`;
const RUNTIME_PAGES = `fg-pages-${CACHE_VERSION}`;
const KNOWN_CACHES = [PRECACHE, RUNTIME_STATIC, RUNTIME_PAGES];

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
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
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

  // 3) 문서/내비게이션: NetworkFirst → 실패 시 캐시 → 최종 /offline.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(RUNTIME_PAGES);
          cache.put(req, fresh.clone());
          return fresh;
        } catch {
          const cached = await caches.match(req);
          if (cached) return cached;
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
