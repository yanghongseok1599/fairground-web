import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveMatchTrack } from "../src/lib/match-operation-access.ts";

const match = { homeTeamId: "H", awayTeamId: "A" };
type TrackPlayer = NonNullable<Parameters<typeof resolveMatchTrack>[0]>;

const player = (overrides: Partial<TrackPlayer> & Pick<TrackPlayer, "role">): TrackPlayer => ({
  isApproved: true,
  teamId: "",
  teamRole: undefined,
  ...overrides,
});

test("admin → admin 관리뷰", () => {
  const p = player({ role: "admin" });
  assert.equal(resolveMatchTrack(p, match), "admin");
});
test("승인 심판 → referee 전체화면", () => {
  const p = player({ role: "referee", isApproved: true });
  assert.equal(resolveMatchTrack(p, match), "referee");
});
test("미승인 심판 → none", () => {
  const p = player({ role: "referee", isApproved: false });
  assert.equal(resolveMatchTrack(p, match), "none");
});
test("참가팀 감독(coach) → coach 교체", () => {
  const p = player({ role: "player", teamId: "H", teamRole: "coach" });
  assert.equal(resolveMatchTrack(p, match), "coach");
});
test("참가팀 캡틴(captain) → coach 교체", () => {
  const p = player({ role: "player", teamId: "H", teamRole: "captain" });
  assert.equal(resolveMatchTrack(p, match), "coach");
});
test("참가팀 매니저(manager) → none", () => {
  const p = player({ role: "player", teamId: "H", teamRole: "manager" });
  assert.equal(resolveMatchTrack(p, match), "none");
});
test("비참가팀 매니저 → none", () => {
  const p = player({ role: "player", teamId: "X", teamRole: "manager" });
  assert.equal(resolveMatchTrack(p, match), "none");
});
test("일반 선수 → none", () => {
  const p = player({ role: "player", teamId: "H", teamRole: "member" });
  assert.equal(resolveMatchTrack(p, match), "none");
});
test("null player → none", () => {
  assert.equal(resolveMatchTrack(null, match), "none");
});

console.log("match-operation-access tests passed");
