import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { moduleLoader } from './helpers/load-ts-module.mjs';
const { finalPlacements, finalRankCardType } = moduleLoader()('src/features/standings/final-placements.ts');
const { KNOCKOUT_TOURNAMENT_ID } = moduleLoader()('src/features/knockout-schedule/fixture-operating-notes.ts');
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

const officialTournament = { ...t, id: KNOCKOUT_TOURNAMENT_ID };
const withdrawnGames = games.map(m => ({
 ...m, tournamentId: KNOCKOUT_TOURNAMENT_ID,
 ...(m.round === 17 ? { status: 'cancelled', homeScore: 0, awayScore: 0 } : {}),
}));

test('공식 17경기 양팀 기권 후 남은 세 결승이 끝나면 1~6위만 확정하고 기권팀 등급은 만들지 않는다', () => {
 const result = finalPlacements(officialTournament, withdrawnGames);
 assert.deepEqual(result.map(r => [r.rank, r.teamId]), [[1,'a1'],[2,'a2'],[3,'b2'],[4,'b1'],[5,'a3'],[6,'a4']]);
 assert.ok(result.every(r => !['b4', 'b3'].includes(r.teamId)));
 assert.deepEqual(Object.fromEntries(result.map(r => [r.teamId, finalRankCardType(r.rank)])), {
  a1:'premium', a2:'gold', b2:'gold', b1:'gold', a3:'gold', a4:'silver',
 });
 const tied = withdrawnGames.map(m => m.round === 17 ? m : {
  ...m, homeScore: 0, awayScore: 0, homeShootoutScore: 3, awayShootoutScore: 2,
 });
 assert.deepEqual(finalPlacements(officialTournament, tied).map(r => r.teamId), result.map(r => r.teamId));
});

test('기권 17경기의 팀이 두 준결승 패자와 다르거나 중복이면 부분 순위도 확정하지 않는다', () => {
 for (const patch of [
  { homeTeamId:'a3' }, { awayTeamId:'b4' }, { homeTeamId:'unregistered' }, { groupId:'league' },
 ]) assert.deepEqual(finalPlacements(officialTournament, withdrawnGames.map(m => m.round === 17 ? { ...m, ...patch } : m)), []);
 assert.deepEqual(finalPlacements(officialTournament, [...withdrawnGames, withdrawnGames.find(m => m.round === 17)]), []);
});

test('다른 대회 취소나 나머지 결승 취소·진행중·미확정 동점은 예외에 포함하지 않는다', () => {
 assert.deepEqual(finalPlacements(t, withdrawnGames.map(m => ({ ...m, tournamentId: 'cup' }))), []);
 for (const round of [18,19,20]) {
  for (const patch of [
   { status:'cancelled' }, { status:'live' }, { homeScore:0,awayScore:0 },
   { homeScore:0,awayScore:0,homeShootoutScore:1,awayShootoutScore:1 },
  ]) assert.deepEqual(finalPlacements(officialTournament, withdrawnGames.map(m => m.round === round ? { ...m, ...patch } : m)), []);
 }
 assert.deepEqual(finalPlacements(officialTournament, withdrawnGames.filter(m => m.round !== 17)), []);
});

test('기권팀과 다른 결승 참가팀이 겹치거나 원래 8팀 밖의 팀이면 부분 순위를 거부한다', () => {
 const overlap = withdrawnGames.map(m => {
  if (m.round === 15 || m.round === 20) return { ...m, homeTeamId:'b4' };
  return m;
 });
 assert.deepEqual(finalPlacements(officialTournament, overlap), []);
 const outside = withdrawnGames.map(m => m.homeTeamId === 'a1' ? { ...m, homeTeamId:'unknown' } : m);
 assert.deepEqual(finalPlacements(officialTournament, outside), []);
});

test('기권 후 확정된 6팀을 실제 최종순위 표의 6행으로 렌더링한다', () => {
 const nativeRequire = createRequire(import.meta.url);
 const renderModule = (filename, imports) => {
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
   compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', code)(
   name => Object.hasOwn(imports, name) ? imports[name] : nativeRequire(name), mod, mod.exports,
  );
  return mod.exports;
 };
 const table = renderModule('src/features/standings/final-standings-table.tsx', {
  'next/link': { default: ({ href, children }) => createElement('a', { href }, children), __esModule: true },
  './final-placements': { finalRankCardType },
 });
 const { GroupedStandingsTable } = renderModule('src/features/standings/grouped-standings-table.tsx', {
  './final-standings-table': table,
  './group-filter': { filterGroupStandings: () => [] },
  '@/components/standings-table': { StandingsTable: () => createElement('p', null, '조별 순위') },
 });
 const html = renderToStaticMarkup(createElement(GroupedStandingsTable, {
  standings: [], finalRanks: finalPlacements(officialTournament, withdrawnGames),
 }));
 assert.match(html, /대회 최종 순위/);
 assert.equal((html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1].match(/<tr /g) ?? []).length, 6);
 assert.doesNotMatch(html, /7위|8위|조별 순위/);
});
