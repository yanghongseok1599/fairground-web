import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { moduleLoader } from './helpers/load-ts-module.mjs';

const load = moduleLoader();
const { EMAIL_SIGNUP_CONSENTS, ACCOUNT_COMPLETION_CONSENTS } = load('src/content/signup-consents.ts');
const { consentPayload, recordMyConsents } = load('src/lib/record-consents.ts');
const sql = (file) => readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8');

// Preview 복구에서 적용하는 정확한 의존 집합. 참가비 보관 마이그레이션 전체를 포함하면
// RPC만 존재하고 현재 화면의 문서 버전은 없는 결함을 이 테스트가 놓치게 된다.
const base = sql('20261015010000_consent_records.sql') + '\n'
  + sql('20261015020000_portrait_consent_optional.sql');
const privacy = sql('20261015040000_consent_privacy_document.sql');
const original = sql('20261015030000_entry_fee_payment_retention.sql');
const rows = (source) => [...source.matchAll(/\('(\w+)', '([^']+)', '([0-9a-f]{64})', '((?:[^']|'')*)'::jsonb\)/g)]
  .map(([literal, kind, version, hash, body]) => ({ literal, kind, version, hash, body: JSON.parse(body.replaceAll("''", "'")) }));
const hashOf = ({ kind, version, sections }) => createHash('sha256')
  .update(JSON.stringify({ kind, version, sections })).digest('hex');

test('focused privacy seed preserves the original document byte-for-byte', () => {
  const seeded = rows(privacy);
  assert.equal(seeded.length, 1, 'this repair must introduce only one document');
  assert.equal(seeded[0].kind, 'privacy');
  assert.equal(seeded[0].version, '2026-10-15.2');
  assert.equal(seeded[0].literal, rows(original).find((row) => row.kind === 'privacy')?.literal);
  assert.equal(seeded[0].hash, hashOf(seeded[0].body));
});

test('the two RPC migrations alone lack the privacy version sent by current signup', () => {
  const requested = consentPayload(EMAIL_SIGNUP_CONSENTS, { age14: true, terms: true, privacy: true });
  const initial = rows(base);
  const missing = requested.filter((item) => !initial.some((row) => row.kind === item.kind && row.version === item.version));
  assert.deepEqual(missing.map(({ kind, version }) => ({ kind, version })), [
    { kind: 'privacy', version: '2026-10-15.2' },
  ]);
});

for (const [name, entries] of [['email signup', EMAIL_SIGNUP_CONSENTS], ['account completion', ACCOUNT_COMPLETION_CONSENTS]]) {
  test(`${name}: the focused repair covers every submitted version and exact displayed document`, () => {
    const available = rows(base + '\n' + privacy);
    const payload = consentPayload(entries, { age14: true, terms: true, privacy: true });
    for (const item of payload) {
      const stored = available.find((row) => row.kind === item.kind && row.version === item.version);
      const shown = entries.find((entry) => entry.document.kind === item.kind)?.document;
      assert.ok(stored, `unseeded consent: ${item.kind} ${item.version}`);
      assert.equal(stored.hash, hashOf(shown));
      assert.deepEqual(stored.body, shown, `displayed and stored ${item.kind} documents differ`);
    }
    assert.deepEqual(payload.filter((item) => item.granted).map((item) => item.kind).sort(), ['age14', 'privacy', 'terms']);
    assert.equal(payload.find((item) => item.kind === 'portrait')?.granted, false);
  });
}

test('account completion sends the current privacy version through the repaired RPC without suppressing DB errors', async () => {
  const payload = consentPayload(ACCOUNT_COMPLETION_CONSENTS, { age14: true, terms: true, privacy: true });
  const calls = [];
  await recordMyConsents({ rpc: async (name, args) => {
    calls.push({ name, args });
    return { data: payload.length, error: null };
  } }, 'oauth_complete', payload);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'record_my_consents');
  assert.equal(calls[0].args.p_source, 'oauth_complete');
  assert.deepEqual(calls[0].args.p_items, payload);
  assert.equal(calls[0].args.p_items.find((item) => item.kind === 'privacy').version, '2026-10-15.2');
  await assert.rejects(recordMyConsents({ rpc: async () => ({ data: null, error: { message: 'unknown_consent_document' } }) },
    'oauth_complete', payload), /동의 내용을 저장하지 못했습니다/);
});
