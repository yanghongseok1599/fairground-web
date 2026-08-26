import { test } from "node:test";
import assert from "node:assert/strict";
import { GROUP_NAMES, splitIntoGroups } from "../src/lib/tournament-groups.ts";
import type { Team } from "../src/types/index.ts";

const team = (name: string, tier: Team["leagueTier"], points = 0): Team => ({
  id: `t-${name}`, name, logo: "", isApproved: true, memberCount: 10,
  seasonStats: { points, rank: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, gamesPlayed: 0 },
  createdAt: 0, teamType: "community", leagueTier: tier, participationStreak: 0,
});

test("12팀은 A·B 6팀씩으로 갈린다", () => {
  const teams = Array.from({ length: 12 }, (_, i) => team(`팀${i + 1}`, "bronze", 12 - i));
  const map = splitIntoGroups(teams);
  const counts = GROUP_NAMES.map((g) => Object.values(map).filter((v) => v === g).length);
  assert.deepEqual(counts, [6, 6]);
  assert.equal(Object.keys(map).length, 12);
});

// 무작위로 나누면 강팀이 한 조에 몰릴 수 있다. 뱀 순서 배분은 조별 시드 합을
// 맞춰준다 — 12팀(시드 1..12)이면 두 조 모두 39가 되어야 한다.
test("뱀 순서 배분으로 조별 전력이 맞춰진다", () => {
  const teams = Array.from({ length: 12 }, (_, i) => team(`팀${i + 1}`, "bronze", 100 - i));
  const map = splitIntoGroups(teams);
  const seedOf = new Map(teams.map((t, i) => [t.id, i + 1]));
  const sums = GROUP_NAMES.map((g) =>
    Object.entries(map).filter(([, v]) => v === g)
      .reduce((acc, [id]) => acc + (seedOf.get(id) ?? 0), 0),
  );
  assert.deepEqual(sums, [39, 39], `조별 시드 합이 어긋남: ${sums.join(" vs ")}`);
});

test("홀수 팀도 최대 1팀 차이로만 갈린다", () => {
  const teams = Array.from({ length: 11 }, (_, i) => team(`팀${i + 1}`, "bronze"));
  const counts = GROUP_NAMES.map((g) => Object.values(splitIntoGroups(teams)).filter((v) => v === g).length);
  assert.ok(Math.abs(counts[0] - counts[1]) <= 1, `쏠림: ${counts.join(" vs ")}`);
});

test("상위 티어가 한 조에 몰리지 않는다", () => {
  const teams = [
    team("프리미엄1", "premium"), team("프리미엄2", "premium"),
    team("골드1", "gold"), team("골드2", "gold"),
    team("브론즈1", "bronze"), team("브론즈2", "bronze"),
  ];
  const map = splitIntoGroups(teams);
  const premiumGroups = teams.filter((t) => t.leagueTier === "premium").map((t) => map[t.id]);
  assert.notEqual(premiumGroups[0], premiumGroups[1], "프리미엄 2팀이 같은 조에 배정됨");
});

console.log("tournament-groups tests passed");
