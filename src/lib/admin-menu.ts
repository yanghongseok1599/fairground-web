import type { PlayerRole } from "@/types";

export interface AdminMenuItem {
  title: string;
  description: string;
  href: string;
  accent: string;
  roles: PlayerRole[];
  metricKey: "matches" | "players" | "referees" | "teams" | "penalties" | "coaches";
}

export const ADMIN_MENU_ITEMS: AdminMenuItem[] = [
  {
    title: "경기 관리",
    description: "라이브 경기 운영, 타이머, 스코어 입력",
    href: "/admin/matches",
    accent: "#00C853",
    roles: ["admin", "referee"],
    metricKey: "matches",
  },
  {
    title: "선수 승인",
    description: "가입 신청 선수 승인, 역할 변경, 카드 활성화",
    href: "/admin/players",
    accent: "#FFD700",
    roles: ["admin"],
    metricKey: "players",
  },
  {
    title: "심판 관리",
    description: "심판 신청 승인, 활동 상태, 운영 권한 관리",
    href: "/admin/referees",
    accent: "#7C3AED",
    roles: ["admin"],
    metricKey: "referees",
  },
  {
    title: "팀 관리",
    description: "팀 생성 승인, 로고/기본 정보 검수",
    href: "/admin/teams",
    accent: "#4FC3F7",
    roles: ["admin"],
    metricKey: "teams",
  },
  {
    title: "감독 승인",
    description: "감독 신청 검토, 팀 운영 권한 부여",
    href: "/admin/coaches",
    accent: "#0047AB",
    roles: ["admin"],
    metricKey: "coaches",
  },
  {
    title: "페널티 관리",
    description: "경고 누적, 출전 정지, 오심 정정",
    href: "/admin/penalties",
    accent: "#FF6B6B",
    roles: ["admin"],
    metricKey: "penalties",
  },
];

export function getAdminMenuItems(role: PlayerRole | undefined): AdminMenuItem[] {
  if (!role) return [];
  return ADMIN_MENU_ITEMS.filter((item) => item.roles.includes(role));
}
