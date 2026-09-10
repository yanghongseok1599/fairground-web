import assert from 'node:assert/strict';
import test from 'node:test';
import { moduleLoader, storeFixture, memoryStorage } from './helpers/load-ts-module.mjs';
const load = moduleLoader();
const { cardBadgePatch, filterEarnedBadgeIds } = load('src/lib/player-card/badge-edit.ts');
const { shouldShowPlayerPortraitShadow } = load('src/lib/player-card/upper-body-portrait.ts');
const { playerToInsert } = load('src/lib/mappers.ts');
const { readDraft, writeDraft } = load('src/lib/registration/draft-storage.ts');

test('existing drafts stay readable without new optional badge-edit metadata', () => {
  const storage = memoryStorage();
  const shape = { name: '', number: '', position: '', nationality: 'KOR', photoScale: 0.92, photoDraft: '', badges: [] };
  writeDraft(storage, 'card-edit:old', { ...shape, name: '작성한 이름', badges: ['first_goal'] });
  const old = readDraft(storage, 'card-edit:old', Date.now(), shape);
  assert.equal(old.name, '작성한 이름');
  assert.equal(old.badgesEdited === true, false);
  writeDraft(storage, 'card-edit:new', { ...shape, badgesEdited: true });
  assert.equal(readDraft(storage, 'card-edit:new', Date.now(), shape).badgesEdited, true);
});

test('unrelated edits omit badge fields for unknown, failed and successful lookups', () => {
  for (const earned of [null, new Set(), new Set(['first_goal'])]) {
    assert.deepEqual(cardBadgePatch(['first_goal'], earned, false), {});
  }
  assert.deepEqual(filterEarnedBadgeIds(['first_goal'], null), ['first_goal']);
});
test('intentional badge removal saves empty list; unverified badge changes fail closed', () => {
  assert.deepEqual(cardBadgePatch([], new Set(['first_goal']), true), { badges: [] });
  assert.deepEqual(cardBadgePatch(['first_goal', 'unearned'], new Set(['first_goal']), true), { badges: ['first_goal'] });
  assert.throws(() => cardBadgePatch(['first_goal'], null, true), /배지 다시 불러오기/);
});
test('badge read failure is rejected, not a successful empty list; retry returns earned rows', async () => {
  const f = storeFixture();
  f.responses.push({ data: null, error: { message: '503' } });
  await assert.rejects(f.data.getState().fetchMyBadges('player-1'), /배지를 불러오지/);
  f.responses.push({ data: [{ badge_id: 'first_goal', is_earned: true, progress: 1, earned_at: null }], error: null });
  assert.equal((await f.data.getState().fetchMyBadges('player-1'))[0].badgeId, 'first_goal');
});
test('zero-row, wrong-account and server errors do not modify the local player', async () => {
  for (const response of [{ data: null, error: null }, { data: { id: 'other' }, error: null }, { data: null, error: { message: 'permission denied' } }]) {
    const f = storeFixture(); f.responses.push(response);
    await assert.rejects(f.auth.getState().updatePlayer({ name: 'attempted' }));
    assert.equal(f.auth.getState().player.name, '원래 이름');
  }
});
test('profile save uses canonical server photo, badges and statistics', async () => {
  const f = storeFixture();
  const row = { ...playerToInsert(f.player), name: 'server', photo_url: 'server-photo', goals: 20, badges: ['first_goal'], created_at: new Date().toISOString() };
  f.responses.push({ data: { id: row.id }, error: null }, { data: row, error: null });
  await f.auth.getState().updatePlayer({ name: 'client', photoUrl: 'client-photo' });
  assert.equal(f.auth.getState().player.photoUrl, 'server-photo');
  assert.equal(f.auth.getState().player.stats.goals, 20);
  assert.deepEqual(f.auth.getState().player.badges, ['first_goal']);
  assert.ok(f.requests[0].steps.some(([method, selection]) => method === 'select' && selection === 'id'));
  assert.equal(f.requests[1].rpc, 'get_my_profile');
});
test('a late save cannot overwrite a switched account or claim success', async () => {
  const f = storeFixture(); let complete;
  f.responses.push(new Promise(resolve => { complete = resolve; }));
  f.responses.push({ data: { ...playerToInsert(f.player), created_at: new Date().toISOString() }, error: null });
  const save = f.auth.getState().updatePlayer({ name: 'old account edit' });
  await Promise.resolve();
  f.auth.setState({ user: { uid: 'other' }, player: { ...f.player, id: 'other', name: '다른 선수' } });
  complete({ data: { ...playerToInsert(f.player), created_at: new Date().toISOString() }, error: null });
  await assert.rejects(save, /계정이 변경/);
  assert.equal(f.auth.getState().player.name, '다른 선수');
});
test('failed or wrong-account canonical read never invents a saved local record', async () => {
  for (const response of [{ data: null, error: { message: 'network failed' } }, { data: null, error: null }, { data: { id: 'other', created_at: '2026-01-01' }, error: null }]) {
    const f = storeFixture();
    f.responses.push({ data: { id: 'player-1' }, error: null }, response);
    await assert.rejects(f.auth.getState().updatePlayer({ name: 'attempted' }), /저장.*확인/);
    assert.equal(f.auth.getState().player.name, '원래 이름');
    assert.equal(f.requests.filter(r => r.table === 'profiles').length, 1);
  }
});
test('new player insert verifies only id then loads the own-profile RPC', async () => {
  const f = storeFixture();
  f.auth.setState({ player: null });
  f.responses.push({ data: null, error: null }, { data: { id: 'player-1' }, error: null },
    { data: { ...playerToInsert(f.player), name: 'server new', created_at: '2026-01-01' }, error: null });
  await f.auth.getState().createPlayer({ name: 'client', number: 7, position: 'ALA' });
  assert.equal(f.auth.getState().player.name, 'server new');
  assert.deepEqual(f.requests[1].steps.find(([method]) => method === 'select'), ['select', 'id']);
  assert.equal(f.requests[2].rpc, 'get_my_profile');
});
test('female and public gender-omitted portraits never get shadows', () => {
  for (const gender of ['female', undefined, 'other', 'prefer_not_to_say']) assert.equal(shouldShowPlayerPortraitShadow(gender), false);
  assert.equal(shouldShowPlayerPortraitShadow('male'), true);
});
