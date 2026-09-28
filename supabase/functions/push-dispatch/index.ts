import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { notificationPushPayload, type PushNotificationRecord } from "../_shared/notification-target.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  // 1. config 로드 (VAPID + webhook secret)
  const { data: cfg, error: cfgErr } = await admin
    .from("app_push_config")
    .select("vapid_public, vapid_private, subject, webhook_secret")
    .eq("id", true)
    .maybeSingle();
  if (cfgErr || !cfg) {
    return new Response(JSON.stringify({ error: "config missing" }), { status: 500 });
  }

  // 2. 인증
  const provided = req.headers.get("x-webhook-secret");
  if (!provided || provided !== cfg.webhook_secret) {
    return new Response("forbidden", { status: 403 });
  }

  // 3. 페이로드
  const body = (await req.json().catch(() => null)) as { record?: PushNotificationRecord } | null;
  const n = body?.record;
  if (!n || !n.user_id) {
    return new Response("invalid payload", { status: 400 });
  }

  // 4. 구독 조회
  const { data: subs, error: subsErr } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", n.user_id);
  if (subsErr) {
    return new Response(JSON.stringify({ error: subsErr.message }), { status: 500 });
  }
  if (!subs || subs.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: "no subscriptions" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // 5. web-push 설정
  webpush.setVapidDetails(cfg.subject, cfg.vapid_public, cfg.vapid_private);

  // 6. 푸시 발사 (각각 try)
  const payload = JSON.stringify(notificationPushPayload(n));

  let sent = 0;
  const stale: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 60 * 60 * 24 }
        );
        sent += 1;
      } catch (e) {
        const code = (e as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) {
          stale.push(s.id);
        } else {
          console.error("push fail", code); // Do not log subscription URLs or provider response secrets.
        }
      }
    })
  );

  // 7. stale 구독 정리
  if (stale.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", stale);
  }

  return new Response(JSON.stringify({ sent, removed: stale.length }), {
    headers: { "Content-Type": "application/json" },
  });
});
