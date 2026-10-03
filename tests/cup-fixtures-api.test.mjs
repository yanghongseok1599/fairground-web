import assert from 'node:assert/strict';
import test from 'node:test';
import { moduleLoader } from './helpers/load-ts-module.mjs';

const tournamentId = '5ff73034-1747-4b9e-874a-6fe19fa68ac1';
function apiFixture(reply) {
  const requests = [];
  const query = {};
  for (const method of ['select', 'eq', 'is', 'gte', 'lte', 'order', 'abortSignal', 'retry']) {
    query[method] = (...args) => { requests.push([method, ...args]); return query; };
  }
  query.then = (resolve, reject) => Promise.resolve(reply).then(resolve, reject);
  let resolverInput;
  const load = moduleLoader({
    '@/lib/supabase-server': { supabaseServer: { from(table) { requests.push(['from', table]); return query; } } },
    '@/features/knockout-schedule/resolve-knockout-fixtures': {
      KNOCKOUT_TOURNAMENT_ID: tournamentId,
      resolveKnockoutFixtures(matches) { resolverInput = matches; return [{ slot: 17, homeLabel: 'B조 4위 · 합성 홈팀', awayLabel: 'A조 4위 · 합성 원정팀' }]; },
    },
  });
  const route = load('src/app/api/cup-fixtures/route.ts');
  return { route, requests, input: () => resolverInput };
}

test('public fixture endpoint reads only published Cup match columns and resolves a fresh snapshot', async () => {
  const row = {
    id: 'synthetic-match', tournament_id: tournamentId, round: 14,
    home_team_id: 'synthetic-home', away_team_id: 'synthetic-away',
    home_team_name: '합성 홈팀', away_team_name: '합성 원정팀',
    home_score: 0, away_score: 0, home_shootout_score: 0, away_shootout_score: 1, status: 'finished',
  };
  const { route, requests, input } = apiFixture({ data: [row], error: null });
  const response = await route.GET();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('Cache-Control'), /no-store/);
  assert.equal((await response.json()).fixtures[0].slot, 17);
  assert.equal(input()[0].awayShootoutScore, 1);
  assert.equal(input()[0].homeScore, 0);
  assert.ok(requests.some(step => step[0] === 'eq' && step[1] === 'tournament_id' && step[2] === tournamentId));
  assert.ok(requests.some(step => step[0] === 'is' && step[1] === 'group_id' && step[2] === null));
  assert.ok(requests.some(step => step[0] === 'gte' && step[1] === 'round' && step[2] === 13));
  assert.ok(requests.some(step => step[0] === 'lte' && step[1] === 'round' && step[2] === 20));
  const columns = requests.find(step => step[0] === 'select')[1];
  assert.doesNotMatch(columns, /\*|profiles|photo|mom|events|phone|email/);
  assert.equal(requests.some(step => ['insert', 'update', 'delete', 'rpc'].includes(step[0])), false);
  assert.equal(route.POST, undefined);
});

test('a database failure returns an error instead of misleading placeholder fixtures', async () => {
  const { route, input } = apiFixture({ data: null, error: { message: 'internal database detail' } });
  const response = await route.GET();
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.fixtures, undefined);
  assert.doesNotMatch(body.error, /internal database detail/);
  assert.equal(input(), undefined);
});
