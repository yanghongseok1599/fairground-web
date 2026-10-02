"use client";
import { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { syncRecordings } from "./engine";

/** Mounted once: recordings from prior matches also drain when the user leaves a match. */
export function RecordingSyncService() {
  const actorId = useAuthStore(s => s.user?.uid);
  useEffect(() => {
    if (!actorId) return;
    const tick = () => { void syncRecordings(actorId); };
    const reconnect = () => { void syncRecordings(actorId, true); };
    tick();
    const interval = window.setInterval(tick, 5000);
    window.addEventListener("online", reconnect);
    window.addEventListener("focus", reconnect);
    window.addEventListener("fg-recording-enqueued", tick);
    return () => { clearInterval(interval); window.removeEventListener("online", reconnect); window.removeEventListener("focus", reconnect); window.removeEventListener("fg-recording-enqueued", tick); };
  }, [actorId]);
  return null;
}
