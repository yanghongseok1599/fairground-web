import assert from 'node:assert/strict';
import { test } from 'node:test';
import { moduleLoader } from './helpers/load-ts-module.mjs';
const { finalPlacements, finalRankCardType } = moduleLoader()('src/features/standings/final-placements.ts');
const t = { id: 'cup', groups: [{ teamIds: ['a1','a2','a3','a4'] }, { teamIds: ['b1','b2','b3','b4'] }] };
const game = (round, home, away, homeScore = 2, awayScore = 1) => ({ id: String(round), tournamentId: 'cup', round, homeTeamId: home, homeTeamName: home, awayTeamId: away, awayTeamName: away, homeScore, awayScore, status: 'finished' });
const games = [game(13,'a3','b4'),game(14,'a4','b3'),game(15,'a1','b2'),game(16,'a2','b1'),game(17,'b4','b3'),game(18,'a3','a4'),game(19,'b2','b1'),game(20,'a1','a2')];
test('운영가이드 네 순위결정전 승패로 1~8위를 확정한다', () => {
 assert.deepEqual(finalPlacements(t,games).map(r=>r.teamId), ['a1','a2','b2','b1','a3','a4','b4','b3']);
});
test('정규 동점 경기의 승부차기 승자가 다음 라운드와 최종 순위를 결정한다', () => {
 const tied = games.map(m => ({ ...m, homeScore: 0, awayScore: 0, homeShootoutScore: 3, awayShootoutScore: 2 }));
 assert.deepEqual(finalPlacements(t,tied).map(r=>r.teamId), ['a1','a2','b2','b1','a3','a4','b4','b3']);
 assert.deepEqual(finalPlacements(t,tied.map(m=>m.round===20?{...m,homeShootoutScore:2,awayShootoutScore:3}:m)).map(r=>r.teamId), ['a2','a1','b2','b1','a3','a4','b4','b3']);
});
test('승부차기가 동점이거나 한 팀 점수가 없으면 최종 순위를 확정하지 않는다', () => {
 const unresolved = games.map(m=>m.round===20?{...m,homeScore:0,awayScore:0,homeShootoutScore:2,awayShootoutScore:2}:m);
 assert.deepEqual(finalPlacements(t,unresolved),[]);
 assert.deepEqual(finalPlacements(t,unresolved.map(m=>m.round===20?{...m,awayShootoutScore:undefined}:m)),[]);
});
test('미완료·동점·준결승과 다른 출전팀·중복 경기면 최종순위를 추정하지 않는다', () => {
 assert.deepEqual(finalPlacements(t,games.slice(0,-1)),[]);
 assert.deepEqual(finalPlacements(t,games.map(m=>m.round===20?{...m,status:'live'}:m)),[]);
 assert.deepEqual(finalPlacements(t,games.map(m=>m.round===20?{...m,awayScore:2}:m)),[]);
 assert.deepEqual(finalPlacements(t,[...games.slice(0,-1),game(20,'a1','b1')]),[]);
 assert.deepEqual(finalPlacements(t,[...games,games[7]]),[]);
});
test('1위 플래티넘, 2~5위 골드, 6~8위 실버이며 미확정 순위는 등급 없음', () => {
 assert.deepEqual([1,2,3,4,5,6,7,8].map(finalRankCardType),['premium','gold','gold','gold','gold','silver','silver','silver']);
 for (const rank of [0,9,1.5,NaN]) assert.equal(finalRankCardType(rank),undefined);
});
