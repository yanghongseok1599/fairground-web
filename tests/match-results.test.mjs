import assert from 'node:assert/strict';
import test from 'node:test';
import { moduleLoader, storeFixture } from './helpers/load-ts-module.mjs';

const { mergePlayerResult, resultStandings, tournamentResultStandings, leaderboardResultPlayer } = moduleLoader()('src/features/match-results/model.ts');
const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const result = { id: 'player-1', card_type: 'gold', card_rating: 90, goals: 20, assists: 8, games: 23, mom: 4, badges: ['earned', 'first_goal'], is_banned: false, ban_matches_remaining: 0, season_yellow_cards: 1, attendance_streak: 2, attendance_streak_best: 3 };

test('completed results update cards while preserving identity, private fields, consent and photos', () => {
  const { player } = storeFixture();
  const updated = mergePlayerResult(player, result);
  assert.deepEqual(updated.stats, { goals: 20, assists: 8, games: 23, mom: 4 });
  assert.equal(updated.cardRating, 90);
  assert.equal(updated.photoUrl, player.photoUrl);
  assert.equal(updated.phone, player.phone);
  assert.equal(updated.portraitConsentAt, player.portraitConsentAt);
  assert.equal(updated.role, player.role);
  assert.equal(mergePlayerResult(updated, result), updated, 'unchanged polls do not regenerate cards');
  assert.equal(mergePlayerResult(player, { ...result, id: 'other-user' }), player);
});

test('cached public cards fetch current earned stats without fetching photo blobs again', async () => {
  const f = storeFixture();
  f.data.setState({ players: { [f.player.id]: f.player } });
  f.responses.push({ data: result, error: null });
  const fresh = await f.data.getState().fetchPlayer(f.player.id);
  assert.equal(fresh.stats.goals, 20);
  assert.equal(fresh.photoUrl, 'photo');
  assert.equal(f.requests[0].table, 'public_player_profiles');
  const columns = f.requests[0].steps.find(([method]) => method === 'select')[1];
  assert.ok(!columns.includes('photo'));
  assert.ok(!columns.includes('*'));
  f.responses.push({ data: null, error: { message: 'temporarily offline' } });
  assert.equal(await f.data.getState().fetchPlayer(f.player.id), fresh);
});

test('league ranks use committed team aggregates and tournament ranks exclude live matches', () => {
  const teams = [
    { id: 'a', name: 'A', season_stats: { rank: 2, points: 3, goalsFor: 2, goalDifference: 1 } },
    { id: 'b', name: 'B', season_stats: { rank: 1, points: 6, goalsFor: 5, goalDifference: 4 } },
  ];
  const ranks = resultStandings(teams, [{ teamId: 'b', teamLogo: 'existing-large-logo' }]);
  assert.deepEqual(ranks.map(row => [row.teamId, row.rank, row.points]), [['b', 1, 6], ['a', 2, 3]]);
  assert.equal(ranks[0].teamLogo, 'existing-large-logo');
  const match = { homeTeamId: 'a', awayTeamId: 'b', homeTeamName: 'A', awayTeamName: 'B', homeScore: 2, awayScore: 1 };
  assert.deepEqual(tournamentResultStandings([{ ...match, status: 'live' }]), []);
  const finished = tournamentResultStandings([{ ...match, status: 'finished' }, { ...match, status: 'live', homeScore: 7 }]);
  assert.equal(finished[0].points, 3);
  assert.equal(finished[0].goalsFor, 2);
  assert.equal(finished[0].gamesPlayed, 1);
});

test('league ties keep the server rank instead of applying browser locale order', () => {
  const teams = [
    { id: 'a', name: 'A', season_stats: { rank: 2, points: 3, goalsFor: 2, goalDifference: 1 } },
    { id: 'b', name: 'B', season_stats: { rank: 1, points: 3, goalsFor: 2, goalDifference: 1 } },
  ];
  assert.deepEqual(resultStandings(teams, []).map(row => [row.teamId, row.rank]), [['b', 1], ['a', 2]]);
});

test('leaderboard refresh includes new top-ranked players and retains already loaded photos', async () => {
  const f = storeFixture();
  const originalFrom = f.supabase.from;
  f.supabase.from = table => { const query = originalFrom(table); query.gt = () => query; return query; };
  const entrant = { ...result, id: 'new-entrant', name: '새 순위 선수', number: 9, number_label: '09', position: 'ALA', team_id: 'team-1', nationality: 'KOR', card_skin: 'standard', is_approved: true, role: 'player', created_at: new Date().toISOString() };
  f.responses.push({ data: [entrant, { ...entrant, ...result }], error: null });
  const { fetchLeaderboardResults } = f.load('src/features/match-results/api.ts');
  const rows = await fetchLeaderboardResults('goals');
  const ranked = rows.map(row => leaderboardResultPlayer(row, row.id === f.player.id ? f.player : undefined));
  assert.deepEqual(ranked.map(player => player.id), ['new-entrant', 'player-1']);
  assert.equal(ranked[0].name, '새 순위 선수');
  assert.equal(ranked[0].stats.goals, 20);
  assert.equal(ranked[1].photoUrl, f.player.photoUrl);
  assert.ok(!f.requests[0].steps.find(([method]) => method === 'select')[1].includes('photo'));
  assert.deepEqual(f.requests[0].steps.find(([method]) => method === 'order'), ['order', 'goals', { ascending: false }]);
});

