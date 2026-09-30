import type { PlayerRole } from "@/types";

export function isAdminLikeRole(role: PlayerRole | undefined, canInspect = false): boolean {
  return role === "admin" || role === "referee" || canInspect;
}

export function getAdminEntryLabel(role: PlayerRole | undefined, canInspect = false): string {
  if (role === "admin") return "관리자";
  if (role === "referee") return "심판 운영";
  if (canInspect) return "선수검인";
  return "마이페이지";
}
