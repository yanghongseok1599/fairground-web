import { isRosterEvent, type RosterEventType } from "@/features/match-control/roster-stats";
import { matchMinuteFromElapsed } from "@/lib/match-config";
import type { PracticeStore } from "../store";

export type RecordingCommand = { action: "record"; event: RosterEventType; playerId: string } | { action: "cancel"; eventId: string };

/** Resolve the player/team and minute at the authoritative referee, never from a client payload. */
export async function applyRecordingCommand(store: PracticeStore, matchId: string, value: unknown) {
  const s = store.snapshot;
  if (matchId !== s.match.id || s.match.status !== "live") throw new Error("진행 중인 경기 상태를 확인해주세요.");
  if (!value || typeof value !== "object") throw new Error("기록 요청이 올바르지 않습니다.");
  const c = value as RecordingCommand;
  if (c.action === "record" && isRosterEvent(c.event) && typeof c.playerId === "string") {
    const player = s.players.find(p => p.id === c.playerId && !p.hasPlayerExperience);
    if (!player) throw new Error("경기 명단의 선수를 선택해주세요.");
    await store.addMatchEvent(s.match.tournamentId, matchId, { type: c.event, playerId: player.id, playerName: player.name, teamId: player.teamId,
      minute: matchMinuteFromElapsed(s.elapsedSeconds), half: 1 });
  } else if (c.action === "cancel" && typeof c.eventId === "string" && c.eventId.length <= 80) {
    await store.cancelMatchEvent(s.match.tournamentId, matchId, c.eventId);
  } else throw new Error("지원하지 않는 기록 요청입니다.");
}
