import assert from 'node:assert/strict';
import test from 'node:test';
import { storeFixture } from './helpers/load-ts-module.mjs';

test('recording roster excludes both inline photos and preserves jersey labels and eligibility', async () => {
  const f = storeFixture();
  f.responses.push({ data: [{ id: 'p', name: '선수', number: 1, number_label: '01', team_id: 't',
    is_approved: true, is_banned: true, ban_matches_remaining: 2 }], error: null });
  const [player] = await f.data.getState().fetchTeamPlayers('t', { forRecording: true });
  const steps = f.requests[0].steps;
  assert.equal(f.requests[0].table, 'public_player_profiles');
  assert.doesNotMatch(steps.find(s => s[0] === 'select')[1], /photo|\*/);
  assert.deepEqual(steps.find(s => s[0] === 'eq'), ['eq', 'team_id', 't']);
  assert.deepEqual(steps.find(s => s[0] === 'retry'), ['retry', false]);
  assert.equal(player.numberLabel, '01');
  assert.equal(player.penaltyStatus.isBanned, true);
  assert.equal(player.photoUrl, '');
});

test('recording query failure propagates instead of presenting an empty eligible roster', async () => {
  const f = storeFixture();
  f.responses.push({ data: null, error: { message: 'network timeout' } });
  await assert.rejects(f.data.getState().fetchTeamPlayers('t', { forRecording: true }), /network timeout/);
});
