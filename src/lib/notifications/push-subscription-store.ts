import { supabase } from "@/config/supabase";

type SubscriptionKeys = { endpoint: string; p256dh: string; auth: string };

function encodeKey(buffer: ArrayBuffer): string {
  let value = "";
  for (const byte of new Uint8Array(buffer)) value += String.fromCharCode(byte);
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function subscriptionKeys(subscription: PushSubscription): SubscriptionKeys {
  const p256dh = subscription.getKey("p256dh");
  const auth = subscription.getKey("auth");
  if (!p256dh || !auth) throw new Error("PUSH_KEYS_MISSING");
  return { endpoint: subscription.endpoint, p256dh: encodeKey(p256dh), auth: encodeKey(auth) };
}

// Production RLS permits SELECT/INSERT/DELETE, not UPDATE. Keep endpoint ownership intact.
type Query = {
  eq: (column: string, value: string) => Query;
  maybeSingle: () => Promise<{ data: SubscriptionKeys | null; error: unknown }>;
};
const client = supabase as unknown as {
  from: (table: string) => {
    select: (columns: string) => Query;
    upsert: (row: SubscriptionKeys & { user_id: string; user_agent: string }, options: {
      onConflict: string; ignoreDuplicates: boolean;
    }) => Promise<{ error: unknown }>;
  };
};

export async function isSubscriptionSaved(userId: string, subscription: PushSubscription): Promise<boolean> {
  const keys = subscriptionKeys(subscription);
  const { data, error } = await client.from("push_subscriptions")
    .select("endpoint,p256dh,auth").eq("user_id", userId).eq("endpoint", keys.endpoint).maybeSingle();
  if (error) throw error;
  return Boolean(data && data.endpoint === keys.endpoint && data.p256dh === keys.p256dh && data.auth === keys.auth);
}

export async function savePushSubscription(userId: string, subscription: PushSubscription): Promise<boolean> {
  const { error } = await client.from("push_subscriptions").upsert({
    ...subscriptionKeys(subscription), user_id: userId, user_agent: navigator.userAgent,
  }, { onConflict: "endpoint", ignoreDuplicates: true });
  if (error) throw error;
  // DO NOTHING may also mean a conflicting endpoint belongs to another account.
  // Only an RLS-visible row for this account with matching keys establishes delivery.
  return isSubscriptionSaved(userId, subscription);
}
