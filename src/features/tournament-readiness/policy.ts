export type TournamentPushState = "loading" | "install" | "unsupported" | "denied" | "off" | "unlinked" | "on" | "error";

export const PUSH_STATE_LABEL: Record<TournamentPushState, string> = {
  loading: "확인 중",
  install: "홈 화면 앱에서 확인",
  unsupported: "이 환경에서 확인 불가",
  denied: "권한 차단",
  off: "허용 전",
  unlinked: "수신 연결 필요",
  on: "ON",
  error: "연결 확인 필요",
};
