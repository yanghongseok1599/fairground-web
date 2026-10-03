import assert from "node:assert/strict";
import { test } from "node:test";
import { filterMomPlayerOptions } from "../src/features/match-control/mom-player-options.ts";

const options = [
  { value: "none", label: "MOM 없음" },
  { value: "home-99", teamId: "home", label: "#99 다른 선수 (ALA) - 데카트론 관심점" },
  { value: "bob-99", teamId: "away", label: "#99 구준형 (ALA) - BOB FS" },
  { value: "bob-00", teamId: "away", label: "#00 김영희 (GK) - BOB FS" },
];

test("MOM 등번호 검색 후 원정팀을 골라 동번호 선수를 구분한다", () => {
  assert.deepEqual(filterMomPlayerOptions(options, "99", "").map((p) => p.value), ["home-99", "bob-99"]);
  assert.deepEqual(filterMomPlayerOptions(options, "99", "away").map((p) => p.value), ["bob-99"]);
});

test("선수명, 팀명, 등번호를 함께 검색하고 영문 대소문자와 전각 입력을 허용한다", () => {
  assert.deepEqual(filterMomPlayerOptions(options, " bob   ９９ 구준형 ", "").map((p) => p.value), ["bob-99"]);
  assert.deepEqual(filterMomPlayerOptions(options, "#00", "away").map((p) => p.value), ["bob-00"]);
  assert.deepEqual(filterMomPlayerOptions(options, "존재하지 않는 선수", ""), []);
});

test("목록이 새 객체로 갱신되어도 검색 대상과 선수 ID를 유지하며 원본을 변경하지 않는다", () => {
  const before = JSON.stringify(options);
  const next = options.map((option) => ({ ...option }));
  assert.deepEqual(filterMomPlayerOptions(next, "99", "away"), filterMomPlayerOptions(options, "99", "away"));
  assert.equal(JSON.stringify(options), before);
  assert.deepEqual(filterMomPlayerOptions(options, "", ""), options);
});
