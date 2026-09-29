import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGroupRoundRobinMatches } from "../src/lib/auto-matchmaking.ts";
import { buildCueSheet, buildSavedCueSheet } from "../src/lib/cue-sheet.ts";
import { buildFixtureTimetable, fixtureTimestamp } from "../src/lib/fixture-timetable.ts";
import { restoreGroupAssignment, orderGroupMembers } from "../src/lib/group-assignment.ts";
import { compareScheduledMatches, groupLabel } from "../src/lib/match-schedule.ts";

const timing = { date: "2026-10-03", startTime: "10:00", lunchStart: "13:00", lunchMinutes: 50 };
const makeGroup = (count: number, name: string) => ({
  id: `group-${name}`, name: `${name}조`,
  teamIds: Array.from({ length: count }, (_, i) => `${name}${i + 1}`), standings: [],
});

for (const count of [2, 3, 4, 5, 6, 8]) {
  test(`${count}팀: 큐시트와 저장 대진의 시드·순서·시각이 같고 모든 쌍이 한 번 만난다`, () => {
    const groups = [makeGroup(count, "A"), makeGroup(count, "B")];
    const teams = groups.flatMap((g) => g.teamIds.map((id) => ({ id, name: id })));
    const generated = buildGroupRoundRobinMatches(groups, [...teams].reverse(), "tournament", timing);
    const preview = buildCueSheet(groups.map((g) => ({ name: g.name, teamNames: g.teamIds })), timing);
    assert.equal(generated.length, count * (count - 1));
    assert.equal(new Set(generated.map((m) => [m.homeTeamId, m.awayTeamId].sort().join(":"))).size, generated.length);
    generated.forEach((match, index) => {
      const row = preview.rows[index];
      assert.equal(match.homeTeamId, row.home);
      assert.equal(match.awayTeamId, row.away);
      assert.equal(match.round, row.order);
      assert.equal(match.scheduledAt, Date.parse(`${timing.date}T${row.start}:00+09:00`));
    });
    assert.equal(generated[0].scheduledAt, generated[count * (count - 1) / 2].scheduledAt);
  });
}

test("4팀 첫 2경기에는 모든 팀이 한 번씩 출전한다 (같은 팀 3연속 경기 회귀 방지)", () => {
  const schedule = buildFixtureTimetable(4, timing);
  assert.equal(new Set(schedule.slice(0, 2).flatMap((m) => [m.home, m.away])).size, 4);
});

test("대회 날짜의 한국 시간, 자정 이후, 잘못된 날짜를 처리한다", () => {
  assert.equal(new Date(fixtureTimestamp("2026-10-03", 600)).toISOString(), "2026-10-03T01:00:00.000Z");
  assert.equal(new Date(fixtureTimestamp("2026-10-03", 1500)).toISOString(), "2026-10-03T16:00:00.000Z");
  assert.throws(() => fixtureTimestamp("2026-02-30", 600));
  assert.throws(() => fixtureTimestamp("", 600));
});

test("점심과 겹치는 경기만 점심 뒤로 이동한다", () => {
  const rows = buildFixtureTimetable(4, { ...timing, startTime: "12:55" });
  assert.equal(rows[0].startMinute, 13 * 60 + 50);
  assert.equal(rows[1].startMinute, 14 * 60 + 5);
  assert.equal(buildFixtureTimetable(4, { ...timing, startTime: "12:55", lunchMinutes: 0 })[0].startMinute, 12 * 60 + 55);
  assert.throws(() => buildFixtureTimetable(4, { ...timing, lunchStart: "잘못된 시각" }));
  assert.throws(() => buildFixtureTimetable(4, { ...timing, lunchMinutes: NaN }));
});

test("A와 A조를 같은 편성으로 복원하고 DB 반환 순서와 무관하게 시드를 유지한다", () => {
  const group = makeGroup(4, "A");
  assert.deepEqual(restoreGroupAssignment([group]), { A1: "A", A2: "A", A3: "A", A4: "A" });
  assert.deepEqual(orderGroupMembers([{ id: "A3" }, { id: "A1" }, { id: "A4" }, { id: "A2" }], group).map((t) => t.id), group.teamIds);
  assert.equal(groupLabel("A조"), "A조");
});

test("중복 편성·누락 팀은 일부 경기 생성 전에 차단한다", () => {
  const group = makeGroup(4, "A");
  const teams = group.teamIds.map((id) => ({ id, name: id }));
  assert.throws(() => buildGroupRoundRobinMatches([group], teams.slice(1), "t", timing), /찾을 수/);
  assert.throws(() => buildGroupRoundRobinMatches([group, group], teams, "t", timing), /중복/);
});

test("저장된 큐시트는 설정 기본값 대신 실제 저장 시각을 사용하며 날짜 오류를 알린다", () => {
  const group = makeGroup(4, "A");
  const teams = group.teamIds.map((id) => ({ id, name: id }));
  const matches = buildGroupRoundRobinMatches([group], teams, "t", { ...timing, startTime: "09:30" })
    .map((m, i) => ({ ...m, id: String(i) }));
  const result = buildSavedCueSheet([...matches].reverse(), [group], timing.date);
  assert.equal(result.rows[0].start, "09:30");
  assert.equal(result.warnings.length, 0);
  assert.equal(buildSavedCueSheet(matches, [group], "2026-10-04").warnings.length, 1);
});

test("목록은 시각→경기 번호로 정렬하고 원본을 수정하지 않는다", () => {
  const first = { id: "a", scheduledAt: 1000, round: 4 };
  const second = { id: "b", scheduledAt: 2000, round: 1 };
  const input = [second, first];
  assert.deepEqual([...input].sort(compareScheduledMatches), [first, second]);
  assert.deepEqual(input, [second, first]);
});
