export type HalfAction = "startFirst" | "pause" | "resume" | "startSecond" | "endMatch";

export interface HalfButton {
  id: "startFirst" | "pause" | "resume" | "endFirst" | "startSecond" | "endSecond";
  label: string;
  action: HalfAction;
  variant: "primary" | "secondary" | "danger";
}

interface MatchProgress {
  status: string;
  currentHalf: 1 | 2;
  isRunning: boolean;
}

/**
 * 경기 상태 → 노출 버튼(4단계 모델).
 * 데이터 모델에 하프타임 상태가 없어 "전반 종료"=전반 pause, "후반 종료"=endMatch 로 매핑.
 * "후반 시작"은 canStartSecondHalf 로 별도 노출한다.
 */
export function halfControlButtons(m: MatchProgress): HalfButton[] {
  if (m.status === "finished" || m.status === "cancelled") return [];
  if (m.status === "scheduled") {
    return [{ id: "startFirst", label: "전반 시작", action: "startFirst", variant: "primary" }];
  }
  // live
  const pauseOrResume: HalfButton = m.isRunning
    ? { id: "pause", label: "일시정지", action: "pause", variant: "secondary" }
    : { id: "resume", label: "재개", action: "resume", variant: "primary" };

  if (m.currentHalf === 1) {
    return [pauseOrResume, { id: "endFirst", label: "전반 종료", action: "pause", variant: "danger" }];
  }
  return [pauseOrResume, { id: "endSecond", label: "후반 종료", action: "endMatch", variant: "danger" }];
}

/** 전반 일시정지(=전반 종료 직후) 상태에서 '후반 시작' 버튼을 추가로 보여줄지. */
export function canStartSecondHalf(m: MatchProgress): boolean {
  return m.status === "live" && m.currentHalf === 1 && !m.isRunning;
}
