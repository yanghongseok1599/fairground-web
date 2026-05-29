import { test } from "node:test";
import assert from "node:assert/strict";
import { computeLineupReadiness } from "../src/lib/lineup-readiness.ts";

const entry = (teamId: string, isStarter: boolean) =>
  ({ matchId: "M", teamId, playerId: "p" + Math.round(isStarter ? 1 : 0), isStarter, createdAt: 0 } as any);

test("선발 1명 이상 제출 → ready", () => {
  const r = computeLineupReadiness("H", [entry("H", true)]);
  assert.equal(r.ready, true);
});
test("교체만 있고 선발 0 → not ready", () => {
  const r = computeLineupReadiness("H", [entry("H", false)]);
  assert.equal(r.ready, false);
});
test("빈 라인업 → not ready, 라벨 '미제출'", () => {
  const r = computeLineupReadiness("H", []);
  assert.equal(r.ready, false);
  assert.equal(r.label, "미제출");
});
test("다른 팀 엔트리는 무시", () => {
  const r = computeLineupReadiness("H", [entry("A", true)]);
  assert.equal(r.ready, false);
});
test("ready 라벨은 '준비 완료'", () => {
  const r = computeLineupReadiness("H", [entry("H", true)]);
  assert.equal(r.label, "준비 완료");
});

console.log("lineup-readiness tests passed");
