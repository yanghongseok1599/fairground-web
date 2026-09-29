import type { Tournament } from "@/types";
import {
  TOURNAMENT_WARNING_RESET_RULE,
  TOURNAMENT_WARNING_SUSPENSION_RULE,
} from "@/lib/discipline-policy";

export const MIXED_FUTSAL_EVENT_PATH = "/mixed-futsal";
export const MIXED_FUTSAL_APPLY_PATH = "/mixed-futsal/apply";
export const MIXED_FUTSAL_EVENT_TOURNAMENT_ID = "5ff73034-1747-4b9e-874a-6fe19fa68ac1";
export const MIXED_FUTSAL_EVENT_NAME = "2026 제 1회 페어그라운드 혼성풋살대회";
export const MIXED_FUTSAL_EVENT_SHORT_NAME = "2026 페어그라운드 혼성풋살대회";
export const MIXED_FUTSAL_EVENT_TAGLINE = "모두가 승리하는 그라운드";

export const MIXED_FUTSAL_EVENT_DATE_LABEL = "2026.10.3 (토)";
export const MIXED_FUTSAL_EVENT_DATE_FULL_LABEL = "2026년 10월 3일 토요일";
export const MIXED_FUTSAL_EVENT_TIME_LABEL = "09:00 – 18:30";
export const MIXED_FUTSAL_EVENT_DATETIME_LABEL = "2026.10.3 (토) 09:00 – 18:30";
export const MIXED_FUTSAL_EVENT_START_ISO = "2026-10-03T09:00:00+09:00";
export const MIXED_FUTSAL_EVENT_END_ISO = "2026-10-03T18:30:00+09:00";

export const MIXED_FUTSAL_EVENT_LOCATION_LABEL = "엠무브 은평점";
export const MIXED_FUTSAL_EVENT_LOCATION_FULL_LABEL =
  "엠무브 은평점 · A구장 한 면";
export const MIXED_FUTSAL_EVENT_VENUE_NOTE =
  "경기는 A구장 한 면에서 순차 진행하고, 실내구장은 그라운드 챌린지에 사용합니다.";

export const MIXED_FUTSAL_WEATHER_LABEL = "우천 시에도 진행";
export const MIXED_FUTSAL_WEATHER_NOTE =
  "비가 와도 대회는 예정대로 진행합니다. 실외 풋살장이지만 우천 자체는 대회를 중단하는 사유가 아니며, 폭우 또는 천재지변에 해당하는 경우에만 일정 변경 또는 대회 중단이 있을 수 있습니다.";

export const MIXED_FUTSAL_REFUND_LABEL = "주최 측 취소 시 전액 환불";
export const MIXED_FUTSAL_REFUND_NOTE =
  "폭우 또는 천재지변으로 주최 측이 대회를 취소하는 경우, 참가비는 전액 환불합니다.";

export const MIXED_FUTSAL_TEAM_COUNT_LABEL = "8팀";
export const MIXED_FUTSAL_GROUP_LABEL = "A조 4팀 · B조 4팀";
export const MIXED_FUTSAL_MATCH_FORMAT_LABEL = "혼성 5인제 (GK 포함)";
export const MIXED_FUTSAL_FORMAT_SUMMARY_LABEL = "조별리그 · 순위결정전";
export const MIXED_FUTSAL_GUARANTEE_LABEL = "팀당 5경기 보장";
export const MIXED_FUTSAL_GUARANTEE_NOTE =
  "A조·B조 각 4팀이 조별리그를 치른 뒤 순위결정전을 진행합니다. 모든 팀은 조별리그 3경기와 순위결정전 2경기, 총 5경기를 뛰며 대회 전체는 20경기입니다.";

export const MIXED_FUTSAL_GENDER_RULE_LABEL = "남자 3명 + 여자 2명 고정";
export const MIXED_FUTSAL_GENDER_RULE_NOTE =
  "코트 위 5명은 골키퍼를 포함해 남자 3명 + 여자 2명으로 고정하며, 경기 중 이 구성은 항시 유지됩니다. 매 경기 여자 선수 2명이 코트 위에 섭니다.";
export const MIXED_FUTSAL_ROSTER_LABEL = "팀당 평균 10명 권장";
export const MIXED_FUTSAL_ELIGIBILITY_LABEL = "비선출 대회";
export const MIXED_FUTSAL_ELIGIBILITY_NOTE =
  "비선출 참가자들이 대등하게 뛸 수 있도록, 중등부(중학교) 이상에서 선수로 등록된 이력이 있으면 참가할 수 없습니다.";

