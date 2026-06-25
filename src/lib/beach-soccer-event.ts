import type { Tournament } from "@/types";

export const BEACH_SOCCER_EVENT_PATH = "/beach-soccer";
export const BEACH_SOCCER_APPLY_PATH = "/beach-soccer/apply";
export const BEACH_SOCCER_EVENT_TOURNAMENT_ID = "beach-soccer-national-college-2026";
export const BEACH_SOCCER_EVENT_NAME = "전국 비치사커대회";
export const BEACH_SOCCER_EVENT_DATE_LABEL = "2026.8.7 (금)";
export const BEACH_SOCCER_EVENT_DATE_FULL_LABEL = "2026.08.07 금요일";
export const BEACH_SOCCER_EVENT_LOCATION_LABEL = "망상해수욕장";
export const BEACH_SOCCER_EVENT_LOCATION_FULL_LABEL = "강원 동해시 망상해수욕장";
export const BEACH_SOCCER_MATCH_FORMAT_LABEL = "비치사커 6인제";
export const BEACH_SOCCER_TEAM_LIMIT_LABEL = "최대 20명";
export const BEACH_SOCCER_PRIZE_LABEL = "200만원";
export const BEACH_SOCCER_ENTRY_FEE_LABEL = "30만원";

export const BEACH_SOCCER_DIVISIONS = ["대학부", "남자부", "여자부"] as const;
export type BeachSoccerDivision = (typeof BEACH_SOCCER_DIVISIONS)[number];
export const BEACH_SOCCER_DIVISIONS_LABEL = "대학부 · 남자부 · 여자부";
export const BEACH_SOCCER_MIN_TEAMS_PER_DIVISION = 4;
export const BEACH_SOCCER_MIN_TEAMS_NOTE =
  "대회는 대학부·남자부·여자부 세 부문으로 나누어 진행합니다. 각 부문은 참가팀이 4팀 이상일 때 운영되며, 4팀 미만인 부문은 진행되지 않습니다.";
export const BEACH_SOCCER_AWARD_SHORT_LABEL = "팀·선수카드 골드 등급 승급";
export const BEACH_SOCCER_AWARD_BENEFIT =
  "1위부터 3위까지 입상팀은 팀카드와 선수카드가 골드카드 등급으로 승급됩니다.";

export const BEACH_SOCCER_EVENT_TOURNAMENT: Tournament = {
  id: BEACH_SOCCER_EVENT_TOURNAMENT_ID,
  seasonId: "beach-soccer-2026",
  name: BEACH_SOCCER_EVENT_NAME,
  date: BEACH_SOCCER_EVENT_DATE_FULL_LABEL,
  location: BEACH_SOCCER_EVENT_LOCATION_FULL_LABEL,
  status: "upcoming",
  groups: [],
  matchIds: [],
  createdAt: Date.parse("2026-06-09T00:00:00+09:00"),
};

