"use client";

import { useEffect, useState } from "react";
import { supabase, isDemoMode } from "@/config/supabase";
import { useAuth } from "@/hooks/useAuth";
import { missingRequiredConsentKinds } from "@/lib/record-consents";

export const ACCOUNT_CONSENT_PATH = "/auth/complete";

type Client = Parameters<typeof missingRequiredConsentKinds>[0];
const cache = new Map<string, Promise<string[] | null>>();

/** 이 계정에 아직 기록되지 않은 필수 동의(age14·terms·privacy). 모르면 null — 그때는 화면을 막지 않는다. */
export function loadMissingConsents(uid: string): Promise<string[] | null> {
  if (isDemoMode) return Promise.resolve(null);
  let pending = cache.get(uid);
  if (!pending) {
    pending = missingRequiredConsentKinds(supabase as unknown as Client).catch(() => null);
    cache.set(uid, pending);
  }
  return pending;
}

/** 동의를 새로 기록한 뒤 부른다. */
export function forgetMissingConsents(uid: string) {
  cache.delete(uid);
}

export function useMissingConsents(): string[] | null {
  const { user, initialized } = useAuth();
  const uid = initialized ? user?.uid : undefined;
  const [state, setState] = useState<{ uid: string; missing: string[] | null } | null>(null);
  useEffect(() => {
    if (!uid) return;
    let active = true;
    void loadMissingConsents(uid).then((missing) => { if (active) setState({ uid, missing }); });
    return () => { active = false; };
  }, [uid]);
  return uid && state?.uid === uid ? state.missing : null;
}
