import type { Match, MatchEvent } from "@/types";
import type { RecordingDuty } from "./types";

export function recordingDuty(match: Match, actorId: string | undefined, isAdmin: boolean): RecordingDuty {
  if (isAdmin) return "admin";
  if (actorId && actorId === match.primaryRefereeId) return "primary";
  if (actorId && actorId === match.assistantRefereeId) return "assistant";
  return "unassigned";
}
export function uncheckedGoals(events: MatchEvent[]) {
  return events.filter(e => e.type === "goal" && !e.isCancelled && !e.assistChecked);
}
