import { assertLocalDatabaseUrl } from '../scripts/testing/local-database-url.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { compactLegacyPhoto, compactionScope } from '../scripts/photos/compact-photo-data.mjs';

// Current restored development contract: promotional consent is optional for
// service photos. Compaction still must preserve absent consent and stale writes.
const connectionString = process.env.FAIRGROUND_TEST_DB_URL;
assertLocalDatabaseUrl(connectionString);
const db = new pg.Client({ connectionString });
await db.connect();
const id = randomUUID(), other = randomUUID();
const originalPhoto = 'data:image/png;base64,' + 'eA=='.repeat(100);
const compressed = 'data:image/webp;base64,eA==';
try {
  await db.query('begin');
  for (const uid of [id, other]) await db.query('insert into auth.users(id,email) values($1,$2)', [uid, uid + '@synthetic.invalid']);
  await db.query('update profiles set photo_url=$2,profile_photo_url=$2,profile_photo_locked=true where id=$1', [id, originalPhoto]);
  const before = (await db.query('select * from profiles where id=$1', [id])).rows[0];
  const after = { ...before, photo_url: compressed, profile_photo_url: compressed };
  assert.equal(before.portrait_consent_at, null);
  const attempt = async fn => {
    await db.query('savepoint attempt');
    try { await fn(); } finally { await db.query('rollback to attempt'); await db.query('reset session authorization'); }
  };
  const asMember = async uid => {
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [uid]);
    await db.query('set session authorization authenticated');
  };
  await test('owner compaction preserves absent consent and every non-photo value', () => attempt(async () => {
    await compactLegacyPhoto(db, before, after);
    assert.deepEqual((await db.query('select * from profiles where id=$1', [id])).rows[0], after);
    assert.equal((await db.query("select current_setting('app.inline_photo_compaction',true) scope")).rows[0].scope, '');
    assert.equal((await db.query('select count(*)::int n from consent_records where user_id=$1', [id])).rows[0].n, 0);
  }));
  await test('a member can edit their service photo without manufacturing promotional consent', () => attempt(async () => {
    await asMember(id);
    assert.equal((await db.query('update profiles set photo_url=$2 where id=$1 returning id', [id, compressed])).rowCount, 1);
    const profile = (await db.query('select * from get_my_profile()')).rows[0];
    assert.equal(profile.photo_url, compressed);
    assert.equal(profile.portrait_consent_at, null);
  }));
  await test('stale original bytes cannot overwrite a newer upload', () => attempt(async () => {
    await db.query("update profiles set photo_url='newer-upload' where id=$1", [id]);
    await assert.rejects(compactLegacyPhoto(db, before, after), /Legacy photo changed/);
    assert.equal((await db.query('select photo_url from profiles where id=$1', [id])).rows[0].photo_url, 'newer-upload');
  }));
  await test('a maintenance scope does not let a member change another member photo', () => attempt(async () => {
    await db.query("select set_config('app.inline_photo_compaction',$1,true)", [compactionScope(before, after)]);
    await asMember(other);
    assert.equal((await db.query('update profiles set photo_url=$2 where id=$1 returning id', [id, compressed])).rowCount, 0);
  }));
  await test('private consent stays unreadable even when a member supplies a maintenance scope', () => attempt(async () => {
    await db.query("select set_config('app.inline_photo_compaction',$1,true)", [compactionScope(before, after)]);
    await asMember(id);
    await assert.rejects(db.query('select portrait_consent_at from profiles where id=$1', [id]), error => error.code === '42501');
  }));
  for (const [name, photo] of [['larger image', 'data:image/webp;base64,' + 'eA=='.repeat(1000)], ['external replacement', 'https://example.invalid/new.webp']]) {
    await test(name + ' remains a service photo edit and creates no promotional consent', () => attempt(async () => {
      await asMember(id);
      await db.query('update profiles set photo_url=$2 where id=$1', [id, photo]);
      const profile = (await db.query('select * from get_my_profile()')).rows[0];
      assert.equal(profile.photo_url, photo);
      assert.equal(profile.portrait_consent_at, null);
    }));
  }
  await test('rollback restores exact original photo bytes, consent and all other fields', async () => {
    assert.deepEqual((await db.query('select * from profiles where id=$1', [id])).rows[0], before);
  });
} finally { await db.query('rollback'); await db.end(); }
