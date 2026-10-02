import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

// Run only against a disposable, restored schema. Fixtures intentionally commit
// so separate authenticated connections exercise real row/advisory locks.
const url = process.env.FAIRGROUND_TEST_DB_URL;
if (!url || !['localhost', '127.0.0.1'].includes(new URL(url).hostname)) {
  throw new Error('An isolated local database is required');
}

const clients = [];
async function connect(actor) {
  const client = new pg.Client({
    connectionString: url,
    ssl: false,
    statement_timeout: 15000,
    application_name: 'fairground-matchday-regression',
  });
  await client.connect();
  clients.push(client);
  if (actor) {
    await client.query('set session authorization authenticated');
    await client.query("select set_config('request.jwt.claim.sub', $1, false)", [actor]);
    const role = (await client.query('select session_user, current_user')).rows[0];
    assert.deepEqual(role, { session_user: 'authenticated', current_user: 'authenticated' });
  }
  return client;
}

const db = await connect();
const ids = {
  referee: randomUUID(),
  admin: randomUUID(),
  unapproved: randomUUID(),
};
const runName = `합성 경기일 ${randomUUID().slice(0, 8)}`;
let fixtureNumber = 0;

async function fixture({ lineups = false, noConsent = false } = {}) {
  const match = randomUUID();
  const home = randomUUID();
  const away = randomUUID();
  const players = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  const number = ++fixtureNumber;
  await db.query('begin');
  try {
    await db.query("select set_config('app.in_end_match', '1', true)");
    for (const [index, team] of [home, away].entries()) {
      await db.query('insert into teams(id, name, is_approved, season_stats) values ($1, $2, true, $3)', [
        team, `${runName} ${number}-${index}`, {},
      ]);
    }
    for (const [index, player] of players.entries()) {
      await db.query('insert into auth.users(id, email, raw_user_meta_data) values ($1, $2, $3)', [
        player, `${player}@synthetic.invalid`,
        { name: `${runName} 선수 ${index}`, portrait_consent: !(noConsent && index === 0) },
      ]);
      await db.query(`update profiles set team_id = $1, is_approved = true,
        games = 0, goals = 0, assists = 0, mom = 0, card_rating = 70,
        season_yellow_cards = 0, ban_matches_remaining = 0, is_banned = false
        where id = $2`, [index < 3 ? home : away, player]);
    }
    await db.query(`insert into matches(id, home_team_id, away_team_id,
      home_team_name, away_team_name, status)
      values ($1, $2, $3, '합성 홈', '합성 원정', 'scheduled')`, [match, home, away]);
    if (lineups) {
      for (const [index, player] of players.entries()) {
        await db.query('insert into match_lineups(match_id, player_id, team_id, is_starter) values ($1, $2, $3, true)', [
          match, player, index < 3 ? home : away,
        ]);
      }
    }
    await db.query('commit');
  } catch (error) {
    await db.query('rollback');
    throw error;
  }
  return { match, home, away, players };
}

async function rpc(client, match, kind, payload = {}, id = randomUUID()) {
  return (await client.query('select public.apply_match_recording_operation($1, $2, $3, $4) result', [
    id, match, kind, payload,
  ])).rows[0].result;
}

async function snapshot(client, match) {
  return (await client.query('select public.get_match_recording_snapshot($1) result', [match])).rows[0].result;
}

function clock(version, device, elapsed, half = 1) {
  return {
    _clockVersion: version,
    _deviceId: device,
    ...(elapsed === undefined ? {} : { _elapsedSeconds: elapsed, _half: half }),
  };
}

function event(f, playerIndex, type = 'goal') {
  return {
    type, playerId: f.players[playerIndex], playerName: `${runName} 선수 ${playerIndex}`,
    teamId: playerIndex < 3 ? f.home : f.away, minute: 2, half: 1,
  };
}

async function playerStats(player) {
  return (await db.query(`select games, goals, assists, mom, card_rating,
    season_yellow_cards, portrait_consent_at from profiles where id = $1`, [player])).rows[0];
}

async function teamStats(team) {
  return (await db.query('select season_stats::jsonb stats from teams where id = $1', [team])).rows[0].stats;
}

async function captureStats(teams, players) {
  const captured = { teams: [], players: [] };
  for (const team of teams) captured.teams.push(await teamStats(team));
  for (const player of players) captured.players.push(await playerStats(player));
  return captured;
}

