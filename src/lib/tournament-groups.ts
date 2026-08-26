import type { Team } from "@/types";

/**
 * 조 이름. 10월 3일 대회는 A조 6팀 · B조 6팀 두 조 구성이다.
 * 조를 늘리려면 여기에 추가하면 화면·자동배분이 함께 따라간다.
 */
export const GROUP_NAMES = ["A", "B"] as const;

/**
 * 자동 배분 — 조별 전력이 한쪽으로 쏠리지 않게 나눈다.
 *
 * 무작위로 나누면 강팀이 한 조에 몰릴 수 있다. 시드(리그 티어 → 승점 →
 * 연속참가)로 줄을 세운 뒤 뱀 순서(serpentine: A B B A A B ...)로 배분하면
 * 각 조의 시드 합이 비슷해진다. 스포츠 대진에서 쓰는 표준 방식이다.
 *
 * 반환값은 teamId → 조 이름 맵이다.
 */
const TIER_RANK: Record<string, number> = { premium: 0, gold: 1, silver: 2, bronze: 3 };

export function splitIntoGroups(teams: Team[]): Record<string, string> {
  const seeded = [...teams].sort((a, b) => {
    const tier = (TIER_RANK[a.leagueTier] ?? 9) - (TIER_RANK[b.leagueTier] ?? 9);
    if (tier !== 0) return tier;
    const points = (b.seasonStats?.points ?? 0) - (a.seasonStats?.points ?? 0);
    if (points !== 0) return points;
    const streak = (b.participationStreak ?? 0) - (a.participationStreak ?? 0);
    if (streak !== 0) return streak;
    return a.name.localeCompare(b.name, "ko");
  });

  const groupCount = GROUP_NAMES.length;
  const result: Record<string, string> = {};
  seeded.forEach((team, index) => {
    const round = Math.floor(index / groupCount);
    const offset = index % groupCount;
    // 홀수 라운드는 역순으로 돌려 시드 합을 맞춘다.
    const position = round % 2 === 0 ? offset : groupCount - 1 - offset;
    result[team.id] = GROUP_NAMES[position];
  });
  return result;
}