export const BEACH_SOCCER_RULEBOOK = [
  {
    title: "경기 방식",
    items: [
      "대학부·남자부·여자부 세 부문으로 나누어 운영하며, 각 부문은 참가팀이 4팀 이상일 때 진행됩니다.",
      "비치사커 6인제로, 한 팀은 골키퍼를 포함해 6명이 모래 코트에서 뜁니다.",
      "교체는 인원 제한 없이 자유롭게(플라잉 교체) 가능하며, 지정 교체 구역에서 들어오고 나갑니다.",
      "팀 엔트리(등록 인원)는 최대 20명까지 등록할 수 있습니다.",
      "예선·본선 대진 방식은 참가팀 수에 따라 대회 안내에서 최종 공지합니다.",
    ],
  },
  {
    title: "경기 시간",
    items: [
      "예선 경기는 한 게임 12분으로 운영합니다.",
      "4강(준결승)부터 결승까지는 한 게임 15분으로 운영합니다.",
      "부상·장비 문제·경기 중단 이슈가 있으면 시간을 일시정지하고, 재개 선언 시 다시 진행합니다.",
      "동점인 경우 3분 연장 후, 그래도 승부가 나지 않으면 서든데스 승부차기로 결정합니다.",
    ],
  },
  {
    title: "공 규격",
    items: [
      "비치사커 전용 5호 공을 사용합니다.",
      "둘레 68~70cm, 무게 400~440g, 공기압 0.4~0.6기압을 기준으로 합니다.",
      "모래 위 경기 특성상 땅볼보다 공중볼·롱킥 활용 비중이 큽니다.",
    ],
  },
  {
    title: "경기장 규격",
    items: [
      "모래 전용 코트로, 길이 35~37m · 너비 26~28m를 기준으로 합니다.",
      "골대 크기는 너비 5.5m · 높이 2.2m입니다.",
      "모래 깊이는 최소 40cm 이상을 권장하며, 경기장 경계는 라인 표식으로 구분합니다.",
    ],
  },
  {
    title: "공 처리 · 5초 룰",
    items: [
      "터치라인 밖으로 나간 공은 스로인이 아니라 킥인으로 재개합니다.",
      "공격팀은 페널티 구역 안에서 5초 이상 공을 소유할 수 없습니다.",
      "골키퍼도 공을 손으로 5초 이상 잡고 있을 수 없습니다.",
    ],
  },
  {
    title: "반칙 · 프리킥",
    items: [
      "모든 반칙은 직접 프리킥으로 처리하며, 원칙적으로 반칙을 당한 선수가 직접 찹니다.",
      "수비수는 프리킥 지점에서 5m 이상 떨어져야 합니다.",
      "상대의 바이시클 킥(오버헤드 킥)을 위험하게 방해하면 비치사커 고유 규정에 따라 반칙입니다.",
    ],
  },
  {
    title: "경고 · 퇴장",
    items: [
      "경고(옐로)·퇴장(레드) 기준은 일반 축구에 준합니다.",
      "퇴장이 선언되면 해당 팀은 2분간 수적 열세로 뛰며, 2분이 지나거나 실점하면 인원을 보충할 수 있습니다.",
      "폭언·폭행·위험한 행위는 즉시 퇴장 대상입니다.",
    ],
  },
  {
    title: "기록 기준",
    items: [
      "득점, 도움, 경고, 퇴장, MOM은 FairGround 경기 운영 화면에 기록합니다.",
      "골·반칙·경고·퇴장 판정은 현장 심판의 판단을 우선합니다.",
      "기록 정정이 필요하면 경기 종료 직후 팀 대표가 운영진에게 요청합니다.",
    ],
  },
  {
    title: "복장 · 안전",
    items: [
      "경기는 맨발 또는 모래양말 착용이 가능하며, 축구화·풋살화는 착용할 수 없습니다.",
      "금속 액세서리, 날카로운 장비, 상대에게 위험한 태클·고의 충돌은 제재 대상입니다.",
      "폭염 시에는 낮 시간대 운영을 중단하며, 부상·기상 악화 시에도 운영진 판단으로 휴식 또는 일정을 조정합니다.",
    ],
  },
] as const;

export const BEACH_SOCCER_REGULATIONS = [
  {
    title: "참가 부문",
    body: BEACH_SOCCER_MIN_TEAMS_NOTE,
  },
  {
    title: "참가 자격",
    body: "팀 단위 참가를 기본으로 하며, 팀 대표는 참가 신청 전 참가 부문, 팀명, 대표 연락처를 정확히 제출해야 합니다. 대학부는 같은 학교 학생으로 팀을 구성합니다.",
  },
  {
    title: "팀 등록 순서",
    body: "팀 대표가 먼저 참가 신청을 하고, 팀원은 회원가입 후 해당 팀에 가입 신청합니다. 운영진 확인 후 대회 안내가 전달됩니다.",
  },
  {
    title: "명단 관리",
    body: "출전 명단은 안내된 마감 시간까지 확정해야 하며, 현장 변경은 운영진 승인 범위 안에서만 가능합니다.",
  },
  {
    title: "운영 동의",
    body: "참가자는 경기 규칙, 안전 지침, 촬영 및 기록 운영 방식을 확인하고 이에 동의한 것으로 봅니다.",
  },
  {
    title: "입상팀 카드 혜택",
    body: BEACH_SOCCER_AWARD_BENEFIT,
  },
] as const;

export function isBeachSoccerTournament(
  tournament: Pick<Tournament, "id" | "name" | "location">,
) {
  const target = `${tournament.id} ${tournament.name} ${tournament.location}`.toLowerCase();
  return (
    tournament.id === BEACH_SOCCER_EVENT_TOURNAMENT_ID ||
    target.includes("beach") ||
    target.includes("비치사커") ||
    target.includes("망상해수욕장") ||
    target.includes("대학대항전")
  );
}

export function getTournamentDetailHref(tournament: Pick<Tournament, "id" | "name" | "location">) {
  return isBeachSoccerTournament(tournament)
    ? BEACH_SOCCER_EVENT_PATH
    : `/tournaments/${tournament.id}`;
}
