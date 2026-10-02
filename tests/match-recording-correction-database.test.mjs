import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

// Committed synthetic fixtures exercise the production RPC under actual API
// roles. This suite must never run on a hosted or production database.
const url = process.env.FAIRGROUND_TEST_DB_URL;
if (!url || !['localhost', '127.0.0.1'].includes(new URL(url).hostname)) {
  throw new Error('An isolated local database is required');
}
const clients = [];
async function connect(actor) {
  const client = new pg.Client({ connectionString: url, ssl: false, statement_timeout: 15000 });
  await client.connect();
  clients.push(client);
  if (actor) {
    await client.query('set session authorization authenticated');
    await client.query("select set_config('request.jwt.claim.sub', $1, false)", [actor]);
    assert.equal((await client.query('select current_user')).rows[0].current_user, 'authenticated');
  }
  return client;
}
const db = await connect();
const refereeId = randomUUID();
const adminId = randomUUID();
const label = `합성 기록 정정 ${randomUUID().slice(0, 8)}`;

async function fixture() {
  const result = { match: randomUUID(), home: randomUUID(), away: randomUUID(), players: [randomUUID(), randomUUID()] };
  await db.query('begin');
  try {
    await db.query("select set_config('app.in_end_match', '1', true)");
    for (const team of [result.home, result.away]) {
      await db.query('insert into teams(id, name, is_approved, season_stats) values ($1, $2, true, $3)', [team, `${label} ${team}`, {}]);
    }
    for (const player of result.players) {
      await db.query('insert into auth.users(id, email, raw_user_meta_data) values ($1, $2, $3)', [
        player, `${player}@synthetic.invalid`, { name: label, portrait_consent: true },
      ]);
      await db.query(`update profiles set team_id=$1, is_approved=true, games=0, goals=0,
        assists=0, mom=0, card_rating=70, season_yellow_cards=0, ban_matches_remaining=0,
        is_banned=false where id=$2`, [result.home, player]);
    }
    await db.query(`insert into matches(id, home_team_id, away_team_id, home_team_name, away_team_name, status)
      values ($1, $2, $3, '합성 홈', '합성 원정', 'scheduled')`, [result.match, result.home, result.away]);
    await db.query('commit');
  } catch (error) {
    await db.query('rollback');
    throw error;
  }
  return result;
}
const rpc = async (client, fixture, kind, payload = {}, operationId = randomUUID()) => (
  await client.query('select public.apply_match_recording_operation($1, $2, $3, $4) result', [operationId, fixture.match, kind, payload])
).rows[0].result;
const event = (fixture, type, playerIndex = 0) => ({
  type, playerId: fixture.players[playerIndex], playerName: label, teamId: fixture.home, minute: 1, half: 1,
});
const read = async (client, fixture) => (
  await client.query('select public.get_match_recording_snapshot($1) result', [fixture.match])
).rows[0].result;
const playerStats = async fixture => (await db.query(`select id, games, goals, assists, mom,
  season_yellow_cards, ban_matches_remaining, is_banned from profiles where id=any($1::uuid[]) order by id`, [fixture.players])).rows;
const valid = (snapshot, type) => snapshot.events.filter(item => item.type === type && !item.is_cancelled);

