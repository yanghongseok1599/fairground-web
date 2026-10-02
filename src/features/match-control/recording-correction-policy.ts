import type { MatchEvent } from "@/types";
import { isRosterEvent, ROSTER_EVENTS } from "./roster-stats";

export function recordingEventLabel(event: MatchEvent): string {
  return ROSTER_EVENTS.find(item => item.type === event.type)?.label ?? "기록";
}

export function cancellationUnavailable(event: MatchEvent, isLive: boolean): string | null {
  if (!isLive) return "경기 진행 중에만 수정·취소할 수 있습니다. 종료 후에는 확정 기록을 변경할 수 없습니다.";
  if (event.isCancelled) return "이미 취소된 기록입니다.";
  if (event.type === "red_card" && (event.id.startsWith("auto:") || event.sourceYellowEventId)) {
    return "경고 누적으로 발생한 자동 퇴장입니다. 잘못 입력한 경고를 취소하면 함께 정정됩니다.";
  }
  if (!isRosterEvent(event.type)) return "이 내역은 선수별 기록 취소 대상이 아닙니다.";
  return null;
}

export function cancellationEffect(event: MatchEvent): string {
  if (event.type === "goal") return "해당 팀 점수가 1점 줄어듭니다. 어시스트는 별도 기록이므로, 잘못 입력한 어시스트가 있으면 그 기록도 따로 취소해주세요.";
  if (event.type === "assist") return "선수의 어시스트 기록을 취소합니다. 골 점수에는 영향을 주지 않습니다.";
  if (event.type === "yellow_card") return "남은 경고가 2회 미만이면 경고 누적 자동 퇴장도 함께 취소됩니다. 직접 입력한 퇴장은 유지됩니다.";
  return "취소한 기록은 내역에 남고 이번 경기 집계에서 제외됩니다.";
}
