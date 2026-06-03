import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildRotationFixture,
  computeSeedRest,
  assignSeedsByStreak,
  buildRestOptimizedMatches,
} from "../src/lib/fixture-scheduler.ts";

// 6팀 라운드로빈: 5라운드 × 3슬롯 = 15경기, 각 팀 5경기.
test("6팀 → 15경기, 각 팀 5경기, 5라운드×3슬롯", () => {
  const f = buildRotationFixture(6);
  assert.equal(f.length, 15);
  const rounds = new Set(f.map((m) => m.round));
  assert.deepEqual([...rounds].sort((a, b) => a - b), [1, 2, 3, 4, 5]);
  // 각 라운드 3슬롯
  for (let r = 1; r <= 5; r++) {
    const slots = f.filter((m) => m.round === r).map((m) => m.slot).sort();
    assert.deepEqual(slots, [1, 2, 3]);
  }
  // 각 시드 5경기
  for (let s = 1; s <= 6; s++) {
    const count = f.filter((m) => m.home === s || m.away === s).length;
    assert.equal(count, 5, `seed ${s} should play 5`);
  }
  // 모든 페어 유일(라운드로빈)
  const pairs = new Set(f.map((m) => [m.home, m.away].sort((a, b) => a - b).join("-")));
  assert.equal(pairs.size, 15);
});

test("피벗(최고 시드 6)은 매 라운드 1번 슬롯 고정", () => {
  const f = buildRotationFixture(6);
  for (let r = 1; r <= 5; r++) {
    const slot1 = f.find((m) => m.round === r && m.slot === 1)!;
    assert.ok(slot1.home === 6 || slot1.away === 6, `round ${r} slot1 should include pivot 6`);
  }
});

// 휴식 분포(15분 슬롯 / 12분 경기): 스크린샷과 동일하게 {147,147,132,132,117,117}.
test("computeSeedRest: 휴식 총합 분포가 스크린샷과 일치", () => {
  const rest = computeSeedRest(6, { matchLenMin: 12, breakMin: 3 });
  const totals = rest.map((r) => r.totalRest).sort((a, b) => b - a);
  assert.deepEqual(totals, [147, 147, 132, 132, 117, 117]);
  // 각 시드 휴식 구간은 4개(5라운드 사이)
  for (const r of rest) assert.equal(r.rests.length, 4);
});

test("피벗 시드는 균등 휴식(33×4=132)", () => {
  const rest = computeSeedRest(6, { matchLenMin: 12, breakMin: 3 });
  const pivot = rest.find((r) => r.seed === 6)!;
  assert.deepEqual(pivot.rests, [33, 33, 33, 33]);
  assert.equal(pivot.totalRest, 132);
});

// 연속참가(streak) 높은 팀이 휴식 총합 높은 시드를 가져간다.
test("assignSeedsByStreak: streak 높은 팀이 최고휴식 시드 배정", () => {
  const teams = [
    { id: "a", participationStreak: 0 },
    { id: "b", participationStreak: 4 }, // 최다 연속 → 최고휴식
    { id: "c", participationStreak: 1 },
    { id: "d", participationStreak: 3 },
    { id: "e", participationStreak: 0 },
    { id: "f", participationStreak: 2 },
  ];
  const result = assignSeedsByStreak(teams, { matchLenMin: 12, breakMin: 3 });
  // 가장 높은 streak 팀(b)은 최고 휴식 총합을 받아야 한다.
  const maxRest = Math.max(...result.map((r) => r.totalRest));
  const bAssign = result.find((r) => r.team.id === "b")!;
  assert.equal(bAssign.totalRest, maxRest);
  // streak 내림차순 ↔ 휴식 내림차순 단조 (동률 허용)
  const byStreak = [...result].sort(
    (x, y) => (y.team.participationStreak ?? 0) - (x.team.participationStreak ?? 0),
  );
  for (let i = 1; i < byStreak.length; i++) {
    assert.ok(
      byStreak[i - 1].totalRest >= byStreak[i].totalRest,
      "higher streak must not get less rest",
    );
  }
  assert.equal(result.length, 6);
});

test("buildRestOptimizedMatches: 경기 생성 + 시드 배정", () => {
  const teams = [
    { id: "t1", name: "A", participationStreak: 0 },
    { id: "t2", name: "B", participationStreak: 4 },
    { id: "t3", name: "C", participationStreak: 1 },
    { id: "t4", name: "D", participationStreak: 3 },
    { id: "t5", name: "E", participationStreak: 0 },
    { id: "t6", name: "F", participationStreak: 2 },
  ];
  const { matches, assignments } = buildRestOptimizedMatches(teams, "tour-1");
  // 6팀 단일 풀리그 = 15경기
  assert.equal(matches.length, 15);
  // 각 팀 5경기, 모든 매치 실제 팀 id 매핑
  for (const t of teams) {
    const c = matches.filter((m) => m.homeTeamId === t.id || m.awayTeamId === t.id).length;
    assert.equal(c, 5, `${t.name} should play 5`);
  }
  // 배정은 6개, streak 최다(B)가 최고 휴식
  assert.equal(assignments.length, 6);
  const maxRest = Math.max(...assignments.map((a) => a.totalRest));
  assert.equal(assignments.find((a) => a.team.id === "t2")!.totalRest, maxRest);
  // 모든 경기 tournamentId/상태 일관
  assert.ok(matches.every((m) => m.tournamentId === "tour-1" && m.status === "scheduled"));
});

test("buildRestOptimizedMatches: 홀수 팀이면 예외", () => {
  assert.throws(() =>
    buildRestOptimizedMatches(
      [
        { id: "1", name: "A" },
        { id: "2", name: "B" },
        { id: "3", name: "C" },
      ],
      "t",
    ),
  );
});

console.log("fixture-scheduler tests passed");
