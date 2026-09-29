import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGroupRoundRobinMatches } from '../src/lib/auto-matchmaking.ts';
import { buildCueSheet, buildSavedCueSheet } from '../src/lib/cue-sheet.ts';
import { DEFAULT_FIXTURE_TIMING } from '../src/lib/fixture-timetable.ts';
import { courtMatches, timeline } from '../public/cup-ops/data.js';
import { MATCH_DURATION_MINUTES, MATCH_SLOT_MINUTES } from '../src/lib/match-config.ts';
import { schedule as mcSchedule } from '../public/cup-ops/simaek/data.js';
import { teamSeeds } from '../public/cup-ops/team-seeds.js';
import { matchReportTime, REPORT_LEAD_MINUTES } from '../public/cup-ops/match-report-time.js';
import { MATCH_REPORT_LEAD_MINUTES } from '../src/lib/match-config.ts';

const groups = ['A', 'B'].map(name => ({
  id: name, name, court: 'A구장', standings: [],
  teamIds: [1, 2, 3, 4].map(seed => `${name}${seed}`),
}));
const teams = Object.entries(teamSeeds).map(([id, name]) => ({ id, name }));
const timing = { ...DEFAULT_FIXTURE_TIMING, date: '2026-10-03' };

test('20경기 모두 시작 5분 전 집합 시각을 표시한다', () => {
  assert.equal(REPORT_LEAD_MINUTES, MATCH_REPORT_LEAD_MINUTES);
  assert.equal(REPORT_LEAD_MINUTES, 5);
  for (const row of courtMatches) {
    const start = Date.parse(`2026-10-03T${row.time.slice(0, 5)}:00+09:00`);
    const report = Date.parse(`2026-10-03T${row.reportTime}:00+09:00`);
    assert.equal(start-report, 5*60_000);
  }
  assert.equal(courtMatches[0].reportTime, '09:55');
  assert.equal(courtMatches[19].reportTime, '16:15');
  assert.equal(matchReportTime('00:03'), '23:58');
  assert.throws(() => matchReportTime('24:10'));
});

test('확정 가이드·자동 생성·큐시트의 12경기 대진, 전체 순번, 시간이 같다', () => {
  const generated = buildGroupRoundRobinMatches(groups, [...teams].reverse(), 'cup', timing);
  const preview = buildCueSheet(groups.map(group => ({
    name: group.name, teamNames: group.teamIds.map(id => teams.find(team => team.id === id)!.name),
  })), timing);
  const saved = buildSavedCueSheet(generated.map((match, i) => ({ ...match, id: String(i) })).reverse(), groups, timing.date);
  assert.deepEqual(saved.rows, preview.rows);
  assert.equal(generated.length, 12);
  assert.equal(new Set(generated.map(match => match.scheduledAt)).size, 12);
  assert.equal(new Set(generated.map(match => [match.homeTeamId, match.awayTeamId].sort().join(':'))).size, 12);
  for (const [index, match] of generated.entries()) {
    const guide = courtMatches[index];
    assert.equal(match.round, guide.slot);
    assert.equal(`${match.homeTeamName} vs ${match.awayTeamName}`, guide.match);
    assert.equal(match.scheduledAt, Date.parse(`${timing.date}T${guide.time.slice(0,5)}:00+09:00`));
    assert.equal(preview.rows[index].court, 'A구장');
    if (index) assert.equal(match.scheduledAt - generated[index - 1].scheduledAt, 20 * 60_000);
  }
  for (const team of teams) assert.equal(generated.filter(match => [match.homeTeamId, match.awayTeamId].includes(team.id)).length, 3);
  assert.deepEqual(saved.courtEnd, { 'A구장': '13:52' });
  assert.equal(courtMatches[12].time, '14:00–14:20');
  assert.equal(courtMatches[19].time, '16:20–16:40');
});

test('단일 구장 점심은 두 조에 공통 적용하며 경기 시각이 겹치지 않는다', () => {
  const generated = buildGroupRoundRobinMatches(groups, teams, 'cup', { ...timing, startTime: '12:40', lunchStart: '13:00', lunchMinutes: 50 });
  assert.equal(generated[1].scheduledAt, Date.parse('2026-10-03T13:50:00+09:00'));
  assert.equal(generated[2].scheduledAt, Date.parse('2026-10-03T14:10:00+09:00'));
});

test('크기가 다른 홀수 조도 부전승 없이 한 구장에 순차 편성한다', () => {
  const smaller = groups.map((group, index) => ({ ...group, teamIds: group.teamIds.slice(0, index ? 2 : 3) }));
  const generated = buildGroupRoundRobinMatches(smaller, teams, 'cup', timing);
  assert.equal(generated.length, 4);
  assert.equal(new Set(generated.map(match => match.scheduledAt)).size, 4);
  assert.deepEqual(generated.map(match => match.groupId), ['A', 'B', 'A', 'A']);
});


test('경기 타이머는 12분이며 운영팀·MC 진행표는 20분 간격의 전체 20경기와 일치한다', () => {
  assert.equal(MATCH_DURATION_MINUTES, 12);
  assert.equal(MATCH_SLOT_MINUTES, 20);
  const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  courtMatches.forEach((row, index) => {
    assert.equal(row.time, `${clock(600 + index * 20)}–${clock(600 + (index + 1) * 20)}`);
  });
  assert.equal(timeline[1].rows[0][0], '10:00–14:00');
  assert.equal(timeline[1].rows[1][0], '14:00–16:40');
  assert.equal(timeline[3].rows[0][0], '16:40–17:05');
  assert.equal(mcSchedule[3].time, '10:00–14:00');
  assert.equal(mcSchedule[4].time, '14:00–15:20');
  assert.equal(mcSchedule[5].time, '15:20–16:00');
  assert.equal(mcSchedule[6].time, '16:00–16:40');
  assert.equal(mcSchedule[7].time, '16:40–17:05');
  assert.equal(mcSchedule[8].time, '17:05–17:10');
});
