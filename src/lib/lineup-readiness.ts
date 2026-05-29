import type { MatchLineupEntry } from "../types";

export interface LineupReadiness {
  ready: boolean;
  starters: number;
  label: string;
}

/** 한 팀의 라인업 제출 상태. 선발(isStarter) 1명 이상이면 준비완료로 간주(스펙 §B 기본값). */
export function computeLineupReadiness(
  teamId: string,
  entries: MatchLineupEntry[]
): LineupReadiness {
  const starters = entries.filter((e) => e.teamId === teamId && e.isStarter).length;
  const ready = starters >= 1;
  return { ready, starters, label: ready ? "준비 완료" : "미제출" };
}
