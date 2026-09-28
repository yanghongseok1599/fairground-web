import type { MatchEventType } from "@/types";

export interface RecordingFields {
  primaryRefereeId?: string;
  assistantRefereeId?: string;
  clockOperatorId?: string;
  recordingRevision?: number;
  confirmedAt?: number;
}
export interface EventAttribution {
  goalEventId?: string;
  assistChecked?: boolean;
  recordedByName?: string;
}
export interface RecordingInput {
  type: MatchEventType;
  playerId: string;
  playerName: string;
  teamId: string;
  minute: number;
  half: 1 | 2;
  goalEventId?: string;
  requestId?: string;
  actorId?: string;
}
export type RecordingDuty = "admin" | "primary" | "assistant" | "unassigned";
