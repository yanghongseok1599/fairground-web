export type HalfAction = "start" | "pause" | "resume" | "endMatch";

export interface HalfButton {
  id: "start" | "pause" | "resume" | "endMatch";
  label: string;
  action: HalfAction;
  variant: "primary" | "secondary" | "danger";
}

interface MatchProgress {
  status: string;
  isRunning: boolean;
}

/**
 * 경기 상태 → 노출 버튼(단일 타이머 모델).
 * 공식 규정 v2.4 제4조: 모든 경기는 전·후반 구분 없이 단일 경기 시간 15분으로 진행한다.
 * 따라서 전반/후반 개념 없이 시작 → 일시정지/재개 → 경기 종료로 운영한다.
 */
export function halfControlButtons(m: MatchProgress): HalfButton[] {
  if (m.status === "finished" || m.status === "cancelled") return [];
  if (m.status === "scheduled") {
    return [{ id: "start", label: "경기 시작", action: "start", variant: "primary" }];
  }
  // live
  const pauseOrResume: HalfButton = m.isRunning
    ? { id: "pause", label: "일시정지", action: "pause", variant: "secondary" }
    : { id: "resume", label: "재개", action: "resume", variant: "primary" };
  return [pauseOrResume, { id: "endMatch", label: "경기 종료", action: "endMatch", variant: "danger" }];
}
