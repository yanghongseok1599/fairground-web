import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultFeeFor, summarizeFees, formatWon,
  EARLY_BIRD_AMOUNT, REGULAR_AMOUNT, EARLY_BIRD_DEADLINE_ISO,
  type EntryFee,
} from "../src/lib/entry-fee.ts";

test("얼리버드 마감 전후로 금액이 갈린다", () => {
  const deadline = Date.parse(EARLY_BIRD_DEADLINE_ISO);
  assert.equal(defaultFeeFor(deadline - 1000), EARLY_BIRD_AMOUNT);
  assert.equal(defaultFeeFor(deadline), EARLY_BIRD_AMOUNT);
  assert.equal(defaultFeeFor(deadline + 1000), REGULAR_AMOUNT);
  assert.equal(EARLY_BIRD_AMOUNT, 400000);
  assert.equal(REGULAR_AMOUNT, 450000);
});

const fee = (teamId: string, amount: number, status: EntryFee["status"]): EntryFee =>
  ({ teamId, amount, status, paidAt: null, memo: "" });

// 일부 입금을 수납액에 넣으면 실제보다 많이 걷힌 것처럼 보인다.
// 금액이 확정되지 않은 건은 미수금에 남겨야 대회 전에 놀라지 않는다.
test("일부 입금은 수납액이 아니라 미수금으로 잡는다", () => {
  const s = summarizeFees([
    fee("a", 400000, "paid"),
    fee("b", 400000, "partial"),
    fee("c", 450000, "unpaid"),
  ]);
  assert.equal(s.expected, 1250000);
  assert.equal(s.collected, 400000);
  assert.equal(s.outstanding, 850000);
  assert.equal(s.paidCount, 1);
  assert.equal(s.unpaidCount, 2);
});

test("12팀 완납이면 미수금 0", () => {
  const fees = Array.from({ length: 12 }, (_, i) => fee(`t${i}`, 400000, "paid"));
  const s = summarizeFees(fees);
  assert.equal(s.expected, 4800000);
  assert.equal(s.collected, 4800000);
  assert.equal(s.outstanding, 0);
  assert.equal(s.unpaidCount, 0);
});

test("빈 목록도 안전하다", () => {
  const s = summarizeFees([]);
  assert.deepEqual(
    [s.teamCount, s.expected, s.collected, s.outstanding],
    [0, 0, 0, 0],
  );
});

test("금액 표기", () => {
  assert.equal(formatWon(400000), "400,000원");
  assert.equal(formatWon(0), "0원");
});

console.log("entry-fee tests passed");
