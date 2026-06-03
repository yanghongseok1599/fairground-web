import type { Player, PlayerRole, Team } from "@/types";

export interface TeamAdminAction {
  href: string;
  label: string;
  description: string;
}

export interface TeamAdminMemberBuckets<T extends Pick<Player, "isApproved" | "createdAt">> {
  approved: T[];
  pending: T[];
}

type TeamManagerPlayer = Pick<Player, "id" | "role" | "teamId"> | null | undefined;
type TeamManagerTeam = Pick<Team, "id" | "captainId"> | null | undefined;

export function buildTeamAdminPath(teamId: string): string {
  return `/teams/${teamId}/admin`;
}

export function canManageTeamAsDirector(player: TeamManagerPlayer, team: TeamManagerTeam): boolean {
  if (!player || !team) return false;
  if (player.role === "admin") return true;
  if (player.role === "captain" && player.teamId === team.id) return true;
  return Boolean(team.captainId && team.captainId === player.id);
}

export function getTeamAdminMemberBuckets<T extends Pick<Player, "isApproved" | "createdAt">>(
  players: readonly T[],
): TeamAdminMemberBuckets<T> {
  const byNewest = (a: T, b: T) => b.createdAt - a.createdAt;
  return {
    approved: players.filter((player) => player.isApproved).sort(byNewest),
    pending: players.filter((player) => !player.isApproved).sort(byNewest),
  };
}

export function getDirectorRoleLabel(role: PlayerRole): string {
  if (role === "admin") return "리그 관리자";
  if (role === "captain") return "감독";
  if (role === "referee") return "심판";
  return "선수";
}

export function getTeamAdminPrimaryActions(teamId: string): TeamAdminAction[] {
  return [
    {
      href: `/teams/${teamId}/notices`,
      label: "공지 작성/확인",
      description: "팀 전체가 꼭 봐야 할 공지와 안내를 관리합니다.",
    },
    {
      href: `/teams/${teamId}/dues`,
      label: "회비 장부 관리",
      description: "월 회비, 납부 상태, 지출과 잔액을 확인합니다.",
    },
    {
      href: `/teams/${teamId}/chat`,
      label: "팀 게시판 관리",
      description: "경기 후기와 운영 논의를 팀 게시판에서 이어갑니다.",
    },
    {
      href: `/teams/${teamId}/members`,
      label: "멤버/초대 관리",
      description: "초대 링크와 승인 대기 선수를 빠르게 확인합니다.",
    },
  ];
}
