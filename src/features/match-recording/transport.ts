import { supabase } from "@/config/supabase";
import { rowToEvent, rowToMatch } from "@/lib/mappers";
import type { Database, Json } from "@/lib/database.types";
import type { RecordingCommand, RecordingMatch } from "./model";

type Snapshot = { match: Database["public"]["Tables"]["matches"]["Row"]; lineups: Database["public"]["Tables"]["match_lineups"]["Row"][]; events: Database["public"]["Tables"]["match_events"]["Row"][]; eventOperations: Record<string, string> };
export function decodeSnapshot(value: Json): RecordingMatch {
  const snapshot = value as unknown as Snapshot;
  if (!snapshot?.match?.id || !Array.isArray(snapshot.events)) throw new Error("경기 응답을 확인하지 못했습니다.");
  const events = snapshot.events.map(row => ({ ...rowToEvent(row), id: snapshot.eventOperations?.[row.id] ? `local:${snapshot.eventOperations[row.id]}` : row.id }));
  return { ...rowToMatch(snapshot.match, events), lineups: (snapshot.lineups ?? []).map(l => ({ matchId: l.match_id, teamId: l.team_id, playerId: l.player_id, isStarter: l.is_starter, jerseyNumber: l.jersey_number ?? undefined, jerseyNumberLabel: l.jersey_number_label, createdAt: Date.parse(l.created_at) })), elapsedSeconds: snapshot.match.elapsed_seconds, currentHalf: snapshot.match.current_half === 2 ? 2 : 1, isRunning: snapshot.match.is_running };
}
export async function readSnapshot(matchId: string): Promise<RecordingMatch> {
  const { data, error } = await supabase.rpc("get_match_recording_snapshot", { p_match_id: matchId }).retry(false);
  if (error) throw error;
  return decodeSnapshot(data);
}
export async function sendCommand(matchId: string, command: RecordingCommand): Promise<RecordingMatch> {
  const { data, error } = await supabase.rpc("apply_match_recording_operation", {
    p_operation_id: command.id, p_match_id: matchId, p_kind: command.kind, p_payload: command.payload,
  });
  if (error) throw error;
  return decodeSnapshot(data);
}
