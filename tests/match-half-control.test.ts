import { test } from "node:test";
import assert from "node:assert/strict";
import { halfControlButtons } from "../src/lib/match-half-control.ts";
import {
  MATCH_DURATION_SECONDS,
  clampMatchElapsedSeconds,
  matchMinuteFromElapsed,
} from "../src/lib/match-config.ts";

type MatchProgress = Parameters<typeof halfControlButtons>[0];

const ids = (s: MatchProgress) => halfControlButtons(s).map((b) => b.id);

// 공식 규정 v2.4 제4조 — 전·후반 구분 없이 단일 경기 시간 12분. 단일 타이머 모델.
test("예정 → 경기 시작", () => {
  assert.deepEqual(ids({ status: "scheduled", isRunning: false }), ["start"]);
});
test("진행중 → 일시정지 + 경기 종료", () => {
  assert.deepEqual(ids({ status: "live", isRunning: true }), ["pause", "endMatch"]);
});
test("일시정지 → 재개 + 경기 종료", () => {
  assert.deepEqual(ids({ status: "live", isRunning: false }), ["resume", "endMatch"]);
});
test("12분 완료 → 재개 없이 경기 종료만", () => {
  assert.deepEqual(ids({ status: "live", isRunning: false, isRegulationComplete: true }), ["endMatch"]);
  assert.deepEqual(ids({ status: "live", isRunning: true, isRegulationComplete: true }), ["endMatch"]);
});
test("종료 → 버튼 없음", () => {
  assert.deepEqual(ids({ status: "finished", isRunning: false }), []);
});
test("취소 → 버튼 없음", () => {
  assert.deepEqual(ids({ status: "cancelled", isRunning: false }), []);
});
test("경기 시작 버튼의 action 은 start", () => {
  const b = halfControlButtons({ status: "scheduled", isRunning: false }).find((x) => x.id === "start")!;
  assert.equal(b.action, "start");
  assert.equal(b.label, "경기 시작");
});
test("경기 종료 버튼의 action 은 endMatch", () => {
  const b = halfControlButtons({ status: "live", isRunning: true }).find((x) => x.id === "endMatch")!;
  assert.equal(b.action, "endMatch");
  assert.equal(b.label, "경기 종료");
});
test("플레이 시간은 0초 이상 12분 이하로 보정", () => {
  assert.equal(clampMatchElapsedSeconds(-3), 0);
  assert.equal(clampMatchElapsedSeconds(11), 11);
  assert.equal(clampMatchElapsedSeconds(MATCH_DURATION_SECONDS + 30), MATCH_DURATION_SECONDS);
});
test("이벤트 기록 분은 12분을 넘지 않음", () => {
  assert.equal(matchMinuteFromElapsed(0), 0);
  assert.equal(matchMinuteFromElapsed(719), 11);
  assert.equal(matchMinuteFromElapsed(720), 12);
  assert.equal(matchMinuteFromElapsed(900), 12);
});

console.log("match-half-control tests passed");