export const MIXED_FUTSAL_ELIGIBILITY_CHECK_NOTE =
  "선수 등록 이력은 참가 신청 접수 후 운영진이 JOIN KFA(대한축구협회) 등록 정보로 확인합니다. 확인 결과 참가 불가 대상이면 대회 전에 개별 안내합니다.";

// 종목·리그별 참가 자격 — 중등부 이상 선수 등록 이력(선출) 기준에 더해,
// 성인 이후의 리그 활동 수준으로 참가 가능 범위를 구분한다.
export const MIXED_FUTSAL_ELIGIBILITY_TIERS = [
  {
    sport: "축구 (남자)",
    blocked: ["K리그1 · K리그2", "K3리그 · K4리그"],
    allowed: ["K5리그 이하", "지역리그", "조기축구 등 동호인 활동"],
  },
  {
    sport: "축구 (여자)",
    blocked: ["WK리그"],
    allowed: ["대학리그", "한국여자축구연맹전 등 아마추어 대회"],
  },
  {
    sport: "풋살",
    blocked: ["FK리그 (FK1 · FK2)", "WFK리그"],
    allowed: ["그 외 동호인 · 아마추어 풋살 활동"],
  },
] as const;

export const MIXED_FUTSAL_SAFETY_LABEL = "인사이드 킥만 사용 · 슬라이딩 금지";
export const MIXED_FUTSAL_SAFETY_NOTE =
  "경기장 전체에서 패스와 슈팅 모두 인사이드 킥만 허용합니다. 페널티 구역에서도 인사이드 킥만 사용하며, 상대와 3m 이내에서는 얼굴·상반신을 향한 슈팅을 금지합니다. 슬라이딩 태클도 금지합니다.";

export const MIXED_FUTSAL_EARLY_BIRD_DEADLINE_LABEL = "9월 7일까지";
export const MIXED_FUTSAL_ENTRY_FEE_LABEL =
  `얼리버드 ${MIXED_FUTSAL_EARLY_BIRD_DEADLINE_LABEL} 40만원 · 일반 45만원`;
export const MIXED_FUTSAL_ENTRY_FEE_EARLY_LABEL =
  `얼리버드 (${MIXED_FUTSAL_EARLY_BIRD_DEADLINE_LABEL}) 40만원`;
export const MIXED_FUTSAL_ENTRY_FEE_REGULAR_LABEL = "일반 (9월 8일~) 45만원";
export const MIXED_FUTSAL_ENTRY_FEE_EARLY_AMOUNT = "400000";
export const MIXED_FUTSAL_ENTRY_FEE_REGULAR_AMOUNT = "450000";
export const MIXED_FUTSAL_ENTRY_FEE_NOTE =
  `참가비는 ${MIXED_FUTSAL_EARLY_BIRD_DEADLINE_LABEL} 신청하면 얼리버드 40만원, 9월 8일부터는 일반 45만원입니다. 납부 방법과 기한은 참가 신청 접수 후 운영진이 별도로 안내합니다.`;

export const MIXED_FUTSAL_PHOTO_WIDTH = 1200;
export const MIXED_FUTSAL_PHOTO_HEIGHT = 1500;

export const MIXED_FUTSAL_SIDE_EVENT_LABEL = "그라운드 챌린지";
export const MIXED_FUTSAL_SIDE_EVENT_TIMING_LABEL = "경기 진행 중";
export const MIXED_FUTSAL_SIDE_EVENT_TIMING_NOTE =
  "그라운드 챌린지는 A구장 경기와 동시에 실내구장에서 운영합니다. 다음 경기 출전팀은 챌린지에 호출하지 않으며, 자기 경기 시작 5분 전까지 A구장 앞에 모여 장비 확인을 받습니다.";
export const MIXED_FUTSAL_SIDE_EVENTS = [
  {
    title: "슈팅속도 챌린지",
    body: "슛 속도를 측정해 기록으로 남기는 부대 이벤트입니다. A구장 경기와 함께 실내구장에서 운영하며, 다음 경기 출전팀은 경기 준비를 위해 참여하지 않습니다.",
  },
  {
    title: "버킷슛 챌린지",
    body: "정해진 표적을 노려 정확도를 겨루는 부대 이벤트입니다. 경기 대기 중 참여할 수 있고, 실력과 상관없이 도전 기록을 남길 수 있습니다.",
  },
] as const;

export const MIXED_FUTSAL_EVENT_TOURNAMENT: Tournament = {
  id: MIXED_FUTSAL_EVENT_TOURNAMENT_ID,
  seasonId: "mixed-futsal-2026",
  name: MIXED_FUTSAL_EVENT_NAME,
  date: MIXED_FUTSAL_EVENT_DATE_FULL_LABEL,
  location: MIXED_FUTSAL_EVENT_LOCATION_FULL_LABEL,
  status: "upcoming",
  groups: [],
  matchIds: [],
  createdAt: Date.parse("2026-08-25T00:00:00+09:00"),
};