function assertResult(stats, expected) {
  for (const [key, value] of Object.entries(expected)) assert.equal(stats[key], value, key);
}

async function assertRanks() {
  // Check the actual stored ranks against the documented standings order,
  // including teams that were present in the restored schema before this test.
  // Older suites give several teams identical names and results. Their order
  // inside that complete tie is unspecified; require its contiguous rank range
  // and uniqueness instead of inventing a final SQL tie-breaker.
  const mismatches = (await db.query(`with scores as (
    select id, name, (season_stats::jsonb->>'rank')::integer actual,
      coalesce((season_stats::jsonb->>'points')::integer, 0) points,
      coalesce((season_stats::jsonb->>'goalDifference')::integer, 0) difference,
      coalesce((season_stats::jsonb->>'goalsFor')::integer, 0) goals
    from teams where is_approved = true
  ), ranked as (
    select *, rank() over (order by points desc, difference desc, goals desc, name asc) first_rank,
      count(*) over (partition by points, difference, goals, name) tied,
      count(*) over (partition by actual) using_rank
    from scores
  ) select id, actual, first_rank, tied, using_rank from ranked
    where actual is null or actual < first_rank or actual >= first_rank + tied or using_rank <> 1`)).rows;
  assert.deepEqual(mismatches, []);
}

