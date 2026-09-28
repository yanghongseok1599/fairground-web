export type TournamentPushState = "loading" | "install" | "unsupported" | "denied" | "off" | "on" | "error";

export function canUseManualTournamentAlerts(state: TournamentPushState, setupFailed = false): boolean {
  return ["install", "unsupported", "denied", "error"].includes(state) || (state === "off" && setupFailed);
}

export function canSaveWithTournamentAlerts(state: TournamentPushState, fallbackAcknowledged: boolean, setupFailed = false): boolean {
  return state === "on" || (canUseManualTournamentAlerts(state, setupFailed) && fallbackAcknowledged);
}

export const TOURNAMENT_ALERTS_REQUIRED = "대회 알림을 켜주세요. 설정이 어려우면 경기 진행을 직접 확인하는 항목에 동의한 뒤 선수등록을 계속할 수 있습니다.";
