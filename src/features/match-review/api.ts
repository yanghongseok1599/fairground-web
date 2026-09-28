import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/config/supabase";
import type { Database } from "@/lib/database.types";
import type { RecordingInput } from "./types";

// Keep pending migration types at the feature boundary until generated types are refreshed.
type RecordingDatabase = Database & { public: { Functions: {
  claim_match_recording_role: { Args: { p_match_id: string; p_role: string }; Returns: undefined };
  check_goal_without_assist: { Args: { p_match_id: string; p_goal_event_id: string }; Returns: undefined };
  reopen_goal_assist: { Args: { p_match_id: string; p_goal_event_id: string }; Returns: undefined };
  confirm_match_recording: { Args: { p_match_id: string; p_expected_revision: number; p_mom_player_id?: string | null }; Returns: undefined };
  record_match_event: { Args: { p_match_id: string; p_request_id: string; p_type: RecordingInput["type"]; p_player_id: string; p_player_name: string; p_team_id: string; p_minute: number; p_half: number; p_goal_event_id?: string; p_actor_id?: string }; Returns: string };
} } };
const client = supabase as unknown as SupabaseClient<RecordingDatabase>;

export const recordingApi = {
  async record(matchId: string, event: RecordingInput) {
    const { error } = await client.rpc("record_match_event", { p_match_id: matchId,
      p_request_id: event.requestId ?? crypto.randomUUID(), p_type: event.type,
      p_player_id: event.playerId, p_player_name: event.playerName, p_team_id: event.teamId,
      p_minute: event.minute, p_half: event.half, p_goal_event_id: event.goalEventId, p_actor_id: event.actorId,
    });
    if (error) throw new Error(error.message);
  },
  async claim(matchId: string, duty: "primary" | "assistant") {
    const { error } = await client.rpc("claim_match_recording_role", { p_match_id: matchId, p_role: duty });
    if (error) throw new Error(error.message);
  },
  async noAssist(matchId: string, goalId: string) {
    const { error } = await client.rpc("check_goal_without_assist", { p_match_id: matchId, p_goal_event_id: goalId });
    if (error) throw new Error(error.message);
  },
  async reopenAssist(matchId: string, goalId: string) {
    const { error } = await client.rpc("reopen_goal_assist", { p_match_id: matchId, p_goal_event_id: goalId });
    if (error) throw new Error(error.message);
  },
  async confirm(matchId: string, revision: number, momPlayerId?: string | null) {
    const { error } = await client.rpc("confirm_match_recording", { p_match_id: matchId, p_expected_revision: revision, p_mom_player_id: momPlayerId });
    if (error) throw new Error(error.message);
  },
};
