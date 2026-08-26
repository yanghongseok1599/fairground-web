export const MATCH_DURATION_MINUTES = 12;
// 슬롯 사이 전환(팀 교대·급수·심판 리셋). 경기 12분 + 전환 8분 = 슬롯 20분.
// 10월 3일 대회 타임테이블이 20분 간격(구장별 15슬롯)으로 짜여 있어 이에 맞춘다.
export const MATCH_TRANSITION_MINUTES = 8;
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
