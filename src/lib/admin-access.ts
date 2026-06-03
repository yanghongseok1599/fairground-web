import type { PlayerRole } from "@/types";

export function isAdminLikeRole(role: PlayerRole | undefined): boolean {
  return role === "admin" || role === "referee";
}

export function getAdminEntryLabel(role: PlayerRole | undefined): string {
  if (role === "admin") return "관리자";
  if (role === "referee") return "심판 운영";
  return "마이페이지";
}
