import assert from 'node:assert/strict';
import { test } from 'node:test';
import { moduleLoader } from './helpers/load-ts-module.mjs';

const { resolveKnockoutFixtures, KNOCKOUT_TOURNAMENT_ID } = moduleLoader()('src/features/knockout-schedule/resolve-knockout-fixtures.ts');
const team = {
  legacy: ['legacy', 'FC LEGACY'], rootA: ['root-a', 'ROOT FC A팀'],
  rootB: ['root-b', 'ROOT FC B팀'], white: ['white', 'FC흰둥이'],
  interest: ['interest', '데카트론 관심점'], bob: ['bob', 'BOB FS'],
  watermelon: ['watermelon', 'FC 수박'], love: ['love', '데카트론 사랑점'],
};
const game = (round, home, away, homeScore = 2, awayScore = 0, extra = {}) => ({
  id: `match-${round}`, tournamentId: KNOCKOUT_TOURNAMENT_ID, round,
  homeTeamId: team[home][0], homeTeamName: team[home][1],
  awayTeamId: team[away][0], awayTeamName: team[away][1],
  homeScore, awayScore, status: 'finished', ...extra,
});
const semifinal = [
  game(13, 'legacy', 'rootA', 4, 0),
  game(14, 'rootB', 'white', 0, 0, { homeShootoutScore: 0, awayShootoutScore: 1 }),
  game(15, 'interest', 'bob', 0, 2),
  game(16, 'watermelon', 'love', 1, 0),
];
const next = (games) => resolveKnockoutFixtures(games).filter((row) => row.slot >= 17);

test('13~16 결과와 승부차기로 17~20 대진을 풀고 원래 조별순위를 팀명 앞에 유지한다', () => {
  assert.deepEqual(next(semifinal).map((row) => [row.slot, row.homeLabel, row.awayLabel]), [
    [17, 'B조 4위 · ROOT FC A팀', 'A조 4위 · ROOT FC B팀'],
    [18, 'A조 3위 · FC LEGACY', 'B조 3위 · FC흰둥이'],
    [19, 'A조 1위 · 데카트론 관심점', 'B조 1위 · 데카트론 사랑점'],
    [20, 'B조 2위 · BOB FS', 'A조 2위 · FC 수박'],
  ]);
  assert.deepEqual(next(semifinal).map((row) => row.time), ['15:20–15:40', '15:40–16:00', '16:00–16:20', '16:20–16:40']);
  assert.ok(next(semifinal).every((row) => row.matchId === undefined && row.status === undefined));
});

test('진행중이거나 무승부 PK 미확정이면 그 팀의 승자/패자를 추정하지 않는다', () => {
  for (const uncertain of [
    { status: 'live' },
    { homeScore: 0, awayScore: 0 },
    { homeScore: 0, awayScore: 0, homeShootoutScore: 1, awayShootoutScore: 1 },
  ]) {
    const games = semifinal.map((match) => match.round === 16 ? { ...match, ...uncertain } : match);
    const rows = next(games);
    assert.equal(rows[2].away, '16경기 패자');
    assert.equal(rows[3].away, '16경기 승자');
    assert.equal(rows[3].awayRank, undefined);
  }
});

test('16경기의 PK 원정 승리도 결승과 3·4위전 팀으로 반영한다', () => {
  const games = semifinal.map((match) => match.round === 16 ? {
    ...match, homeScore: 0, awayScore: 0, homeShootoutScore: 2, awayShootoutScore: 3,
  } : match);
  const rows = next(games);
  assert.equal(rows[2].away, 'FC 수박');
  assert.equal(rows[3].away, '데카트론 사랑점');
});

test('실제로 등록된 다음 경기의 ID/팀/상태가 파생 대진에 우선한다', () => {
  const registered = game(20, 'love', 'bob', 0, 0, { status: 'scheduled' });
  const final = next([...semifinal, registered])[3];
  assert.equal(final.matchId, 'match-20');
  assert.equal(final.status, 'scheduled');
  assert.equal(final.homeLabel, 'B조 1위 · 데카트론 사랑점');
  assert.equal(final.awayLabel, 'B조 2위 · BOB FS');
});

test('다른 대회·조별 경기·중복 경기 결과는 대진 결정에 사용하지 않고 원본을 보존한다', () => {
  const rows = resolveKnockoutFixtures(semifinal.map((match) => ({ ...match, tournamentId: 'another-cup' })));
  assert.equal(rows[4].home, '13경기 패자');
  assert.equal(next(semifinal.map((match) => ({ ...match, groupId: 'league-group' })))[0].home, '13경기 패자');
  assert.equal(next([...semifinal, semifinal[0]])[0].home, '13경기 패자');
  const before = JSON.stringify(semifinal);
  resolveKnockoutFixtures(semifinal);
  assert.equal(JSON.stringify(semifinal), before);
});

test('현재컵 17경기의 실제 취소행에만 양팀 기권·미실시를 표시하고 승패를 부여하지 않는다', () => {
  const cancelled = game(17, 'rootA', 'rootB', 0, 0, { status: 'cancelled' });
  const rows = resolveKnockoutFixtures([...semifinal, cancelled, game(18, 'legacy', 'white', 0, 0, { status: 'cancelled' })]);
  const seventh = rows.find((row) => row.slot === 17);
  assert.equal(seventh.matchId, 'match-17');
  assert.equal(seventh.status, 'cancelled');
  assert.equal(seventh.note, '양팀 기권 · 미실시');
  assert.equal(seventh.homeLabel, 'B조 4위 · ROOT FC A팀');
  assert.equal(seventh.awayLabel, 'A조 4위 · ROOT FC B팀');
  assert.equal(seventh.homeScore, 0);
  assert.equal(seventh.homeShootoutScore, undefined);
  assert.equal(rows.find((row) => row.slot === 18).note, undefined);
  assert.equal(resolveKnockoutFixtures(semifinal).find((row) => row.slot === 17).note, undefined);
  assert.equal(resolveKnockoutFixtures([{ ...cancelled, tournamentId: 'another-cup' }]).find((row) => row.slot === 17).note, undefined);
});
