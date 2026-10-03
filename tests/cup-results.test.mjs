import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { moduleLoader } from './helpers/load-ts-module.mjs';

const load = moduleLoader();
const { buildCupResults } = load('src/features/cup-results/model.ts');
const { CUP_RESULTS_TOURNAMENT_ID, PUBLISHED_MOM_RECIPIENTS } = load('src/features/cup-results/data.ts');
const male = PUBLISHED_MOM_RECIPIENTS.find(recipient => recipient.awardId === 'mens-mom');
const female = PUBLISHED_MOM_RECIPIENTS.find(recipient => recipient.awardId === 'womens-mom');
const teams = {
  a1: '데카트론 관심점', a2: 'FC 수박', a3: 'FC LEGACY', a4: 'ROOT FC B팀',
  b1: '데카트론 사랑점', b2: 'BOB FS', b3: 'ROOT FC A팀', b4: 'FC흰둥이',
};
const tournament = {
  id: CUP_RESULTS_TOURNAMENT_ID,
  groups: [{ teamIds: ['a1', 'a2', 'a3', 'a4'] }, { teamIds: ['b1', 'b2', 'b3', 'b4'] }],
};
const game = (round, home, away, homeScore = 2, awayScore = 1) => ({
  id: `match-${round}`, tournamentId: tournament.id, round,
  homeTeamId: home, awayTeamId: away, homeTeamName: teams[home], awayTeamName: teams[away],
  homeScore, awayScore, status: 'finished', events: [],
});
function fixtures() {
  const games = [
    game(1, 'a4', 'a3'), game(2, 'b1', 'b2'), game(3, 'a1', 'a2'), game(4, 'b3', 'b4'),
    game(5, 'a4', 'a1'), game(6, 'a3', 'a2'), game(7, 'b1', 'b3'), game(8, 'b2', 'b4'),
    game(9, 'a4', 'a2'), game(10, 'a3', 'a1'), game(11, 'b1', 'b4'), game(12, 'b2', 'b3'),
    game(13, 'a3', 'b3'), game(14, 'a4', 'b4', 0, 1),
    game(15, 'a1', 'b2', 0, 1), game(16, 'a2', 'b1', 0, 1),
    { ...game(17, 'b3', 'a4'), status: 'cancelled' }, game(18, 'a3', 'b4'),
    game(19, 'a1', 'a2', 0, 1), game(20, 'b2', 'b1'),
  ];
  for (const match of games) {
    if (match.round !== 14 && match.round !== 17) match.momPlayerId = `other-${match.round}`;
  }
  for (const round of [2, 15, 20]) games[round - 1].momPlayerId = male.playerId;
  return games;
}
const goal = (id, playerId, teamId, extra = {}) => ({
  id, type: 'goal', playerId, playerName: '득점 선수', teamId, ...extra,
});
const award = (result, id) => result.awards.find(item => item.id === id);

test('20슬롯 종료와 공식 17경기 기권을 확인한 뒤 실제 승패로 6팀 순위를 구성한다', () => {
  const result = buildCupResults(tournament, fixtures());
  assert.deepEqual(result.placements.map(team => [team.rank, team.teamId]), [
    [1, 'b2'], [2, 'b1'], [3, 'a2'], [4, 'a1'], [5, 'a3'], [6, 'b4'],
  ]);
  assert.deepEqual(result.withdrawnTeams.map(team => team.teamId), ['b3', 'a4']);
  assert.deepEqual(result.missingMomRounds, [14]);
  assert.equal(result.isProvisional, true);
  assert.equal(result.matchMoms.length, 20);
  assert.equal(result.matchMoms[16].status, 'cancelled');
});

test('경기 누락·중복·미완료 또는 다른 대회면 최종 결과를 발표하지 않는다', () => {
  const games = fixtures();
  assert.equal(buildCupResults({ ...tournament, id: 'other' }, games), null);
  assert.equal(buildCupResults(tournament, games.slice(1)), null);
  assert.equal(buildCupResults(tournament, [...games, games[0]]), null);
  assert.equal(buildCupResults(tournament, games.map(match => match.round === 1 ? { ...match, round: 2 } : match)), null);
  for (const round of [1, 14, 20]) {
    for (const status of ['live', 'scheduled']) {
      assert.equal(buildCupResults(tournament, games.map(match => match.round === round ? { ...match, status } : match)), null);
    }
  }
  assert.equal(buildCupResults(tournament, games.map(match => match.round === 20 ? { ...match, status: 'cancelled' } : match)), null);
});

test('승부차기와 대진 검증은 공유 최종순위 모델의 결과를 따른다', () => {
  const games = fixtures();
  const shootout = games.map(match => match.round === 20 ? {
    ...match, homeScore: 0, awayScore: 0, homeShootoutScore: 2, awayShootoutScore: 3,
  } : match);
  assert.deepEqual(buildCupResults(tournament, shootout).placements.slice(0, 2).map(team => team.teamId), ['b1', 'b2']);
  assert.equal(buildCupResults(tournament, shootout.map(match => match.round === 20 ? { ...match, awayShootoutScore: 2 } : match)), null);
  assert.equal(buildCupResults(tournament, games.map(match => match.round === 17 ? { ...match, homeTeamId: 'a1' } : match)), null);
});

