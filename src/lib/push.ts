"use client";

/**
 * FairGround Web Push 클라 헬퍼 (Push 결선).
 *
 * 서버 측 (이미 라이브 / 변경 금지):
 *   - DB: push_subscriptions(endpoint UNIQUE, p256dh, auth, user_agent, user_id, ...)
 *         RLS: 본인 select/insert/delete 만 허용
 *   - RPC: get_vapid_public_key() returns text  (anon/authenticated 모두 호출 가능)
 *   - 트리거: notifications insert → Edge Function push-dispatch 자동 호출
 *
 * SW 등록 전략:
 *   - 기존 /sw.js 가 이미 scope='/' 를 점유 → push/notificationclick 핸들러는 /sw.js 에 병합 완료.
 *   - 본 헬퍼는 /sw.js 를 (idempotent하게) register 하여 그 registration 의 pushManager 를 사용.
 *
 * 타입 메모:
 *   database.types.ts 는 자동 생성 결과로 push_subscriptions / get_vapid_public_key 가 아직 포함되지 않아
 *   typed Supabase 클라이언트에서 unknown 으로 처리된다. 스키마 변경은 본 작업 범위 외이므로
 *   해당 호출은 명시 캐스팅으로 우회한다 (런타임 안전, 서버 RLS 가 최종 강제).
 */

import { supabase } from "@/config/supabase";

/** 브라우저 능력 검사 — Safari iOS PWA 미설치 등에서 false. SSR 안전. */
export const PUSH_SUPPORTED: boolean =
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

/**
 * 기존 /sw.js 를 등록 (이미 등록되어 있다면 동일 등록 반환).
 * SwRegister 가 production 에서만 /sw.js 를 등록하므로, 본 호출이 dev 에서도
 * push 테스트를 가능하게 하는 역할도 겸한다. scope='/' 충돌은 동일 url 재등록이므로 없음.
 */
export async function registerPushSw(): Promise<ServiceWorkerRegistration> {
  if (!PUSH_SUPPORTED) {
    throw new Error("PUSH_UNSUPPORTED");
  }
  // 이미 ready 한 registration 이 있으면 그것을 우선 사용 (불필요한 재등록 방지).
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) {
    return existing;
  }
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

export async function getPushPermission(): Promise<NotificationPermission> {
  if (!PUSH_SUPPORTED) return "denied";
  return Notification.permission;
}

export async function requestPushPermission(): Promise<NotificationPermission> {
  if (!PUSH_SUPPORTED) return "denied";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return Notification.requestPermission();
}

/**
 * VAPID public key (urlBase64) → Uint8Array.
 * 표준 web-push 변환 패턴 (PushManager.subscribe applicationServerKey 요구).
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** ArrayBuffer → base64url (DB 저장용 — p256dh / auth 키). */
function arrayBufferToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function isCurrentlySubscribed(): Promise<boolean> {
  if (!PUSH_SUPPORTED) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    return sub !== null;
  } catch {
    return false;
  }
}

/**
 * 권한 요청 → 구독 → DB 저장. 성공 true / 거부·실패 false.
 * upsert(onConflict: 'endpoint') 로 멱등: 같은 기기 재구독 시 row 중복 방지.
 */
export async function subscribeAndSave(): Promise<boolean> {
  if (!PUSH_SUPPORTED) return false;

  const perm = await requestPushPermission();
  if (perm !== "granted") return false;

  try {
    const reg = await registerPushSw();
    // SW 가 active 가 될 때까지 대기 — 갓 register 한 경우 pushManager.subscribe 가 실패할 수 있다.
    await navigator.serviceWorker.ready;

    // VAPID public key (서버 RPC) — 환경변수에 두지 않음 (스펙).
    const { data: vapidKey, error: vapidErr } = await supabase.rpc(
      // RPC 시그니처는 자동 생성 타입에 없을 수 있어 캐스팅.
      "get_vapid_public_key" as never
    );
    if (vapidErr || typeof vapidKey !== "string" || !vapidKey) {
      return false;
    }
    // PushManager.subscribe 는 ArrayBuffer/BufferSource 를 요구.
    // Uint8Array<ArrayBufferLike> 타입 호환을 위해 신선한 ArrayBuffer 로 복사.
    const keyBytes = urlBase64ToUint8Array(vapidKey);
    const applicationServerKey = new ArrayBuffer(keyBytes.byteLength);
    new Uint8Array(applicationServerKey).set(keyBytes);

    // 기존 구독이 있고 keys 가 동일하면 재사용, 아니면 새로 구독.
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    }

    const p256dhBuf = sub.getKey("p256dh");
    const authBuf = sub.getKey("auth");
    if (!p256dhBuf || !authBuf) return false;

    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes.user?.id;
    if (!userId) return false;

    const row = {
      user_id: userId,
      endpoint: sub.endpoint,
      p256dh: arrayBufferToBase64Url(p256dhBuf),
      auth: arrayBufferToBase64Url(authBuf),
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    };

    // typed client 는 push_subscriptions 를 모르므로 from 을 캐스팅.
    const { error: upsertErr } = await (
      supabase as unknown as {
        from: (t: string) => {
          upsert: (
            v: Record<string, unknown>,
            opts: { onConflict: string }
          ) => Promise<{ error: { message: string } | null }>;
        };
      }
    )
      .from("push_subscriptions")
      .upsert(row, { onConflict: "endpoint" });

    if (upsertErr) {
      // DB 저장 실패 시 푸시 구독은 살아있어 서버는 아무것도 못 보냄 → 정리.
      try {
        await sub.unsubscribe();
      } catch {
        /* noop */
      }
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * 푸시 구독 해제 + DB row 삭제.
 * 어느 한 쪽 실패해도 가능한 쪽은 끝까지 진행 (정합성 회복).
 */
export async function unsubscribeAndDelete(): Promise<void> {
  if (!PUSH_SUPPORTED) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    if (!reg) return;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    const endpoint = sub.endpoint;
    try {
      await sub.unsubscribe();
    } catch {
      /* 푸시 해제 실패해도 DB 정리는 계속 */
    }
    await (
      supabase as unknown as {
        from: (t: string) => {
          delete: () => {
            eq: (
              c: string,
              v: string
            ) => Promise<{ error: { message: string } | null }>;
          };
        };
      }
    )
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", endpoint);
  } catch {
    /* noop — UI 가 다음 mount 에서 상태 재확인 */
  }
}
