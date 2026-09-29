import assert from 'node:assert/strict';
import test from 'node:test';
import { moduleLoader, storeFixture } from './helpers/load-ts-module.mjs';

const load = moduleLoader();
const { parseJerseyNumber: parse, jerseyNumberText: text, hasJerseyNumber: has,
  jerseyNumberOrder: order, lineupJerseyNumberText: lineup } = load('src/lib/jersey-number.ts');
const mapper = load('src/lib/mappers.ts');
const { hasCompletedPlayerCardSetup } = load('src/lib/player-onboarding.ts');
const examples = ['0', '00', '000', '01', '02', '007', '1', '9', '10', '99', '100', '999'];

test('every 1–3 digit spelling survives serialization, including leading zeros', () => {
  for (let width = 1; width <= 3; width++) {
    for (let number = 0; number < 10 ** width; number++) {
      const input = String(number).padStart(width, '0');
      const value = JSON.parse(JSON.stringify(parse(input)));
      assert.equal(text(value), input); assert.ok(has(value));
    }
  }
  assert.notDeepEqual(parse('1'), parse('01'));
  assert.notDeepEqual(parse('7'), parse('007'));
});

test('blank, four digits, signs, decimals and non-ASCII digits are rejected', () => {
  for (const value of ['', '0000', '1000', '-1', '+1', '1.5', '1e1', ' 0', '0 ', '1\n', '가', '０']) {
    assert.equal(parse(value), null, JSON.stringify(value));
  }
  for (const value of [{ number: 0 }, { number: null }, { number: NaN }, { number: 1000 }, { number: 0, numberLabel: '0000' }]) {
    assert.equal(has(value), false);
  }
  assert.equal(text({ number: 7, numberLabel: '008' }), '7', 'A stale label must not change the registered number');
});

test('zero sorts before positives; legacy unset zero remains last', () => {
  assert.equal(order(parse('000')), 0); assert.equal(order(parse('01')), 1);
  assert.ok(order({ number: 0 }) > order(parse('999')));
});

test('lineup snapshots preserve all typed digits without depending on profiles', () => {
  for (const input of examples) {
    const parsed = parse(input);
    assert.equal(lineup({ jerseyNumber: parsed.number, jerseyNumberLabel: parsed.numberLabel }), input);
  }
  assert.equal(lineup({ jerseyNumber: 0 }), '0'); assert.equal(lineup({}), '—');
});

test('profile insert, patch and read retain labels; changing numeric-only values clears stale labels', () => {
  for (const input of examples) {
    const row = mapper.playerPatchToRow(parse(input));
    const player = mapper.rowToPublicPlayer({ ...row, id: 'synthetic', created_at: new Date().toISOString() });
    assert.equal(text(player), input);
    const inserted = mapper.playerToInsert({ ...player, stats: {}, penaltyStatus: {} });
    assert.equal(inserted.number_label, input);
  }
  assert.deepEqual(mapper.playerPatchToRow({ number: 8, numberLabel: '00' }), { number: 8, number_label: null });
  assert.deepEqual(mapper.playerPatchToRow({ number: 8 }), { number: 8, number_label: null });
  assert.deepEqual(mapper.playerPatchToRow({ name: '선수' }), { name: '선수' });
});

test('all valid numbers finish onboarding; legacy unset zero does not', () => {
  const base = { name: '합성 선수', position: 'ALA', portraitConsentAt: 1000 };
  assert.equal(hasCompletedPlayerCardSetup({ ...base, number: 0 }), false);
  for (const input of examples) assert.equal(hasCompletedPlayerCardSetup({ ...base, ...parse(input) }), true);
});

test('actual registration and card-edit stores send and reload 01, 02 and three digits', async () => {
  for (const label of ['0', '00', '000', '01', '02', '007', '100', '999']) {
    const f = storeFixture();
    const row = { id: 'player-1', name: '합성 선수', number: Number(label), number_label: label,
      position: 'ALA', portrait_consent_at: '2026-09-29T00:00:00Z', created_at: '2026-01-01' };
    f.responses.push({ data: { ...row, number: 9, number_label: null }, error: null },
      { data: { id: 'player-1' }, error: null }, { data: row, error: null });
    await f.auth.getState().createPlayer({ name: '합성 선수', position: 'ALA', ...parse(label), portraitConsentAt: 1000 });
    assert.equal(text(f.auth.getState().player), label);
    const write = f.requests.flatMap(r => r.steps).find(([method]) => method === 'update')[1];
    assert.equal(write.number, Number(label)); assert.equal(write.number_label, label);
    const next = label === '007' ? '7' : '007';
    f.responses.push({ data: { id: 'player-1' }, error: null },
      { data: { ...row, number: Number(next), number_label: next }, error: null });
    await f.auth.getState().updatePlayer(parse(next));
    assert.equal(text(f.auth.getState().player), next);
  }
});
