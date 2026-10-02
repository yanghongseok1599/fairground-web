"use client";

import { supabase, isDemoMode } from "@/config/supabase";

const topic = "player-inspection-refresh-v1";
type Listener = { refresh: () => void; connection: (connected: boolean) => void };
const listeners = new Set<Listener>();
let subscribed = false;
let connected = false;
let channel: ReturnType<typeof supabase.channel> | null = null;
let closing: Promise<unknown> | null = null;

function getChannel() {
  return channel ??= supabase.channel(topic, { config: { broadcast: { self: true } } });
}

function closeChannel(current: NonNullable<typeof channel>) {
  channel = null;
  closing = Promise.resolve(supabase.removeChannel(current)).catch(() => {}).finally(() => {
    closing = null;
    if (listeners.size) startSubscription();
  });
}

/** Only an invalidation hint: never broadcast names, dates, IDs or inspection results. */
export function notifyInspectionChange(): void {
  if (isDemoMode || typeof window === "undefined" || closing) return;
  try {
    const sender = getChannel();
    void sender.httpSend("refresh", {}, { timeout: 2_000 }).catch(() => {})
      .finally(() => {
        if (!subscribed && channel === sender) {
          closeChannel(sender);
        }
      });
  } catch { /* Saving succeeded; the polling fallback reconciles missed hints. */ }
}

/** Payloads are untrusted. Receivers always read through their own authorized RPC. */
function startSubscription() {
  if (!subscribed && !closing) {
    subscribed = true;
    const current = getChannel();
    current.on("broadcast", { event: "refresh" }, () => {
      if (channel === current) for (const item of listeners) item.refresh();
    }).subscribe((status) => {
      if (channel !== current) return;
      connected = status === "SUBSCRIBED";
      for (const item of listeners) {
        item.connection(connected);
        if (connected) item.refresh();
      }
    });
  }
}

export function subscribeInspectionChanges(listener: Listener): () => void {
  if (isDemoMode) return () => {};
  listeners.add(listener);
  listener.connection(connected);
  startSubscription();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      const current = channel;
      subscribed = false;
      connected = false;
      if (current) closeChannel(current);
    }
  };
}