test('match history failure rejects the entire refresh rather than erasing displayed events', async () => {
  const f = storeFixture();
  const { fetchResultMatches } = f.load('src/features/match-results/api.ts');
  f.responses.push({ data: [{ id: 'm1', status: 'finished' }], error: null }, { data: null, error: { message: 'event read failed' } });
  await assert.rejects(fetchResultMatches({ matchId: 'm1' }), /event read failed/);
  assert.equal(f.requests.length, 2);
  assert.deepEqual(f.requests[1].steps.find(([method]) => method === 'in'), ['in', 'match_id', ['m1']]);
});

function subscriberFixture() {
  const listeners = [], removed = [];
  let connected;
  const channel = {
    on(_type, filter, listener) { listeners.push({ filter, listener }); return channel; },
    subscribe(callback) { connected = callback; return channel; },
  };
  const supabase = { channel: () => channel, removeChannel: async value => { removed.push(value); } };
  const load = moduleLoader({ '@/config/supabase': { supabase, isDemoMode: false } });
  return { subscribe: load('src/features/match-results/subscribe.ts').subscribeMatchResults, listeners, reconnect: () => connected('SUBSCRIBED'), removed };
}

test('finalized-result subscription ignores running-clock updates and repairs missed finalization on reconnect', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const f = subscriberFixture(), published = [];
  let count = 0;
  const stop = f.subscribe({ key: 'card-test', load: async () => ++count, publish: value => published.push(value), onError: assert.fail });
  t.after(stop);
  await flush();
  f.listeners[0].listener({ new: { status: 'live' } });
  t.mock.timers.tick(150); await flush();
  assert.equal(count, 1);
  f.listeners[0].listener({ new: { status: 'finished' } });
  f.listeners[0].listener({ new: { status: 'finished' } });
  t.mock.timers.tick(150); await flush();
  assert.equal(count, 2);
  f.reconnect(); await flush();
  assert.equal(count, 3);
  t.mock.timers.tick(5_000); await flush();
  assert.equal(count, 4, 'poll detects a missed final event');
  assert.deepEqual(published, [1, 2, 3, 4]);
  assert.equal(f.listeners.some(item => item.filter.table === 'profiles'), false);
});

test('bursts serialize reads, retain the last good result on failure, and discard late responses after navigation', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const f = subscriberFixture(), published = [], errors = [], pending = deferred();
  let calls = 0;
  const stop = f.subscribe({ key: 'match-test', matchId: 'm1', finalOnly: false,
    load: async () => { calls++; if (calls === 1) return 'saved'; if (calls === 2) throw new Error('offline'); return pending.promise; },
    publish: value => published.push(value), onError: error => errors.push(error.message) });
  t.after(stop);
  await flush();
  f.reconnect(); await flush();
  assert.deepEqual(published, ['saved']);
  assert.deepEqual(errors, ['offline']);
  f.reconnect(); f.reconnect(); f.reconnect(); await flush();
  assert.equal(calls, 3);
  assert.ok(f.listeners.some(item => item.filter.table === 'match_events'));
  stop(); pending.resolve('late'); await flush();
  assert.deepEqual(published, ['saved']);
  assert.equal(calls, 3);
});

test('tournament ties prefer fewer valid fouls after points, goal difference and goals scored', () => {
  const event = (id, teamId, type = 'foul', isCancelled = false) => ({ id, teamId, type, isCancelled });
  const match = { homeTeamId: 'a', awayTeamId: 'b', homeTeamName: 'A', awayTeamName: 'B', homeScore: 1, awayScore: 1, status: 'finished', events: [event('1', 'a'), event('2', 'a'), event('3', 'b'), event('4', 'b', 'foul', true), event('5', 'b', 'yellow_card'), event('6', 'other')] };
  const rows = tournamentResultStandings([match, { ...match, status: 'live' }, { ...match, status: 'cancelled' }]);
  assert.deepEqual(rows.map(row => [row.teamId, row.fouls, row.rank]), [['b', 1, 1], ['a', 2, 2]]);
  assert.equal(rows[0].gamesPlayed, 1);
  const winner = tournamentResultStandings([{ ...match, homeScore: 2 }]);
  assert.equal(winner[0].teamId, 'a', 'points take priority over foul count');
  assert.deepEqual(tournamentResultStandings([{ ...match, events: [] }]).map(row => row.fouls), [0, 0]);
});
