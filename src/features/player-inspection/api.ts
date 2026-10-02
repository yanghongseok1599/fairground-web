"use client";

import { supabase } from "@/config/supabase";
import { notifyInspectionChange } from "@/lib/inspection-sync";
import { inspectionRequest } from "./request";
import type { InspectionPlayer, InspectionTournament, MyInspection } from "./types";

function rows<T>(data: T[] | null, error: { message: string } | null): T[] {
  if (error) throw new Error(error.message);
  if (!Array.isArray(data)) throw new Error("검인 정보를 확인하지 못했습니다. 다시 불러와주세요.");
  return data;
}

export async function fetchInspectionTournaments(signal: AbortSignal): Promise<InspectionTournament[]> {
  const { data, error } = await inspectionRequest(signal, (requestSignal) => supabase.from("tournaments").select("id,name,date,status")
    .order("created_at", { ascending: false }).abortSignal(requestSignal));
  return rows(data, error).sort((a, b) => Number(b.status === "ongoing") - Number(a.status === "ongoing")
    || Number(a.status === "completed") - Number(b.status === "completed"));
}

export async function fetchInspectionPlayers(tournamentId: string, signal: AbortSignal): Promise<InspectionPlayer[]> {
  const { data, error } = await inspectionRequest(signal, (requestSignal) => supabase.rpc("get_admin_player_inspections", { p_tournament_id: tournamentId }).abortSignal(requestSignal));
  return rows(data, error);
}

export async function fetchMyInspections(signal: AbortSignal): Promise<MyInspection[]> {
  const { data, error } = await inspectionRequest(signal, (requestSignal) => supabase.rpc("get_my_player_inspections").abortSignal(requestSignal));
  return rows(data, error);
}

export async function saveInspection(tournamentId: string, player: InspectionPlayer, checked: boolean): Promise<void> {
  const { data, error } = await inspectionRequest(new AbortController().signal, (requestSignal) => supabase.rpc("set_player_inspection", {
    p_tournament_id: tournamentId, p_player_id: player.player_id,
    p_checked: checked, p_expected_revision: player.revision,
  }).abortSignal(requestSignal));
  if (error) throw new Error(error.message);
  if (typeof data !== "number" || data !== player.revision + 1) throw new Error("저장 결과를 확인하지 못했습니다. 새로고침 후 확인해주세요.");
  notifyInspectionChange();
}
