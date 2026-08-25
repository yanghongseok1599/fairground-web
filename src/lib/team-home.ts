import type { Position, LeagueTier } from "@/types";

export type RosterFilter = Position | "ALL";

// 리그 단계 한글 라벨 + 다음/이전 단계.
export const LEAGUE_TIER_LABEL: Record<LeagueTier, string> = {
  bronze: "브론즈 리그",
  silver: "실버 리그",
  gold: "골드 리그",
  premium: "플래티넘 리그",
};

const TIER_ORDER: LeagueTier[] = ["bronze", "silver", "gold", "premium"];

export function nextLeagueTier(tier: LeagueTier): LeagueTier | null {
  const i = TIER_ORDER.indexOf(tier);
  return i >= 0 && i < TIER_ORDER.length - 1 ? TIER_ORDER[i + 1] : null;
}

// 리그 등급 → 팀 카드 프레임 인덱스. TEAM_CARD_VARIANTS 순서
// [bronze, silver, gold, emerald(=premium)] 와 1:1 매핑.
// 팀 카드 비주얼이 곧 리그 등급을 나타내도록 통일(해시 무작위 배정 대체).
export function leagueTierCardIndex(tier: LeagueTier): number {
  const i = TIER_ORDER.indexOf(tier);
  return i >= 0 ? i : 0;
}

export function isFieldChampionTeam(team: {
  isApproved?: boolean;
  seasonStats?: { rank?: number };
}) {
  return Boolean(team.isApproved && team.seasonStats?.rank === 1);
}

export function buildTeamRecordLine(record: { wins: number; draws: number; losses: number }): string {
  return `${record.wins}W ${record.draws}D ${record.losses}L`;
}

export function buildTeamClubhouseAnchor(): string {
  return "#team-operations";
}

export function getRosterFilterCount(players: ReadonlyArray<{ position: Position }>, filter: RosterFilter): number {
  if (filter === "ALL") return players.length;
  return players.filter((player) => player.position === filter).length;
}

// 팀별 카드 프레임 매핑 — 랜딩 참가팀 캐러셀, 팀 상세 헤더 등 여러 surface가
// 같은 팀에 같은 카드 색을 그리도록 하는 단일 진실 원천. id(없으면 name) 해시.
// djb2 변형: UUID 입력에서 sum-product 해시가 modulo 4 ≡ 1 로 쏠려 모든 팀이
// silver 카드 하나로 모이던 문제를 풀기 위해 비트 시프트 + XOR 로 교체.
export function stableTeamCardIndex(value: string, modulo: number): number {
  if (modulo <= 0) return 0;
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    // ((h << 5) + h) === h * 33; XOR 로 자릿수 영향 분산.
    hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
    hash |= 0; // int32 wrap
  }
  return Math.abs(hash) % modulo;
}
