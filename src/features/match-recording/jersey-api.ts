import { supabase } from "@/config/supabase";
import type { RecordingJersey } from "./jersey-sync";

export async function readRecordingJerseys(teamIds: string[]): Promise<RecordingJersey[]> {
  const { data, error } = await supabase.from("public_match_player_profiles")
    .select("id, team_id, number, number_label").in("team_id", teamIds).retry(false);
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error("등번호를 확인하지 못했습니다.");
  return data.flatMap(row => row.team_id ? [{ id: row.id, teamId: row.team_id, number: row.number, numberLabel: row.number_label }] : []);
}
