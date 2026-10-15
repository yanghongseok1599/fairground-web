import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { moduleLoader } from './helpers/load-ts-module.mjs';

// adding-korean-site-essentials 키트 적용분: 법적 문서·사업자 정보·동의 기록·만 14세.
const load = moduleLoader();
const { SEEDED_LEGAL_DOCUMENTS, EMAIL_SIGNUP_CONSENTS, ACCOUNT_COMPLETION_CONSENTS } = load('src/content/signup-consents.ts');
const { PRIVACY_DOCUMENT } = load('src/content/legal/privacy.ts');
const { TERMS_DOCUMENT } = load('src/content/legal/terms.ts');
const { REFUND_DOCUMENT } = load('src/content/legal/refund.ts');
const { isDraft } = load('src/lib/legal-document.ts');
const { BUSINESS, MISSING_BUSINESS_FIELDS, BUSINESS_INFO_READY } = load('src/lib/business-info.ts');
const { consentPayload, missingRequiredConsent, REQUIRED_CONSENT_KINDS } = load('src/lib/record-consents.ts');
const { isAtLeastAge } = load('src/lib/age.ts');

// 문서 시드는 여러 마이그레이션에 나뉜다 (개정판은 새 마이그레이션이 넣는다).
const migration = readdirSync('supabase/migrations').filter((f) => f >= '20261015010000').sort()
  .map((f) => readFileSync(`supabase/migrations/${f}`, 'utf8')).join('\n');

const hashOf = (doc) => createHash('sha256').update(JSON.stringify({ kind: doc.kind, version: doc.version, sections: doc.sections })).digest('hex');

test('every consented document is seeded byte-for-byte; edited text without a version bump fails here', () => {
  const rows = [...migration.matchAll(/\('(\w+)', '([^']+)', '([0-9a-f]{64})', '((?:[^']|'')*)'::jsonb\)/g)];
  for (const doc of SEEDED_LEGAL_DOCUMENTS) {
    const row = rows.find((r) => r[1] === doc.kind && r[2] === doc.version);
    assert.ok(row, `legal_documents seed missing for ${doc.kind} ${doc.version} — add a migration (scripts/legal/print-legal-documents-sql.mjs)`);
    assert.equal(row[3], hashOf(doc), `${doc.kind} ${doc.version}: text changed without a version bump`);
    assert.equal(hashOf(JSON.parse(row[4].replaceAll("''", "'"))), row[3], 'seeded body must match its hash');
  }
  for (const list of [EMAIL_SIGNUP_CONSENTS, ACCOUNT_COMPLETION_CONSENTS]) {
    for (const entry of list) assert.ok(SEEDED_LEGAL_DOCUMENTS.includes(entry.document), `${entry.item.key} document is not seeded`);
  }
});

test('required consents match the database definition and optional items stay optional', () => {
  assert.match(migration, /in \('age14','terms','privacy'\)/);
  assert.deepEqual([...REQUIRED_CONSENT_KINDS].sort(), ['age14', 'privacy', 'terms']);
  for (const list of [EMAIL_SIGNUP_CONSENTS, ACCOUNT_COMPLETION_CONSENTS]) {
    assert.deepEqual(list.filter((e) => e.item.required).map((e) => e.document.kind).sort(), ['age14', 'privacy', 'terms']);
    assert.equal(list.some((e) => e.document.kind === 'marketing'), false, 'no marketing feature, no marketing consent');
    assert.match(missingRequiredConsent(list, { portrait: true }) ?? '', /\[필수\]/);
    assert.equal(missingRequiredConsent(list, { age14: true, terms: true, privacy: true }), null);
  }
  assert.deepEqual(consentPayload(EMAIL_SIGNUP_CONSENTS, { age14: true, terms: true, privacy: true }).map((i) => [i.kind, i.granted]),
    [['age14', true], ['terms', true], ['privacy', true], ['portrait', false]]);
});

test('business info is never invented: only the verified contact email is filled, so pages stay drafts', () => {
  assert.equal(BUSINESS.email.value, 'info@fairground-kor.com');
  assert.deepEqual(MISSING_BUSINESS_FIELDS.map((f) => f.key).sort(),
    ['address', 'businessNumber', 'companyName', 'hostingProvider', 'mailOrderNumber', 'phone', 'privacyOfficer', 'representative']);
  assert.equal(BUSINESS_INFO_READY, false);
  for (const doc of [PRIVACY_DOCUMENT, TERMS_DOCUMENT, REFUND_DOCUMENT]) {
    assert.equal(doc.effectiveAt, null, `${doc.kind}: 시행일 is the operator's decision`);
    assert.equal(isDraft(doc), true);
  }
});

test('legal pages only describe features that exist', () => {
  const text = JSON.stringify([TERMS_DOCUMENT, REFUND_DOCUMENT]);
  assert.doesNotMatch(text, /마이페이지에서 직접 탈퇴|마이페이지에서 바로 신청/);
  assert.match(JSON.stringify(REFUND_DOCUMENT), /주최 측 사정으로 취소·연기되는 경우: 전액 환불/);
  assert.match(JSON.stringify(PRIVACY_DOCUMENT), /Telegram/);
  assert.match(JSON.stringify(PRIVACY_DOCUMENT), /Google Drive/);
  // 팀·대회 삭제 후에도 남는 참가비 납부 기록 (20261015030000)
  assert.match(JSON.stringify(PRIVACY_DOCUMENT), /참가비 납부 기록.*별도 보관함.*납부일부터 5년.*전자상거래법 시행령 제6조/);
});

test('under-14 signups are refused', () => {
  const now = new Date('2026-10-15T03:00:00Z');
  assert.equal(isAtLeastAge('2012-10-15', 14, now), true);
  assert.equal(isAtLeastAge('2012-10-16', 14, now), false);
  assert.equal(isAtLeastAge('2000-02-30', 14, now), null);
  assert.equal(isAtLeastAge('', 14, now), null);
});
