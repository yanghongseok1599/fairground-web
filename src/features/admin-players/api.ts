"use client";

import { supabase, isDemoMode } from "@/config/supabase";
import type { Player } from "@/types";
import { getPlayerProfilePhotoUrl } from "@/lib/player-profile-photo";

export type ApprovalPlayer = Pick<Player,
  "id" | "name" | "number" | "position" | "role" | "isApproved" |
  "hasPlayerExperience" | "portraitConsentAt" | "createdAt"
>;

// Photos can contain multi-megabyte data URLs. Never include them in the list.
export const APPROVAL_PLAYER_COLUMNS = "id,name,number,position,role,is_approved,has_player_experience,portrait_consent_at,created_at";
export const APPROVAL_LOAD_TIMEOUT_MS = 12_000;

export async function withApprovalDeadline<T>(
  read: (signal: AbortSignal) => PromiseLike<T>,
  signal: AbortSignal,
  timeoutMs = APPROVAL_LOAD_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: () => void = () => {};
  const interrupted = new Promise<never>((_, reject) => {
    onAbort = () => {
      controller.abort();
      reject(new Error("선수 목록 조회가 취소되었습니다."));
    };
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("선수 정보를 불러오는 데 시간이 오래 걸립니다. 연결을 확인하고 다시 시도해주세요."));
    }, timeoutMs);
  });
  try {
    return await Promise.race([interrupted, signal.aborted ? interrupted : read(controller.signal)]);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
  }
}

function demoPlayers(): Player[] {
  return Object.values(JSON.parse(localStorage.getItem("fg_players") || "{}"));
}

export async function fetchApprovalPlayers(signal: AbortSignal): Promise<ApprovalPlayer[]> {
  if (isDemoMode) return demoPlayers().map(({id,name,number,position,role,isApproved,hasPlayerExperience,portraitConsentAt,createdAt}) =>
    ({id,name,number,position,role,isApproved,hasPlayerExperience,portraitConsentAt,createdAt}));
  return withApprovalDeadline(async (requestSignal) => {
    const { data, error } = await supabase.rpc("get_admin_profiles", undefined, { get: true })
      .select(APPROVAL_PLAYER_COLUMNS).abortSignal(requestSignal);
    if (error) throw new Error(error.message);
    if (!Array.isArray(data)) throw new Error("선수 목록 응답을 확인하지 못했습니다. 다시 시도해주세요.");
    return data.map((row) => ({
      id: row.id, name: row.name, number: row.number, position: row.position,
      role: row.role, isApproved: row.is_approved,
      hasPlayerExperience: row.has_player_experience ?? undefined,
      portraitConsentAt: row.portrait_consent_at ? new Date(row.portrait_consent_at).getTime() : undefined,
      createdAt: new Date(row.created_at).getTime(),
    }));
  }, signal);
}

/** Fetch just one player's photo after an administrator explicitly requests it. */
export async function fetchApprovalPhoto(id: string, signal: AbortSignal): Promise<string> {
  if (isDemoMode) return getPlayerProfilePhotoUrl(demoPlayers().find((player) => player.id === id));
  return withApprovalDeadline(async (requestSignal) => {
    const { data, error } = await supabase.rpc("get_admin_profiles", undefined, { get: true })
      .select("photo_url,profile_photo_url,profile_photo_locked").eq("id", id)
      .abortSignal(requestSignal).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("선수 사진을 찾지 못했습니다.");
    return getPlayerProfilePhotoUrl({
      photoUrl: data.photo_url,
      profilePhotoUrl: data.profile_photo_url ?? undefined,
      profilePhotoLocked: data.profile_photo_locked ?? false,
    });
  }, signal);
}
