import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { moduleLoader, storeFixture } from './helpers/load-ts-module.mjs';
import { verifiedDatabaseClient } from '../scripts/supabase/verified-db-client.mjs';

const load = moduleLoader();
const { internalReturnPath } = load('src/lib/internal-return-path.ts');
const { consentReturnTo } = load('src/features/portrait-consent/policy.ts');
const { csvCell } = load('src/lib/csv-cell.ts');
const { cueSheetToCsv } = load('src/lib/cue-sheet.ts');
const { skillChallengeRecordToCsv } = load('src/lib/skill-challenge.ts');

test('return paths reject parser tricks and preserve ordinary query/hash and defaults', () => {
  for (const raw of ['//bad.invalid', '/\\bad.invalid', '/\t/bad.invalid', '/\n/bad.invalid', 'https://bad.invalid', 'javascript:alert(1)', '/a/..//bad.invalid', '/%2e%2e//bad.invalid', '/\u007fbad']) {
    assert.equal(internalReturnPath(raw), '/my', raw);
    assert.equal(internalReturnPath(raw, '/onboarding'), '/onboarding', raw);
  }
  assert.equal(internalReturnPath(null, '/onboarding'), '/onboarding');
  assert.equal(internalReturnPath('/팀/../my?name=한글#card'), '/my?name=%ED%95%9C%EA%B8%80#card');
  assert.equal(internalReturnPath('/my/player-setup?event=ground-challenge'), '/my/player-setup?event=ground-challenge');
  assert.equal(consentReturnTo('/x/../my/portrait-consent'), '/my');
});

test('password, OAuth entry and callback all use the same return boundary', () => {
  for (const file of ['src/app/login/page.tsx', 'src/app/auth/callback/page.tsx', 'src/stores/authStore.ts']) {
    assert.match(fs.readFileSync(file, 'utf8'), /internalReturnPath\(/);
  }
});

test('actual Kakao and Google OAuth calls forward only canonical internal return paths', async () => {
  const previous = globalThis.window;
  globalThis.window = {location:{hostname:'localhost',origin:'http://localhost:3000'}};
  try {
    const f = storeFixture();
    const calls = [];
    f.supabase.auth.signInWithOAuth = async value => { calls.push(value); return {error:null}; };
    await f.auth.getState().loginWithKakao('/\\bad.invalid');
    await f.auth.getState().loginWithGoogle('/my/player-setup?event=ground-challenge');
    await f.auth.getState().loginWithKakao();
    assert.equal(new URL(calls[0].options.redirectTo).searchParams.get('returnTo'),'/onboarding');
    assert.equal(new URL(calls[1].options.redirectTo).searchParams.get('returnTo'),'/my/player-setup?event=ground-challenge');
    assert.equal(new URL(calls[2].options.redirectTo).searchParams.has('returnTo'),false);
    assert.deepEqual(calls.map(c => c.provider),['kakao','google','kakao']);
  } finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
});

test('spreadsheet cells neutralize formula/control prefixes and preserve CSV structure', () => {
  for (const value of ['=1+1', '+SUM(1)', '-1+2', '@SUM(1)', ' \t=1', '\r=1', '\n=1', '\ttext']) {
    const encoded = csvCell(value, true);
    assert.ok(encoded.startsWith('"\''), encoded);
  }
  assert.equal(csvCell('한국 팀'), '한국 팀');
  assert.equal(csvCell('a,"b"\r\nc'), '"a,""b""\r\nc"');
  assert.equal(csvCell(15), '15');
  const cue = cueSheetToCsv([{order:1,start:'10:00',end:'10:12',court:'A',groupName:'A',home:'=1+1',away:'한국 팀'}]);
  assert.match(cue, /,'=1\+1,한국 팀/);
  const skill = skillChallengeRecordToCsv([{id:'r',participantName:'=1+1',eventDate:'2026-10-01',totalScore:10,speedKmh:5,targetHit:false,targetRecorded:false,targetAttemptCount:0,airTouchScore:0,eventBadges:[],memo:'@SUM(1)',createdAt:0}]);
  assert.match(skill, /"'=1\+1"/);
  assert.match(skill, /"'@SUM\(1\)"/);
  assert.match(skill, /"10","5"/);
});

test('effective pg SSL requires verification even when connection string overrides it', () => {
  const base = 'postgresql://synthetic:unused@db.invalid/example';
  for (const query of ['', '?sslmode=verify-full', '?sslmode=require']) {
    const client = verifiedDatabaseClient(pg, {connectionString:base+query});
    assert.ok(client.ssl);
    assert.notEqual(client.ssl.rejectUnauthorized, false);
  }
  for (const query of ['?sslmode=disable', '?sslmode=no-verify', '?ssl=0']) {
    assert.throws(() => verifiedDatabaseClient(pg, {connectionString:base+query}), /검증된 TLS/);
  }
  // libpq verify-ca may trust a CA while deliberately omitting hostname verification.
  assert.throws(() => verifiedDatabaseClient(pg, {
    connectionString:base+'?sslmode=verify-ca&uselibpqcompat=true&sslrootcert='+encodeURIComponent(path.resolve('scripts/supabase/certificates/supabase-ca-2021.crt')),
  }), /검증된 TLS/);
  const hosted = verifiedDatabaseClient(pg, {connectionString:'postgresql://synthetic:unused@aws-0-ap-northeast-2.pooler.supabase.com/example?sslmode=verify-full'});
  assert.ok(hosted.ssl.ca.some(cert => cert.includes('BEGIN CERTIFICATE')));
  assert.equal(hosted.connection.ssl, hosted.ssl);
  assert.notEqual(hosted.ssl.rejectUnauthorized,false);
  assert.equal(hosted.ssl.checkServerIdentity,undefined);
  assert.equal(verifiedDatabaseClient(pg,{connectionString:base}).ssl.ca,undefined);
});
