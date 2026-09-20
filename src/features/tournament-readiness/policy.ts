export type TournamentPushState = "loading" | "install" | "unsupported" | "denied" | "off" | "on" | "error";

export function canSaveWithTournamentAlerts(state: TournamentPushState, fallbackAcknowledged: boolean): boolean {
  return state === "on" || (state === "unsupported" && fallbackAcknowledged);
}

export const TOURNAMENT_ALERTS_REQUIRED = "대회 진행 알림을 ON으로 설정해주세요. 경기 호출과 일정 변경을 놓칠 수 있습니다.";
