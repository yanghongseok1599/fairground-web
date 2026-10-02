"use client";

import { supabase } from "@/config/supabase";
import { notifyInspectionChange } from "@/lib/inspection-sync";
import { fetchInspectionPlayers } from "./api";
import { normalizeInspectionBirthDate } from "./birth-date";
import { inspectionRequest } from "./request";
import type { InspectionPlayer } from "./types";

export async function saveInspectionBirthDate(tournamentId: string, player: InspectionPlayer, input: string): Promise<void> {
  const birthDate = normalizeInspectionBirthDate(input);
  // Verify current scope and surface edits made since the operator opened the field.
  const current = (await fetchInspectionPlayers(tournamentId, new AbortController().signal))
    .find((item) => item.player_id === player.player_id);
  if (!current || current.team_id !== player.team_id) throw new Error("선수 소속이 변경되었습니다. 최신 명단을 확인해주세요.");
  if (current.birth_date !== player.birth_date) throw new Error("생년월일이 변경되었습니다. 입력을 취소하고 최신 값을 확인해주세요.");
  // Existing RLS permits admins (and a player's own profile) only. No role bypass.
  const { data, error } = await inspectionRequest(new AbortController().signal, (signal) =>
    supabase.from("profiles").update({ birth_date: birthDate }).eq("id", player.player_id)
      .eq("team_id", player.team_id).in("role", ["player", "captain"]).select("id").abortSignal(signal).single());
  if (error || data?.id !== player.player_id) throw new Error("저장하지 못했습니다. 관리자 권한과 연결을 확인한 뒤 최신 명단을 확인해주세요.");
  notifyInspectionChange();
}
