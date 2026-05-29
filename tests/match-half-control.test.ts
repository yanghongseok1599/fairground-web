import { test } from "node:test";
import assert from "node:assert/strict";
import { halfControlButtons, canStartSecondHalf } from "../src/lib/match-half-control.ts";

const ids = (s: any) => halfControlButtons(s).map((b) => b.id);

test("예정 → 전반시작", () => {
  assert.deepEqual(ids({ status: "scheduled", currentHalf: 1, isRunning: false }), ["startFirst"]);
});
test("전반 진행중 → 일시정지 + 전반종료", () => {
  assert.deepEqual(ids({ status: "live", currentHalf: 1, isRunning: true }), ["pause", "endFirst"]);
});
test("전반 일시정지 → 재개 + 전반종료", () => {
  assert.deepEqual(ids({ status: "live", currentHalf: 1, isRunning: false }), ["resume", "endFirst"]);
});
test("후반 진행중 → 일시정지 + 후반종료", () => {
  assert.deepEqual(ids({ status: "live", currentHalf: 2, isRunning: true }), ["pause", "endSecond"]);
});
test("후반 일시정지 → 재개 + 후반종료", () => {
  assert.deepEqual(ids({ status: "live", currentHalf: 2, isRunning: false }), ["resume", "endSecond"]);
});
test("종료 → 버튼 없음", () => {
  assert.deepEqual(ids({ status: "finished", currentHalf: 2, isRunning: false }), []);
});
test("취소 → 버튼 없음", () => {
  assert.deepEqual(ids({ status: "cancelled", currentHalf: 1, isRunning: false }), []);
});
test("전반종료 버튼의 action 은 pause, label 은 '전반 종료'", () => {
  const b = halfControlButtons({ status: "live", currentHalf: 1, isRunning: true }).find((x) => x.id === "endFirst")!;
  assert.equal(b.action, "pause");
  assert.equal(b.label, "전반 종료");
});
test("후반종료 버튼의 action 은 endMatch", () => {
  const b = halfControlButtons({ status: "live", currentHalf: 2, isRunning: true }).find((x) => x.id === "endSecond")!;
  assert.equal(b.action, "endMatch");
  assert.equal(b.label, "후반 종료");
});
test("canStartSecondHalf: 전반 일시정지에서만 true", () => {
  assert.equal(canStartSecondHalf({ status: "live", currentHalf: 1, isRunning: false }), true);
  assert.equal(canStartSecondHalf({ status: "live", currentHalf: 1, isRunning: true }), false);
  assert.equal(canStartSecondHalf({ status: "live", currentHalf: 2, isRunning: false }), false);
  assert.equal(canStartSecondHalf({ status: "scheduled", currentHalf: 1, isRunning: false }), false);
});

console.log("match-half-control tests passed");