try {
  await db.query('begin');
  await db.query("select set_config('app.in_end_match', '1', true)");
  for (const [id, role] of [[refereeId, 'referee'], [adminId, 'admin']]) {
    await db.query('insert into auth.users(id, email, raw_user_meta_data) values ($1, $2, $3)', [
      id, `${id}@synthetic.invalid`, { name: `${label} ${role}`, portrait_consent: true },
    ]);
    await db.query('update profiles set role=$1, is_approved=true where id=$2', [role, id]);
  }
  await db.query('commit');
  const referee = await connect(refereeId);
  const refereeRetry = await connect(refereeId);
  const admin = await connect(adminId);
  let finishedGoalMatch;

  await test('goal and assist corrections survive duplicate cancellation and original-event replay before finalization', async () => {
    const f = await fixture();
    finishedGoalMatch = f;
    await rpc(referee, f, 'start');
    const mistakenGoal = randomUUID();
    const mistakenAssist = randomUUID();
    const goalPayload = event(f, 'goal');
    const assistPayload = event(f, 'assist', 1);
    await rpc(referee, f, 'event', goalPayload, mistakenGoal);
    await rpc(referee, f, 'event', assistPayload, mistakenAssist);
    await rpc(referee, f, 'event', goalPayload);
    await rpc(referee, f, 'event', assistPayload);
    const cancelGoal = randomUUID();
    const cancelPayload = { eventOperationId: mistakenGoal };
    await Promise.all([
      rpc(referee, f, 'cancel', cancelPayload, cancelGoal),
      rpc(refereeRetry, f, 'cancel', cancelPayload, cancelGoal),
    ]);
    let snapshot = await read(referee, f);
    assert.equal(snapshot.match.home_score, 1);
    assert.equal(valid(snapshot, 'goal').length, 1);
    assert.equal(valid(snapshot, 'assist').length, 2, 'goal correction must not guess which independent assist to cancel');
    const assistId = snapshot.events.find(item => snapshot.eventOperations[item.id] === mistakenAssist).id;
    const cancelAssist = randomUUID();
    await rpc(admin, f, 'cancel', { eventId: assistId }, cancelAssist);
    await rpc(admin, f, 'cancel', { eventId: assistId }, cancelAssist);
    await rpc(admin, f, 'cancel', { eventId: assistId });
    // A late retry of the original command acknowledges its existing receipt;
    // it cannot recreate a goal/assist that another recorder corrected.
    await rpc(refereeRetry, f, 'event', goalPayload, mistakenGoal);
    snapshot = await rpc(refereeRetry, f, 'event', assistPayload, mistakenAssist);
    assert.equal(snapshot.match.home_score, 1);
    assert.equal(valid(snapshot, 'goal').length, 1);
    assert.equal(valid(snapshot, 'assist').length, 1);
    assert.equal(snapshot.events.length, 4, 'retries must not append replacement events');
    for (const id of [cancelGoal, cancelAssist]) {
      assert.equal((await db.query('select count(*)::integer n from match_recording_receipts where operation_id=$1', [id])).rows[0].n, 1);
    }
    await rpc(referee, f, 'mom', { playerId: f.players[0] });
    await rpc(referee, f, 'end');
    const stats = await playerStats(f);
    assert.equal(stats.find(item => item.id === f.players[0]).goals, 1);
    assert.equal(stats.find(item => item.id === f.players[1]).assists, 1);
    assert.equal((await read(admin, f)).match.home_score, 1);
  });

  await test('cancelling a second yellow reverses only its automatic red and retains an unrelated direct red', async () => {
    const f = await fixture();
    await rpc(referee, f, 'start');
    await rpc(referee, f, 'event', event(f, 'yellow_card'));
    const secondYellow = randomUUID();
    const secondYellowPayload = event(f, 'yellow_card');
    let snapshot = await rpc(referee, f, 'event', secondYellowPayload, secondYellow);
    const sourceYellow = snapshot.events.find(item => snapshot.eventOperations[item.id] === secondYellow);
    const automaticRed = valid(snapshot, 'red_card').find(item => item.player_id === f.players[0]);
    assert.equal(automaticRed.source_yellow_event_id, sourceYellow.id);

    snapshot = await rpc(referee, f, 'event', event(f, 'red_card', 1));
    const directRed = valid(snapshot, 'red_card').find(item => item.player_id === f.players[1]);
    assert.equal(directRed.source_yellow_event_id, null);
    await rpc(referee, f, 'event', event(f, 'yellow_card', 1));
    const otherYellow = randomUUID();
    snapshot = await rpc(referee, f, 'event', event(f, 'yellow_card', 1), otherYellow);
    const otherYellowId = snapshot.events.find(item => snapshot.eventOperations[item.id] === otherYellow).id;
    const cancel = randomUUID();
    await rpc(admin, f, 'cancel', { eventId: sourceYellow.id }, cancel);
    await rpc(admin, f, 'cancel', { eventId: sourceYellow.id }, cancel);
    await rpc(admin, f, 'cancel', { eventId: otherYellowId });
    snapshot = await rpc(refereeRetry, f, 'event', secondYellowPayload, secondYellow);
    assert.equal(snapshot.events.find(item => item.id === automaticRed.id).is_cancelled, true);
    assert.equal(snapshot.events.find(item => item.id === directRed.id).is_cancelled, false);
    assert.equal(valid(snapshot, 'red_card').length, 1);
    assert.equal(valid(snapshot, 'yellow_card').filter(item => item.player_id === f.players[0]).length, 1);
    assert.equal(valid(snapshot, 'yellow_card').filter(item => item.player_id === f.players[1]).length, 1);
    await rpc(referee, f, 'end');
    const stats = await playerStats(f);
    const corrected = stats.find(item => item.id === f.players[0]);
    const direct = stats.find(item => item.id === f.players[1]);
    assert.equal(corrected.season_yellow_cards, 1);
    assert.equal(corrected.ban_matches_remaining, 0);
    assert.equal(corrected.is_banned, false);
    assert.ok(direct.ban_matches_remaining > 0, 'direct red must still produce its actual suspension');
  });

  await test('a new correction after finalization is rejected without changing statistics or writing a receipt', async () => {
    const f = finishedGoalMatch;
    assert.ok(f);
    const before = await read(referee, f);
    const stats = await playerStats(f);
    const operation = randomUUID();
    const target = valid(before, 'goal')[0];
    await assert.rejects(rpc(admin, f, 'cancel', { eventId: target.id }, operation), /already closed/);
    const after = await read(referee, f);
    assert.deepEqual(after.match, before.match);
    assert.deepEqual(after.events, before.events);
    assert.deepEqual(await playerStats(f), stats);
    assert.equal((await db.query('select count(*)::integer n from match_recording_receipts where operation_id=$1', [operation])).rows[0].n, 0);
  });
} finally {
  await Promise.allSettled(clients.map(client => client.end()));
}
