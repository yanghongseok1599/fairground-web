import type { Match } from "@/types";
import { shootoutScoreError } from "./model";

export interface RecordedShootoutAttempts { home: boolean[]; away: boolean[] }

/** Stored attempts contain actual O/X selections only; old totals have no inferred history. */
export function readShootoutAttempts(home: unknown, away: unknown): RecordedShootoutAttempts | undefined {
  const valid = (value: unknown): value is boolean[] => Array.isArray(value) && value.length <= 99 && value.every(kick => typeof kick === "boolean");
  return valid(home) && valid(away) ? { home: [...home], away: [...away] } : undefined;
}

export function shootoutRecordingError(home: number, away: number, attempts?: RecordedShootoutAttempts, status?: Match["status"]): string | undefined {
  if (!attempts) return shootoutScoreError(home, away);
  const checked = readShootoutAttempts(attempts.home, attempts.away);
  if (!checked || checked.home.length + checked.away.length === 0) return "회차별 O/X 기록을 확인해주세요.";
  if (checked.home.filter(Boolean).length !== home || checked.away.filter(Boolean).length !== away) return "승부차기 합계와 회차별 기록이 다릅니다.";
  if (status === "finished") return shootoutScoreError(home, away);
}

/** Compare the order as well as the totals so an O/X correction cannot overwrite another device. */
export function shootoutRecordingPayload(match: Match, homeScore: number, awayScore: number, attempts?: RecordedShootoutAttempts) {
  return {
    homeScore, awayScore,
    _shootoutHomeBefore: match.homeShootoutScore ?? -1,
    _shootoutAwayBefore: match.awayShootoutScore ?? -1,
    ...(attempts ? {
      homeAttempts: [...attempts.home], awayAttempts: [...attempts.away],
      _shootoutHomeAttemptsBefore: match.homeShootoutAttempts ?? null,
      _shootoutAwayAttemptsBefore: match.awayShootoutAttempts ?? null,
    } : {}),
  };
}
