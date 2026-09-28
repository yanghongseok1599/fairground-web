import assert from 'node:assert/strict';
import test from 'node:test';
import { moduleLoader, storeFixture } from './helpers/load-ts-module.mjs';

const { createMatchLiveRefresh } = moduleLoader()('src/lib/match-live-refresh.ts');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const flush = () => new Promise(resolve => setImmediate(resolve));

test('overlapping changes serialize requests and publish complete snapshots in order', async () => {
  const first = deferred(), second = deferred(), published = [];
  let calls = 0;
  const sync = createMatchLiveRefresh({ load: () => (++calls === 1 ? first.promise : second.promise), publish: v => published.push(v), onError: assert.fail });
  const running = sync.refresh(); await sync.refresh(); await sync.refresh();
  assert.equal(calls, 1); first.resolve('old'); await flush();
  assert.equal(calls, 2); assert.deepEqual(published, ['old']);
  second.resolve('latest'); await running; assert.deepEqual(published, ['old', 'latest']); sync.stop();
});

test('unmount discards pending results and prevents later refreshes', async () => {
  const pending = deferred(), published = []; let calls = 0;
  const sync = createMatchLiveRefresh({ load: () => { calls++; return pending.promise; }, publish: v => published.push(v), onError: assert.fail });
  const running = sync.refresh(); sync.stop(); pending.resolve('late'); await running; await sync.refresh();
  assert.deepEqual(published, []); assert.equal(calls, 1);
});

test('failed event reads retain displayed records; reconnect reloads all missed events', async t => {
  const f = storeFixture(), callbacks = []; let connected;
  const channel = { on(_event, _filter, callback) { callbacks.push(callback); return channel; }, subscribe(callback) { connected = callback; return channel; } };
  f.supabase.channel = () => channel; f.supabase.removeChannel = async () => {};
  const match = { id: 'match-1', status: 'live', home_score: 1, away_score: 0 };
  const event = { id: 'event-1', type: 'goal', player_id: 'player-1', created_at: new Date().toISOString() };
  f.responses.push({ data: [match], error: null }, { data: [event], error: null });
  const stop = f.data.getState().subscribeLiveMatches(); t.after(stop); await flush();
  assert.equal(f.data.getState().liveMatches[0].events.length, 1);
  f.responses.push({ data: [match], error: null }, { data: null, error: { message: 'synthetic disconnected read' } });
  callbacks[1](); await flush();
  assert.equal(f.data.getState().liveMatches[0].events.length, 1);
  f.responses.push({ data: [{ ...match, home_score: 2 }], error: null }, { data: [event, { ...event, id: 'event-2' }], error: null });
  connected('SUBSCRIBED'); await flush();
  assert.equal(f.data.getState().liveMatches[0].events.length, 2);
  assert.equal(f.data.getState().liveMatches[0].homeScore, 2);
});

test('a failed final-match event read is not returned as a successful empty history', async () => {
  const f = storeFixture();
  f.responses.push({ data: { id: 'match-1', status: 'finished' }, error: null }, { data: null, error: { message: 'synthetic read failure' } });
  assert.equal(await f.data.getState().fetchMatch('tournament-1', 'match-1'), null);
});
