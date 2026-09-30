import { jerseyNumberText } from "@/lib/jersey-number";
import type { InspectionFilter, InspectionPlayer } from "./types";

export function inspectionBlockReason(player: InspectionPlayer): string | null {
  if (!player.is_approved) return "가입 승인 필요";
  if (player.has_player_experience) return "참가 자격 확인 필요 (선출)";
  return null;
}

export function inspectionNumber(player: InspectionPlayer): string {
  return jerseyNumberText({ number: player.number, numberLabel: player.number_label });
}

export function summarizeInspections(players: InspectionPlayer[]) {
  const complete = players.filter((p) => p.checked_at !== null).length;
  return { total: players.length, complete, pending: players.length - complete };
}

export function filterInspections(players: InspectionPlayer[], query: string, teamId: string, status: InspectionFilter) {
  const term = query.trim().toLocaleLowerCase("ko-KR");
  return players.filter((p) => (!teamId || p.team_id === teamId)
    && (status === "all" || (status === "complete" ? p.checked_at !== null : p.checked_at === null))
    && (!term || [p.name, p.team_name, inspectionNumber(p)].some((value) => value.toLocaleLowerCase("ko-KR").includes(term))))
    .sort((a, b) => Number(a.checked_at !== null) - Number(b.checked_at !== null)
      || a.team_name.localeCompare(b.team_name, "ko") || a.name.localeCompare(b.name, "ko"));
}

export function inspectionTime(time: string): string {
  return new Date(time).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
}