export const MIXED_FUTSAL_RULEBOOK = [
  {
    title: "경기 방식",
    items: [
      "혼성 5인제로 진행하며, 코트 위 5명에는 골키퍼가 포함됩니다.",
      "8팀이 A조 4팀 · B조 4팀으로 나뉘어 조별리그와 순위결정전을 치릅니다.",
      "팀당 조별리그 3경기와 순위결정전 2경기, 총 5경기를 보장하며 전체 20경기입니다.",
      "모든 경기는 A구장 한 면에서 한 경기씩 진행합니다. 실내구장은 그라운드 챌린지 공간입니다.",
      "경기 슬롯은 20분입니다: 경기 12분, 팀 교대 3분, 장비 점검·준비 5분.",
      "양 팀은 경기 시작 5분 전까지 A구장 앞에 집합해 감독관의 장비 확인을 받습니다.",
    ],
  },
  {
    title: "팀 구성",
    items: [
      "성별 구성은 남자 3명 + 여자 2명으로 고정하며, 경기 중 이 구성은 항시 유지되어야 합니다.",
      "퇴장이 발생하면 해당 팀은 2분 동안 필드 플레이어 1명 없이 경기합니다. 2분 후에도 정해진 성별 구성을 맞추지 못하면 3:0 몰수패 처리됩니다.",
      "교대와 부상에 대비해 남녀 모두 여유 인원을 두고 로스터를 꾸립니다.",
      "교대 인원을 고려해 팀당 평균 10명 내외의 로스터를 권장합니다.",
      "팀 대표는 참가 신청 시 팀명과 대표 연락처를 정확히 제출합니다.",
      "출전 명단은 안내된 마감 시간까지 확정합니다.",
    ],
  },
  {
    title: "참가 자격",
    items: [
      "비선출 참가자들이 대등하게 뛸 수 있도록, 중등부(중학교) 이상에서 선수로 등록된 이력이 있으면 참가할 수 없습니다.",
      "고등부·대학부 등 중등부보다 상위 단계의 선수 등록 이력도 동일하게 참가할 수 없습니다.",
      "축구(남자)는 K리그1·K리그2·K3리그·K4리그 활동 이력이 있으면 참가할 수 없고, K5리그 이하·지역리그·조기축구 등은 참가할 수 있습니다.",
      "축구(여자)는 WK리그 활동 이력이 있으면 참가할 수 없고, 대학리그·한국여자축구연맹전 등은 참가할 수 있습니다.",
      "풋살은 FK리그(FK1·FK2)와 WFK리그 활동 이력이 있으면 참가할 수 없고, 그 외 동호인·아마추어 풋살 활동은 참가할 수 있습니다.",
      "성별과 실력에 관계없이 위 기준에 해당하지 않는 비선출이라면 누구나 팀을 꾸려 참가할 수 있습니다.",
      "선수 등록 이력은 운영진이 JOIN KFA(대한축구협회) 등록 정보로 확인하며, 참가 불가 대상은 대회 전에 개별 안내합니다.",
    ],
  },
  {
    title: "경기 규칙",
    items: [
      "경기장 전체에서 패스와 슈팅은 인사이드 킥만 허용하며, 발등 킥은 금지합니다.",
      "상대와 3m 이내에서는 얼굴·상반신을 향한 슈팅을 금지합니다. 해당 거리에서는 인사이드 킥으로 하반신 방향만 허용합니다.",
      "골키퍼가 공을 놓은 뒤 상대 선수의 터치 없이 동료가 의도적으로 다시 패스한 공을 손이나 발로 다시 터치하면 상대팀 간접 프리킥입니다.",
      "프리킥 4초 초과는 간접 프리킥, 코너킥 4초 초과는 골 클리어런스, 킥인 4초 초과는 상대팀 킥인입니다.",
      "골키퍼가 자기 진영에서 공을 소유하면 4초를 셉니다. 하프라인을 넘으면 4초 카운트가 끝나고 필드 선수로 봅니다.",
      "슬라이딩은 금지합니다. 슬라이딩 태클과 슬라이딩 방어 모두 해당됩니다.",
      "한 팀의 세 번째 누적 파울에는 상대팀에 10m 지점 직접 프리킥을 줍니다.",
      "주장만 경기당 2회까지 항의할 수 있습니다. 초과하면 주장에게 경고 1회를 부과합니다.",
      `${TOURNAMENT_WARNING_SUSPENSION_RULE} ${TOURNAMENT_WARNING_RESET_RULE} 출장정지로 주장이 출전하지 못하면 팀은 주장을 교체할 수 있습니다.`,
      "부상이나 위험 상황에서는 심판이 경기를 중단하고 안전을 먼저 확인합니다.",
    ],
  },
  {
    title: "경기 기록",
    items: [
      "득점, 도움, 경기 결과는 FairGround 경기 운영 화면에 실시간으로 기록됩니다.",
      "기록한 경기 결과와 개인 스탯은 참가자의 선수 카드에 그대로 남습니다.",
      "판정은 현장 심판의 판단을 우선하며, 기록 정정은 경기 종료 직후 팀 대표가 요청합니다.",
    ],
  },
  {
    title: "운영 기준",
    items: [
      "경기 시간은 12분이며, 대회 일정은 A구장 한 면에서 20분 간격으로 운영합니다.",
      "선수 교체는 무제한이며 지정 교체선에서만 가능합니다. 교체 선수는 나가는 선수가 먼저 코트를 벗어난 뒤 들어갑니다.",
      "조별 편성, 대진 순번 및 경기별 시간은 공개 대진표와 현장 안내를 확인합니다.",
      "참가자는 경기 규칙, 안전 지침, 촬영 및 기록 운영 방식을 확인하고 이에 동의한 것으로 봅니다.",
    ],
  },
] as const;

