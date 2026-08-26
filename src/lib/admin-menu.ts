import type { PlayerRole } from "@/types";

export interface AdminMenuItem {
  title: string;
  description: string;
  href: string;
  accent: string;
  roles: PlayerRole[];
  metricKey:
    | "matches"
    | "players"
    | "referees"
    | "teams"
    | "penalties"
    | "coaches"
    | "reports"
    | "skillChallenge"
    | "popups"
    | "push"
    | "groups";
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
    title: "조 편성",
    description: "승인된 참가팀을 A조·B조로 나눠 조별 리그 대진의 기준을 만듭니다",
    href: "/admin/tournaments",
    accent: "#0047AB",
    roles: ["admin"],
    metricKey: "groups",
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
    title: "그라운드 챌린지",
    description: "망상 이벤트 3종 기록 입력, 점수, 이벤트 뱃지 지급",
    href: "/admin/skill-challenge",
    accent: "#FF3B30",
    roles: ["admin"],
    metricKey: "skillChallenge",
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
    description: "감독 신청 검토, 선수 지도·경기 운영 권한 부여",
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
  {
    title: "신고 관리",
    description: "사용자 신고 검토, 콘텐츠 숨김 처리",
    href: "/admin/reports",
    accent: "#FF8A65",
    roles: ["admin"],
    metricKey: "reports",
  },
  {
    title: "팝업 관리",
    description: "홈 홍보 팝업 추가, 수정, 노출 제어",
    href: "/admin/popups",
    accent: "#003080",
    roles: ["admin"],
    metricKey: "popups",
  },
  {
    title: "푸시 발송",
    description: "구독자에게 웹 푸시 알림 발송 (전체·역할·팀·개별)",
    href: "/admin/push",
    accent: "#00B8D4",
    roles: ["admin"],
    metricKey: "push",
  },
];

export function getAdminMenuItems(role: PlayerRole | undefined): AdminMenuItem[] {
  if (!role) return [];
  return ADMIN_MENU_ITEMS.filter((item) => item.roles.includes(role));
}
