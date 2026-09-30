"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/hooks/useAuth";
import { inspectionRequest } from "./request";

/** Navigation hints only. Every inspection RPC rechecks this capability in the DB. */
export function useInspectionAccess(enabled = true) {
  const { user, player, initialized } = useAuth();
  const userId = user?.uid;
  const isAdmin = player?.role === "admin";
  const [result, setResult] = useState<{ userId: string; allowed: boolean } | null>(null);

  useEffect(() => {
    if (!enabled || !initialized || !userId || isAdmin) return;
    const controller = new AbortController();
    inspectionRequest(controller.signal, (signal) =>
      supabase.rpc("can_manage_player_inspections").abortSignal(signal),
    ).then(({ data, error }) => {
      if (!controller.signal.aborted) setResult({ userId, allowed: !error && data === true });
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ userId, allowed: false });
    });
    return () => controller.abort();
  }, [enabled, initialized, userId, isAdmin]);

  // Never reuse another signed-in user's permission while the new request runs.
  const current = result?.userId === userId ? result : null;
  return {
    allowed: enabled && !!userId && (isAdmin || current?.allowed === true),
    loading: enabled && (!initialized || (!!userId && !isAdmin && !current)),
  };
}
