import assert from 'node:assert/strict';
import test from 'node:test';
import { moduleLoader } from './helpers/load-ts-module.mjs';
const { reconcileJerseys, createJerseyRefresh } = moduleLoader()('src/features/match-recording/jersey-sync.ts');
const player = (id, number, numberLabel = null) => ({ id, teamId: 'home', name: id, number, numberLabel, stats: { goals: 3 } });
const fixture = () => ({ key: 'actor:match', actorId: 'actor', matchId: 'match', players: [player('changed', 10), player('unchanged', 2, '2')],
  base: { id: 'match', homeTeamId: 'home', awayTeamId: 'away', status: 'live', homeScore: 1, awayScore: 0, events: [], elapsedSeconds: 120, currentHalf: 1, isRunning: true },
  lineups: [{ playerId: 'changed', jerseyNumber: 10 }], pending: [{ id: 'goal', kind: 'event', payload: { type: 'goal', playerId: 'changed', teamId: 'home' }, at: 100 }], journal: [], revision: 4, savedAt: 200, error: 'retained', blocked: true });
const latest = [player('changed', 1, '1')];
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

test('number correction preserves every recording field, player identity, stats and other jerseys', () => {
  const room = fixture(), before = structuredClone(room), result = reconcileJerseys(room, latest);
  assert.equal(result.players[0].number, 1); assert.equal(result.players[0].numberLabel, '1');
  assert.equal(result.players[0].stats, room.players[0].stats); assert.equal(result.players[1], room.players[1]);
  for (const key of Object.keys(room).filter(key => key !== 'players')) assert.equal(result[key], room[key]);
  assert.deepEqual(room, before);
  assert.equal(reconcileJerseys(result, latest), result);
});

test('partial response, other teams and new members cannot remove or move the cached match roster', () => {
  const room = fixture();
  assert.equal(reconcileJerseys(room, []), room);
  assert.equal(reconcileJerseys(room, [{ ...latest[0], teamId: 'another-team' }, player('new', 7)]), room);
  const result = reconcileJerseys(room, [player('changed', 0, '00')]);
  assert.equal(result.players[0].numberLabel, '00'); assert.equal(result.players.length, 2);
});

test('in-flight response merges into the latest durable queue rather than replacing newly entered goals', async () => {
  const request = deferred(); let room = fixture(), published;
  const refresh = createJerseyRefresh({ active: () => true, current: () => room, read: () => request.promise,
    update: async (_key, change) => { room = change(room); return room; }, publish: value => { published = value; } });
  const pending = refresh();
  const extra = { id: 'new-goal', kind: 'event', payload: { type: 'goal', playerId: 'changed', teamId: 'home' }, at: 300 };
  room = { ...room, pending: [...room.pending, extra], journal: [extra], revision: 5 };
  const savedPending = room.pending, savedJournal = room.journal;
  request.resolve(latest); await pending;
  assert.equal(room.players[0].number, 1); assert.equal(room.pending, savedPending); assert.equal(room.journal, savedJournal); assert.equal(published, room);
});

test('offline failures preserve labels and throttle retries without writing', async () => {
  let now = 0, reads = 0, writes = 0; const room = fixture();
  const refresh = createJerseyRefresh({ active: () => true, current: () => room, now: () => now,
    read: async () => { reads++; throw Error('offline'); }, update: async () => { writes++; return room; }, publish: () => assert.fail('must not publish') });
  await refresh(); await refresh(); assert.equal(reads, 1); assert.equal(writes, 0);
  now = 15_000; await refresh(); assert.equal(reads, 2); assert.equal(room.players[0].number, 10);
});

test('concurrent refreshes share one read and a late response cannot write after room release', async () => {
  const request = deferred(); let active = true, reads = 0;
  const refresh = createJerseyRefresh({ active: () => active, current: () => fixture(),
    read: () => { reads++; return request.promise; }, update: () => assert.fail('must not write'), publish: () => assert.fail('must not publish') });
  const pending = refresh(); await refresh(); assert.equal(reads, 1);
  active = false; request.resolve(latest); await pending;
});

test('ownership is checked again inside a delayed storage transaction', async () => {
  let active = true, changes = 0; const room = fixture();
  const refresh = createJerseyRefresh({ active: () => active, current: () => room, read: async () => latest,
    update: async (_key, change) => { active = false; assert.throws(() => change(room), { name: 'AbortError' }); changes++; return room; },
    publish: () => assert.fail('must not publish') });
  await refresh(); assert.equal(changes, 1); assert.equal(room.players[0].number, 10);
});

test('jersey query reads only public labels for both teams, without photos', async () => {
  const calls = []; const response = { data: [{ id: 'p', team_id: 'home', number: 0, number_label: '00' }], error: null };
  const chain = { then: resolve => Promise.resolve(response).then(resolve) };
  for (const method of ['select', 'in', 'retry']) chain[method] = (...args) => { calls.push([method, ...args]); return chain; };
  const { readRecordingJerseys } = moduleLoader({ '@/config/supabase': { supabase: { from: table => { calls.push(['from', table]); return chain; } } } })('src/features/match-recording/jersey-api.ts');
  assert.deepEqual(await readRecordingJerseys(['home', 'away']), [{ id: 'p', teamId: 'home', number: 0, numberLabel: '00' }]);
  assert.deepEqual(calls, [['from', 'public_match_player_profiles'], ['select', 'id, team_id, number, number_label'], ['in', 'team_id', ['home', 'away']], ['retry', false]]);
  response.error = { message: 'timeout' }; await assert.rejects(readRecordingJerseys(['home', 'away']));
});

test('the actual adapter and match hook display the updated jersey without reloading or enqueueing records', async () => {
  const room = fixture();
  const { createRecordingAdapter } = moduleLoader({
    '@/stores/dataStore': { useDataStore: { getState: () => ({}) } }, '@/stores/authStore': { useAuthStore: { getState: () => ({ user: { uid: 'actor' } }) } },
    './device': { recordingDeviceId: () => 'device' }, './storage': { updateRoom: () => assert.fail('must not enqueue') },
  })('src/features/match-recording/adapter.ts');
  const adapter = createRecordingAdapter(room);
  const { useMatchControl } = moduleLoader({
    react: { useState: initial => [initial, () => {}], useEffect: () => {}, useRef: current => ({ current }), useCallback: callback => callback },
    '@/features/match-control/store-context': { useMatchControlStore: () => adapter.store.getState() },
  })('src/hooks/useMatchControl.ts');
  assert.equal(useMatchControl({ tournamentId: 't', matchId: 'match' }).homePlayers[0].number, 10);
  adapter.publish(reconcileJerseys(room, latest));
  assert.equal(useMatchControl({ tournamentId: 't', matchId: 'match' }).homePlayers[0].number, 1);
  assert.equal((await adapter.store.getState().fetchTeamPlayers('home'))[0].numberLabel, '1');
  assert.equal(room.pending.length, 1);
});
