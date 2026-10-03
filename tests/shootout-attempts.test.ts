import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeShootoutAttempts, sameShootoutAttempts, shootoutAttemptTotals } from "../src/features/match-shootout/attempts.ts";

test("차수별 O/X는 성공만 합산하고 아직 차지 않은 끝의 빈칸은 저장 이력에서 제외한다", () => {
  const attempts = { home: [true, false, null], away: [false, true, false, null] };
  const before = JSON.stringify(attempts);
  assert.deepEqual(shootoutAttemptTotals(attempts), [1, 1]);
  assert.deepEqual(normalizeShootoutAttempts(attempts), { home: [true, false], away: [false, true, false] });
  assert.equal(JSON.stringify(attempts), before);
});

test("진행 중 동점과 양 팀 차수 차이는 그대로 보존하되 기록 사이 빈칸은 거부한다", () => {
  assert.deepEqual(normalizeShootoutAttempts({ home: [true], away: [true] }), { home: [true], away: [true] });
  assert.deepEqual(normalizeShootoutAttempts({ home: [false], away: [] }), { home: [false], away: [] });
  assert.equal(normalizeShootoutAttempts({ home: [null, true], away: [false] }), null);
  assert.equal(normalizeShootoutAttempts({ home: [true, null, false], away: [false] }), null);
});

test("총점이 같아도 O/X 순서가 바뀌면 저장 전이며 합계만 있는 기존 경기는 이력을 만들지 않는다", () => {
  const draft = { home: [true, false, null], away: [false] };
  assert.equal(sameShootoutAttempts(draft, { home: [true, false], away: [false] }), true);
  assert.equal(sameShootoutAttempts(draft, { home: [false, true], away: [false] }), false);
  assert.equal(sameShootoutAttempts(draft, undefined), false);
  assert.equal(sameShootoutAttempts({ home: [null, true], away: [] }, { home: [true], away: [] }), false);
});

test("최대 99차를 허용하고 범위를 넘거나 잘못된 결과 값은 저장하지 않는다", () => {
  assert.equal(normalizeShootoutAttempts({ home: Array(99).fill(true), away: [] })?.home.length, 99);
  assert.equal(normalizeShootoutAttempts({ home: Array(100).fill(false), away: [] }), null);
  assert.equal(normalizeShootoutAttempts({ home: ["O" as unknown as boolean], away: [] }), null);
});
