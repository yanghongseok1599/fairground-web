import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveMatchTrack } from "../src/lib/match-operation-access.ts";

const match = { homeTeamId: "H", awayTeamId: "A", status: "live" as const };

test("admin → admin 관리뷰", () => {
  const p = { role: "admin" } as any;
  assert.equal(resolveMatchTrack(p, match), "admin");
});
test("승인 심판 → referee 전체화면", () => {
  const p = { role: "referee", isApproved: true } as any;
  assert.equal(resolveMatchTrack(p, match), "referee");
});
test("미승인 심판 → none", () => {
  const p = { role: "referee", isApproved: false } as any;
  assert.equal(resolveMatchTrack(p, match), "none");
});
test("참가팀 감독(coach) → coach 교체", () => {
  const p = { role: "player", teamId: "H", teamRole: "coach" } as any;
  assert.equal(resolveMatchTrack(p, match), "coach");
});
test("비참가팀 감독 → none", () => {
  const p = { role: "player", teamId: "X", teamRole: "manager" } as any;
  assert.equal(resolveMatchTrack(p, match), "none");
});
test("일반 선수 → none", () => {
  const p = { role: "player", teamId: "H", teamRole: "member" } as any;
  assert.equal(resolveMatchTrack(p, match), "none");
});
test("null player → none", () => {
  assert.equal(resolveMatchTrack(null, match), "none");
});