test('최다 MOM은 종료 경기의 선수 ID별로 집계하고 기권 및 시즌 누적을 제외한다', () => {
  const games = fixtures();
  games[16].momPlayerId = male.playerId;
  games[1].events.push({ id: 'historical-mom', type: 'mom', playerId: male.playerId, teamId: 'b2', playerName: male.playerName });
  const result = buildCupResults(tournament, games, [{
    id: male.playerId, name: male.playerName, teamId: 'b2', stats: { mom: 300 },
  }]);
  const winner = award(result, 'mens-mom').winners[0];
  assert.equal(winner.count, 3);
  assert.deepEqual(winner.rounds, [2, 15, 20]);
  assert.equal(winner.teamName, 'BOB FS');
  assert.equal(award(result, 'mens-mom').status, 'provisional');
});

test('공개 여성 수상자 정정은 사용자 확정 이름을 사용하며 기록 없는 횟수를 만들지 않는다', () => {
  const result = buildCupResults(tournament, fixtures());
  const winner = award(result, 'womens-mom').winners[0];
  assert.equal(winner.playerName, '김주은');
  assert.equal(winner.teamName, '데카트론 사랑점');
  assert.equal(winner.count, undefined);
  assert.deepEqual(winner.rounds, []);
  assert.equal(award(result, 'womens-mom').title, '여자 MOM');
  assert.equal(award(result, 'womens-mom').status, 'confirmed');
  assert.equal(winner.playerId, '48453796-ffde-476b-88cc-8baa2aa556c1');
  assert.equal(female.playerName, '김주은');
});

test('득점왕은 이번 대회 유효 골만 집계하고 정정 골·취소경기·다른 대회·중복 이벤트를 제외한다', () => {
  const games = fixtures();
  for (const [index, round] of [2, 7, 7, 11, 16].entries()) {
    games[round - 1].events.push(goal(`goal-${index}`, 'scorer', 'b1'));
  }
  games[1].events.push(goal('cancelled-goal', 'scorer', 'b1', { isCancelled: true }));
  games[1].events.push(goal('wrong-team', 'scorer', 'a1'));
  games[1].events.push({ ...goal('assist', 'scorer', 'b1'), type: 'assist' });
  games[1].events.push({ ...games[1].events[0] });
  games[16].events.push(goal('withdrawn-goal', 'scorer', 'b3'));
  const otherCup = { ...game(1, 'b1', 'b2'), tournamentId: 'other-cup', events: [goal('other-cup-goal', 'scorer', 'b1')] };
  const result = buildCupResults(tournament, [...games, otherCup], [{
    id: 'scorer', name: '현재 선수명', teamId: 'b1', stats: { goals: 500 },
  }]);
  assert.deepEqual(award(result, 'top-scorer').winners, [{
    playerId: 'scorer', playerName: '현재 선수명', teamId: 'b1', teamName: '데카트론 사랑점',
    count: 5, rounds: [2, 7, 7, 11, 16],
  }]);
});

test('동명이인 득점은 ID로 분리하고 득점왕 동률 후보는 모두 반환한다', () => {
  const games = fixtures();
  games[0].events.push(goal('goal-a', 'id-a', 'a3'), goal('goal-b', 'id-b', 'a4'));
  const result = buildCupResults(tournament, games);
  assert.equal(award(result, 'top-scorer').winners.length, 2);
  assert.deepEqual(award(result, 'top-scorer').winners.map(winner => [winner.playerId, winner.count]), [['id-a', 1], ['id-b', 1]]);
});

test('골레이로상은 확정 BOB FS 팀만 표시하고 선수 이름을 추정하지 않는다', () => {
  const result = buildCupResults(tournament, fixtures(), [{ id: 'keeper', name: '가상 GK', teamId: 'b2', position: 'GK' }]);
  assert.equal(award(result, 'goalkeeper').status, 'name-pending');
  assert.deepEqual(award(result, 'goalkeeper').winners, [{ teamId: 'b2', teamName: 'BOB FS', rounds: [] }]);
});

test('경기별 MOM은 공개 선수명과 소속팀을 보완하며 원본 기록을 수정하지 않는다', () => {
  const games = fixtures();
  const before = JSON.stringify(games);
  const result = buildCupResults(tournament, games, [{ id: 'other-1', name: '공개 선수', teamId: 'a3' }]);
  assert.deepEqual(result.matchMoms[0], {
    round: 1, status: 'selected', playerId: 'other-1', playerName: '공개 선수', teamId: 'a3', teamName: 'FC LEGACY',
  });
  assert.equal(JSON.stringify(games), before);
  const resolved = games.map(match => match.round === 14 ? { ...match, momPlayerId: 'other-14' } : match);
  assert.equal(buildCupResults(tournament, resolved).isProvisional, false);
  assert.equal(award(buildCupResults(tournament, resolved), 'mens-mom').status, 'confirmed');
});

test('공개 결과 소스에 전체 성별 조회나 시즌 누적 집계 의존성을 추가하지 않는다', () => {
  const source = readFileSync('src/features/cup-results/model.ts', 'utf8');
  assert.doesNotMatch(source, /\.stats\.(mom|goals)|get_admin_profiles|profiles\.gender|\.gender\b/);
});