export const MIXED_FUTSAL_REGULATIONS = [
  {
    title: "대회 개요",
    body: `${MIXED_FUTSAL_EVENT_DATE_FULL_LABEL} ${MIXED_FUTSAL_EVENT_TIME_LABEL}, ${MIXED_FUTSAL_EVENT_LOCATION_FULL_LABEL}에서 열립니다. 8팀이 A조 4팀 · B조 4팀으로 편성되어 조별리그와 순위결정전을 치릅니다. 모든 팀은 총 5경기, 대회 전체 20경기를 진행합니다.`,
  },
  {
    title: "참가 자격",
    body: `${MIXED_FUTSAL_ELIGIBILITY_NOTE} ${MIXED_FUTSAL_ELIGIBILITY_CHECK_NOTE}`,
  },
  {
    title: "팀 구성 기준",
    body: `${MIXED_FUTSAL_GENDER_RULE_NOTE} 퇴장 후 2분 동안은 필드 플레이어 1명 없이 진행하며, 이후에도 성별 구성을 맞추지 못하면 3:0 몰수패입니다. 교대 인원을 포함해 ${MIXED_FUTSAL_ROSTER_LABEL}합니다.`,
  },
  {
    title: "팀 등록 순서",
    body: "팀 대표가 먼저 참가 신청을 하고, 팀원은 회원가입 후 해당 팀에 가입 신청합니다. 운영진 확인 후 대회 안내가 전달됩니다.",
  },
  {
    title: "참가비",
    body: MIXED_FUTSAL_ENTRY_FEE_NOTE,
  },
  {
    title: "경기 규칙",
    body: `${MIXED_FUTSAL_SAFETY_NOTE} 세 번째 누적 파울에는 10m 직접 프리킥을 줍니다. 경기별 항의는 주장만 2회까지 할 수 있고 초과 시 주장에게 경고를 부과합니다. ${TOURNAMENT_WARNING_SUSPENSION_RULE} ${TOURNAMENT_WARNING_RESET_RULE}`,
  },
  {
    title: "경기 일정",
    body: "A구장 한 면에서 20분 간격으로 진행합니다. 한 슬롯은 경기 12분, 팀 교대 3분, 장비 점검·준비 5분으로 구성합니다. 출전 양 팀은 자기 경기 시작 5분 전까지 A구장 앞에 모여 장비 확인을 받습니다.",
  },
  {
    title: "우천 시 운영",
    body: `${MIXED_FUTSAL_WEATHER_NOTE} ${MIXED_FUTSAL_REFUND_NOTE}`,
  },
  {
    title: "부대 이벤트",
    body: "그라운드 챌린지는 A구장 경기와 동시에 실내구장에서 운영합니다. 다음 경기 출전팀은 챌린지에 참여하지 않고 경기 준비를 합니다.",
  },
] as const;

export function isMixedFutsalTournament(
  tournament: Pick<Tournament, "id" | "name" | "location">,
) {
  const target = `${tournament.id} ${tournament.name} ${tournament.location}`.toLowerCase();
  return (
    tournament.id === MIXED_FUTSAL_EVENT_TOURNAMENT_ID ||
    target.includes("mixed-futsal") ||
    target.includes("혼성 풋살") ||
    target.includes("혼성풋살") ||
    target.includes("엠무브 은평")
  );
}
