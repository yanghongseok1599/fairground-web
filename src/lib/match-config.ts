export const MATCH_DURATION_MINUTES = 12;
// 경기 시작 간격: 경기 12분 + 팀 교대·급수 3분 + 장비 점검·준비 5분 = 20분.
export const MATCH_TRANSITION_MINUTES = 8;
export const MATCH_REPORT_LEAD_MINUTES = 5;
export const MATCH_DURATION_SECONDS = MATCH_DURATION_MINUTES * 60;
export const MATCH_SLOT_MINUTES = MATCH_DURATION_MINUTES + MATCH_TRANSITION_MINUTES;
export const MATCH_DURATION_LABEL = `단일 ${MATCH_DURATION_MINUTES}분`;

export function clampMatchElapsedSeconds(seconds: number): number {
  if (!Number.isFinite(seconds)) return 0;
  return Math.max(0, Math.min(MATCH_DURATION_SECONDS, Math.floor(seconds)));
}

export function matchMinuteFromElapsed(seconds: number): number {
  return Math.floor(clampMatchElapsedSeconds(seconds) / 60);
}