try {
  await db.query('begin');
  await db.query("select set_config('app.in_end_match', '1', true)");
  for (const [name, id] of Object.entries(ids)) {
    await db.query('insert into auth.users(id, email, raw_user_meta_data) values ($1, $2, $3)', [
      id, `${id}@synthetic.invalid`, { name: `${runName} ${name}`, portrait_consent: true },
    ]);
    await db.query('update profiles set role = $1, is_approved = $2 where id = $3', [
      name === 'admin' ? 'admin' : 'referee', name !== 'unapproved', id,
    ]);
  }
  await db.query('commit');
  const referee = await connect(ids.referee);
  const admin = await connect(ids.admin);
  const unapproved = await connect(ids.unapproved);

  await test('approved referee starts and a non-owner admin preserves the observed clock on pause and end', async () => {
    const f = await fixture();
    await rpc(referee, f.match, 'start', clock(0, 'referee-device'));
    await rpc(referee, f.match, 'timer', { ...clock(1, 'referee-device'), seconds: 43, half: 1 });

    const paused = await rpc(admin, f.match, 'pause', clock(1, 'admin-device', 47));
    assert.equal(paused.match.elapsed_seconds, 47);
    assert.equal(paused.match.is_running, false);
    assert.equal(paused.clock.version, 2);
    assert.equal(paused.clock.ownerId, ids.admin);
    const late = await rpc(referee, f.match, 'timer', { ...clock(1, 'referee-device'), seconds: 100, half: 1 });
    assert.equal(late.match.elapsed_seconds, 47);

    await rpc(referee, f.match, 'resume', clock(2, 'referee-device'));
    await rpc(referee, f.match, 'timer', { ...clock(3, 'referee-device'), seconds: 365, half: 2 });
    const endId = randomUUID();
    const endPayload = clock(3, 'admin-device', 369, 2);
    const ended = await rpc(admin, f.match, 'end', endPayload, endId);
    assert.equal(ended.match.status, 'finished');
    assert.equal(ended.match.elapsed_seconds, 369);
    assert.equal(ended.match.current_half, 2);
    assert.equal(ended.match.stats_applied, true);
    const retry = await rpc(admin, f.match, 'end', endPayload, endId);
    assert.equal(retry.match.elapsed_seconds, 369);
    const afterOldTimer = await rpc(referee, f.match, 'timer', { ...clock(3, 'referee-device'), seconds: 600, half: 2 });
    assert.equal(afterOldTimer.match.elapsed_seconds, 369);
    assert.equal(afterOldTimer.match.is_running, false);
    const receipts = (await db.query('select outcome from match_recording_receipts where operation_id = $1', [endId])).rows;
    assert.deepEqual(receipts, [{ outcome: 'applied' }]);
  });

  await test('stale pause/resume are acknowledged with durable superseded outcomes and do not block the next goal', async () => {
    const f = await fixture();
    await rpc(referee, f.match, 'start', clock(0, 'referee-device'));
    await rpc(admin, f.match, 'pause', clock(1, 'admin-device', 20));
    await rpc(admin, f.match, 'resume', clock(2, 'admin-device'));
    const staleIds = [randomUUID(), randomUUID()];
    for (const [index, kind] of ['pause', 'resume'].entries()) {
      const payload = clock(index + 1, 'referee-device', 80 + index);
      const first = await rpc(referee, f.match, kind, payload, staleIds[index]);
      const retry = await rpc(referee, f.match, kind, payload, staleIds[index]);
      for (const result of [first, retry]) {
        assert.ok(result.appliedOperationIds.includes(staleIds[index]));
        assert.ok(result.supersededOperationIds.includes(staleIds[index]));
        assert.equal(result.clock.version, 3);
        assert.equal(result.clock.ownerId, ids.admin);
        assert.equal(result.match.is_running, true);
        assert.equal(result.match.elapsed_seconds, 20);
      }
    }
    const next = await rpc(referee, f.match, 'event', event(f, 0));
    assert.equal(next.match.home_score, 1);
    assert.equal(next.events.filter(e => e.type === 'goal' && !e.is_cancelled).length, 1);
    assert.deepEqual(new Set(next.supersededOperationIds), new Set(staleIds));
    assert.deepEqual((await snapshot(admin, f.match)).supersededOperationIds, []);
    const outcomes = (await db.query('select outcome from match_recording_receipts where operation_id = any($1::uuid[])', [staleIds])).rows;
    assert.deepEqual(outcomes.map(row => row.outcome), ['superseded', 'superseded']);

    const staleEnd = randomUUID();
    await assert.rejects(rpc(referee, f.match, 'end', clock(1, 'referee-device', 99), staleEnd), error => error.code === '22023');
    const stillLive = await snapshot(admin, f.match);
    assert.equal(stillLive.match.status, 'live');
    assert.equal(stillLive.match.elapsed_seconds, 20);
    assert.ok(!stillLive.appliedOperationIds.includes(staleEnd));
    assert.equal((await db.query('select count(*)::integer n from match_recording_receipts where operation_id = $1', [staleEnd])).rows[0].n, 0);
  });

  await test('an unapproved referee cannot read or mutate the recording room', async () => {
    const f = await fixture();
    await assert.rejects(snapshot(unapproved, f.match), error => error.code === '42501');
    await assert.rejects(rpc(unapproved, f.match, 'start', clock(0, 'unapproved-device')), error => error.code === '42501');
    assert.equal((await snapshot(referee, f.match)).match.status, 'scheduled');
    const regularPlayer = await connect(f.players[0]);
    await assert.rejects(snapshot(regularPlayer, f.match), error => error.code === '42501');
    await assert.rejects(rpc(regularPlayer, f.match, 'start'), error => error.code === '42501');
  });

  await test('parallel finalization commits player cards, win/draw/loss, ranks and consent-independent stats exactly once', async () => {
    const win = await fixture({ lineups: true, noConsent: true });
    const draw = await fixture({ lineups: true });
    await rpc(referee, win.match, 'start', clock(0, 'referee-device'));
    await rpc(admin, draw.match, 'start', clock(0, 'admin-device'));
    for (const playerIndex of [0, 0, 3]) await rpc(referee, win.match, 'event', event(win, playerIndex));
    await rpc(referee, win.match, 'event', event(win, 1, 'assist'));
    await rpc(referee, win.match, 'mom', { playerId: win.players[1] });
    const cancelledGoal = randomUUID();
    await rpc(referee, win.match, 'event', event(win, 0), cancelledGoal);
    await rpc(referee, win.match, 'cancel', { eventOperationId: cancelledGoal });
    for (const playerIndex of [0, 3]) await rpc(admin, draw.match, 'event', event(draw, playerIndex));
    await rpc(admin, draw.match, 'mom', { playerId: draw.players[3] });
    for (const player of [...win.players, ...draw.players]) {
      const before = await playerStats(player);
      assert.equal(before.games, 0);
      assert.equal(before.goals, 0);
      assert.equal(before.assists, 0);
      assert.equal(before.mom, 0);
      assert.equal(before.card_rating, 70);
    }
    assert.equal((await playerStats(win.players[0])).portrait_consent_at, null);

    // Widen the original deadlock window: each transaction holds its own team
    // row before the global rank refresh reaches the other transaction's team.
    // This trigger is local test instrumentation, restricted to these fixtures.
    const hookName = `test_matchday_delay_${randomUUID().replaceAll('-', '')}`;
    const teamIds = [win.home, win.away, draw.home, draw.away].map(id => `'${id}'::uuid`).join(',');
    await db.query(`create function public.${hookName}() returns trigger language plpgsql as $$
      begin
        if new.id = any(array[${teamIds}]) and
          coalesce((new.season_stats::jsonb->>'gamesPlayed')::integer, 0) >
          coalesce((old.season_stats::jsonb->>'gamesPlayed')::integer, 0) then
          perform pg_sleep(0.15);
        end if;
        return new;
      end
    $$`);
    await db.query(`create trigger ${hookName} before update on public.teams
      for each row execute function public.${hookName}()`);
    const drawEnd = randomUUID();
    try {
      await Promise.all([
        referee.query('select public.end_match($1)', [win.match]),
        rpc(admin, draw.match, 'end', clock(1, 'admin-device', 720, 2), drawEnd),
      ]);
    } finally {
      await db.query(`drop trigger ${hookName} on public.teams`);
      await db.query(`drop function public.${hookName}()`);
    }

    for (const f of [win, draw]) {
      const result = await snapshot(referee, f.match);
      assert.equal(result.match.status, 'finished');
      assert.equal(result.match.stats_applied, true);
      assert.equal(result.match.is_running, false);
    }
    const winner = await playerStats(win.players[0]);
    assertResult(winner, { games: 1, goals: 2, assists: 0, mom: 0, card_rating: 72 });
    assert.equal(winner.portrait_consent_at, null);
    assertResult(await playerStats(win.players[1]), { games: 1, goals: 0, assists: 1, mom: 1, card_rating: 74 });
    assertResult(await playerStats(win.players[2]), { games: 1, goals: 0, assists: 0, mom: 0, card_rating: 70 });
    assertResult(await playerStats(win.players[3]), { games: 1, goals: 1, assists: 0, mom: 0, card_rating: 71 });
    assertResult(await playerStats(draw.players[3]), { games: 1, goals: 1, assists: 0, mom: 1, card_rating: 74 });
    assertResult(await teamStats(win.home), { points: 3, wins: 1, draws: 0, losses: 0, goalsFor: 2, goalsAgainst: 1, goalDifference: 1, gamesPlayed: 1 });
    assertResult(await teamStats(win.away), { points: 0, wins: 0, draws: 0, losses: 1, goalsFor: 1, goalsAgainst: 2, goalDifference: -1, gamesPlayed: 1 });
    for (const team of [draw.home, draw.away]) {
      assertResult(await teamStats(team), { points: 1, wins: 0, draws: 1, losses: 0, goalsFor: 1, goalsAgainst: 1, goalDifference: 0, gamesPlayed: 1 });
    }
    await assertRanks();

    const teams = [win.home, win.away, draw.home, draw.away];
    const players = [...win.players, ...draw.players];
    const beforeRetry = await captureStats(teams, players);
    const otherAdmin = await connect(ids.admin);
    const otherReferee = await connect(ids.referee);
    await Promise.all([
      referee.query('select public.end_match($1)', [win.match]),
      rpc(admin, win.match, 'end', clock(0, 'admin-device', 10)),
      rpc(otherAdmin, draw.match, 'end', clock(1, 'admin-device', 720, 2), drawEnd),
      rpc(otherReferee, draw.match, 'end', clock(0, 'referee-device', 10)),
    ]);
    assert.deepEqual(await captureStats(teams, players), beforeRetry);
  });

  await test('event-only matches finalize goals, assists and MOM without requiring a coach lineup', async () => {
    const f = await fixture({ noConsent: true });
    await rpc(referee, f.match, 'start', clock(0, 'referee-device'));
    await rpc(referee, f.match, 'event', event(f, 0));
    await rpc(referee, f.match, 'event', event(f, 1, 'assist'));
    await rpc(referee, f.match, 'mom', { playerId: f.players[2] });
    await rpc(admin, f.match, 'end', clock(1, 'admin-device', 720, 2));
    assertResult(await playerStats(f.players[0]), { games: 1, goals: 1, assists: 0, mom: 0, card_rating: 71, portrait_consent_at: null });
    assertResult(await playerStats(f.players[1]), { games: 1, goals: 0, assists: 1, mom: 0, card_rating: 71 });
    assertResult(await playerStats(f.players[2]), { games: 1, goals: 0, assists: 0, mom: 1, card_rating: 73 });
  });
} finally {
  await Promise.allSettled(clients.map(client => client.end()));
}
