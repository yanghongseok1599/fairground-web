import assert from 'node:assert/strict';
import test from 'node:test';
import { moduleLoader, storeFixture } from './helpers/load-ts-module.mjs';

const tournament = { id: 'cup', created_at: '2026-10-03T00:00:00Z', groups: [{ teamIds: ['a1','a2','a3','a4'] }, { teamIds: ['b1','b2','b3','b4'] }] };
const game = (round, home, away) => ({ id: String(round), tournament_id: 'cup', round, home_team_id: home, home_team_name: home, away_team_id: away, away_team_name: away, home_score: 2, away_score: 1, status: 'finished', scheduled_at: '2026-10-03T01:00:00Z' });
const games = [game(13,'a3','b4'),game(14,'a4','b3'),game(15,'a1','b2'),game(16,'a2','b1'),game(17,'b4','b3'),game(18,'a3','a4'),game(19,'b2','b1'),game(20,'a1','a2')];
const flush = () => new Promise(resolve => setImmediate(resolve));

test('final card tier refresh batches tournament scores without event/photo queries', async () => {
  const f = storeFixture();
  const { fetchFinalCardTiers } = f.load('src/features/standings/final-card-tier-store.ts');
  f.responses.push({ data: [tournament, { ...tournament, id: 'earlier', created_at: '2026-09-01T00:00:00Z' }], error: null }, { data: games, error: null });
  const tiers = await fetchFinalCardTiers();
  assert.equal(tiers.a1, 'premium');
  assert.equal(tiers.a3, 'gold');
  assert.equal(tiers.b3, 'silver');
  assert.deepEqual(f.requests.map(row => row.table), ['tournaments', 'matches']);
  assert.deepEqual(f.requests[1].steps.find(([method]) => method === 'in'), ['in', 'tournament_id', ['cup', 'earlier']]);
  assert.ok(!f.requests[1].steps.find(([method]) => method === 'select')[1].includes('photo'));
  f.responses.push({ data: [tournament], error: null }, { data: null, error: { message: 'score request failed' } });
  await assert.rejects(fetchFinalCardTiers(), /score request failed/);
});

test('many cards share a realtime finalization read, retain confirmed tiers on error, and stop safely', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const listeners = [];
  let channelCount = 0, loadCount = 0, removed = 0;
  const channel = { on(_type, filter, listener) { listeners.push({ filter, listener }); return channel; }, subscribe() { return channel; } };
  const loadModule = moduleLoader({ '@/config/supabase': { isDemoMode: false, supabase: { channel: () => { channelCount++; return channel; }, removeChannel: async () => { removed++; } } } });
  const { createFinalCardTierStore } = loadModule('src/features/standings/final-card-tier-store.ts');
  const store = createFinalCardTierStore(async () => {
    loadCount++;
    if (loadCount === 1) return {};
    if (loadCount === 2) return { a1: 'premium', a2: 'gold' };
    throw new Error('temporarily offline');
  });
  const changesA = [], changesB = [];
  const stopA = store.subscribe(() => changesA.push(store.snapshot()));
  const stopB = store.subscribe(() => changesB.push(store.snapshot()));
  t.after(stopA); t.after(stopB);
  await flush();
  assert.equal(channelCount, 1);
  assert.equal(loadCount, 1);
  listeners[0].listener({ new: { status: 'live' } });
  t.mock.timers.tick(150); await flush();
  assert.equal(loadCount, 1);
  listeners[0].listener({ new: { status: 'finished' } });
  t.mock.timers.tick(150); await flush();
  assert.deepEqual(store.snapshot(), { a1: 'premium', a2: 'gold' });
  assert.equal(changesA.length, 1); assert.equal(changesB.length, 1);
  t.mock.timers.tick(5_000); await flush();
  assert.equal(loadCount, 3);
  assert.deepEqual(store.snapshot(), { a1: 'premium', a2: 'gold' });
  stopA(); assert.equal(removed, 0);
  stopB(); assert.equal(removed, 1);
  t.mock.timers.tick(5_000); await flush();
  assert.equal(loadCount, 3);
});
