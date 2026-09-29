import type { Match } from "@/types";

type OrderedMatch = Pick<Match, "id" | "scheduledAt" | "round"> & { createdAt?: number };

export function compareScheduledMatches(a: OrderedMatch, b: OrderedMatch): number {
  return (a.scheduledAt || a.createdAt || 0) - (b.scheduledAt || b.createdAt || 0)
    || a.round - b.round || (a.createdAt ?? 0) - (b.createdAt ?? 0) || a.id.localeCompare(b.id);
}

export function scheduledMatchTime(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "시간 미정";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", month: "numeric", day: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(timestamp);
}

export function normalizeGroupName(name: string): string {
  return name.trim().replace(/조$/, "").trim();
}

export function groupLabel(name: string): string {
  return `${normalizeGroupName(name)}조`;
}
