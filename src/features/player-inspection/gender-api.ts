"use client";

import { supabase } from "@/config/supabase";
import { notifyInspectionChange } from "@/lib/inspection-sync";
import { fetchInspectionPlayers } from "./api";
import { normalizeInspectionGender } from "./gender";
import { inspectionRequest } from "./request";
import type { InspectionPlayer } from "./types";

// Gender is private: use the existing admin-only RPC, never a public profile view.
// Project only these small fields; do not download inline photos on every refresh.
export async function fetchInspectionPlayersWithGender(tournamentId: string, signal: AbortSignal): Promise<InspectionPlayer[]> {
  const players = await fetchInspectionPlayers(tournamentId, signal);
  const genders = new Map<string, string | null>();
  // Keep each URL within practical limits and below the API's row cap.
  for (let start = 0; start < players.length; start += 100) {
    const ids = players.slice(start, start + 100).map((player) => player.player_id);
    const { data, error } = await inspectionRequest(signal, (requestSignal) =>
      supabase.rpc("get_admin_profiles", undefined, { get: true }).select("id,gender")
        .in("id", ids).abortSignal(requestSignal).retry(false));
    if (error || !Array.isArray(data)) throw new Error("성별 정보를 불러오지 못했습니다. 관리자 권한과 연결을 확인해주세요.");
    for (const row of data) genders.set(row.id, row.gender);
  }
  return players.map((player) => {
    if (!genders.has(player.player_id)) throw new Error("선수 정보가 변경되었습니다. 명단을 다시 불러와주세요.");
    return { ...player, gender: genders.get(player.player_id)! };
  });
}

export async function saveInspectionGender(tournamentId: string, player: InspectionPlayer, input: string): Promise<void> {
  const gender = normalizeInspectionGender(input);
  const current = (await fetchInspectionPlayersWithGender(tournamentId, new AbortController().signal))
    .find((item) => item.player_id === player.player_id);
  if (!current || current.team_id !== player.team_id) throw new Error("선수 소속이 변경되었습니다. 최신 명단을 확인해주세요.");
  if (player.gender === undefined || current.gender !== player.gender) throw new Error("성별이 변경되었습니다. 입력을 취소하고 최신 값을 확인해주세요.");
  // Existing RLS enforces admin/own-profile writes. The pre-read is not atomic CAS:
  // private gender has no direct SELECT grant and must stay behind the admin RPC.
  const { data, error } = await inspectionRequest(new AbortController().signal, (signal) =>
    supabase.from("profiles").update({ gender }).eq("id", player.player_id)
      .eq("team_id", player.team_id).in("role", ["player", "captain"]).select("id").abortSignal(signal).single());
  if (error || data?.id !== player.player_id) throw new Error("저장하지 못했습니다. 관리자 권한과 연결을 확인한 뒤 최신 명단을 확인해주세요.");
  notifyInspectionChange();
}
