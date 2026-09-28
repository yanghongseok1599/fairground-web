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
import { isSubscriptionSaved, savePushSubscription } from "@/lib/notifications/push-subscription-store";
import type { PushConnectionFailure, PushConnectionResult } from "@/lib/notifications/push-connection-result";
import { getPushEnvironment } from "@/features/tournament-readiness/push-environment";

export const PUSH_SUBSCRIPTION_CHANGED = "fairground:push-subscription-changed";

function notifyPushChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(PUSH_SUBSCRIPTION_CHANGED));
}

/** 브라우저 능력 검사 — Safari iOS PWA 미설치 등에서 false. SSR 안전. */
export const PUSH_SUPPORTED: boolean = getPushEnvironment().supported;

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

export async function getPushPermission(): Promise<NotificationPermission | "unavailable"> {
  // An iOS browser tab cannot inspect a Home Screen app's permission.
  // Unsupported is not evidence that the user blocked notifications.
  if (!PUSH_SUPPORTED) return "unavailable";
  return Notification.permission;
}

export async function requestPushPermission(): Promise<NotificationPermission> {
  if (!PUSH_SUPPORTED) return "denied";
  if (Notification.permission === "granted") return "granted";
  // A user-initiated retry asks the native API again; it still enforces actual denial.
  if (Notification.permission === "denied" && !getPushEnvironment().ios) return "denied";
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

export async function isCurrentlySubscribed(): Promise<boolean> {
  try {
    return await hasSavedPushSubscription();
  } catch {
    return false;
  }
}

/** A browser subscription alone cannot receive this account's tournament alerts. */
export async function hasSavedPushSubscription(expectedUserId?: string): Promise<boolean> {
  // Safari's worker lookup or an account lock can stall without rejecting.
  // This is a read-only check: timing out must never modify a subscription.
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      readSavedPushSubscription(expectedUserId),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("PUSH_STATUS_TIMEOUT")), 10_000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function readSavedPushSubscription(expectedUserId?: string): Promise<boolean> {
  if (!PUSH_SUPPORTED || Notification.permission !== "granted") return false;
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return false;
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user || (expectedUserId && data.user.id !== expectedUserId)) return false;
  const userId = data.user.id;
  const saved = await isSubscriptionSaved(userId, sub);
  return saved && Notification.permission === "granted";
}

/**
 * 권한 요청 → 구독 → DB 저장. 성공 true / 거부·실패 false.
 * 기존 호출자의 boolean 계약을 유지한다. 화면에서는 상세 결과를 사용한다.
 */
export async function subscribeAndSave(): Promise<boolean> {
  return (await connectPush()).ok;
}

export async function connectPush(): Promise<PushConnectionResult> {
  if (!getPushEnvironment().supported) return { ok: false, reason: "unsupported" };
  let stage: PushConnectionFailure = "permission";
  try {
    const perm = await requestPushPermission();
    if (perm !== "granted") return { ok: false, reason: "permission" };
    stage = "worker";
    const reg = await registerPushSw();
    // SW 가 active 가 될 때까지 대기 — 갓 register 한 경우 pushManager.subscribe 가 실패할 수 있다.
    let readyTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) => {
          readyTimer = setTimeout(() => reject(new Error("PUSH_WORKER_TIMEOUT")), 15_000);
        }),
      ]);
    } finally {
      clearTimeout(readyTimer);
    }

    stage = "key";
    // VAPID public key (서버 RPC) — 환경변수에 두지 않음 (스펙).
    const { data: vapidKey, error: vapidErr } = await supabase.rpc(
      // RPC 시그니처는 자동 생성 타입에 없을 수 있어 캐스팅.
      "get_vapid_public_key" as never
    );
    if (vapidErr || typeof vapidKey !== "string" || !vapidKey) {
      return { ok: false, reason: "key" };
    }
    // PushManager.subscribe 는 ArrayBuffer/BufferSource 를 요구.
    // Uint8Array<ArrayBufferLike> 타입 호환을 위해 신선한 ArrayBuffer 로 복사.
    const keyBytes = urlBase64ToUint8Array(vapidKey);
    const applicationServerKey = new ArrayBuffer(keyBytes.byteLength);
    new Uint8Array(applicationServerKey).set(keyBytes);

    stage = "subscription";
    // A persistence retry must reuse the browser subscription without revoking it.
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    }

    stage = "login";
    const { data: userRes, error: authError } = await supabase.auth.getUser();
    const userId = userRes.user?.id;
    if (authError || !userId) return { ok: false, reason: "login" };

    stage = "save";
    if (!await savePushSubscription(userId, sub)) return { ok: false, reason: "account" };
    // Never report ON after the user switched accounts or revoked permission mid-flight.
    stage = "login";
    const { data: current, error: currentError } = await supabase.auth.getUser();
    if (currentError || current.user?.id !== userId) return { ok: false, reason: "login" };
    if (Notification.permission !== "granted") return { ok: false, reason: "permission" };
    return { ok: true };
  } catch {
    // A network/RLS failure is retryable. Do not revoke the existing device subscription here.
    return { ok: false, reason: stage };
  } finally {
    notifyPushChange();
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
  } finally {
    notifyPushChange();
  }
}
