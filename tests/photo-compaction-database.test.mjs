import assert from 'node:assert/strict';import test from 'node:test';import {randomUUID} from 'node:crypto';import pg from 'pg';
import {applyPhotoReplacements,photoReplacement} from '../scripts/photos/compact-photo-data.mjs';
const connectionString=process.env.FAIRGROUND_TEST_DB_URL;
if(!connectionString||!['127.0.0.1','localhost','[::1]'].includes(new URL(connectionString).hostname))throw Error('Use an isolated local database only');
const db=new pg.Client({connectionString});await db.connect();
try {
  const id=randomUUID(), noConsent=randomUUID();
  await db.query('begin');
  for(const uid of [id,noConsent]){
    await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)',[uid,uid+'@synthetic.invalid',JSON.stringify({portrait_consent:uid===id})]);
    await db.query("update profiles set name='합성 검수',photo_url=$2,profile_photo_url=nullif($2,''),profile_photo_locked=true where id=$1",[uid,uid===id?'data:image/png;base64,b3JpZ2luYWw=':'']);
  }
  const original=(await db.query('select * from profiles where id=$1',[id])).rows[0];
  const reduced={...original,photo_url:'data:image/webp;base64,Y29tcGFjdA==',profile_photo_url:'data:image/webp;base64,Y29tcGFjdA=='};
  const history=(await db.query('select * from registration_history order by id')).rows;
  await test('photo-only update preserves consent, lock, identity, statistics and audit history',async()=>{
    await db.query('savepoint photo_test');
    assert.equal(await applyPhotoReplacements(db,[photoReplacement(original,reduced)]),1);
    const actual=(await db.query('select * from profiles where id=$1',[id])).rows[0];
    assert.deepEqual(actual,reduced);
    assert.deepEqual((await db.query('select * from registration_history order by id')).rows,history);
    await db.query('rollback to photo_test');
    assert.deepEqual((await db.query('select * from profiles where id=$1',[id])).rows[0],original);
  });
  await test('a stale photo in a multi-row change requires rollback and never overwrites the new upload',async()=>{
    await db.query('savepoint stale_test');
    await db.query("update profiles set photo_url='newer-upload' where id=$1",[id]);
    await assert.rejects(applyPhotoReplacements(db,[photoReplacement(original,reduced)]),/roll back/);
    assert.equal((await db.query('select photo_url from profiles where id=$1',[id])).rows[0].photo_url,'newer-upload');
    await db.query('rollback to stale_test');
  });
  await test('missing consent cannot be manufactured by the compaction operation',async()=>{
    const before=(await db.query('select * from profiles where id=$1',[noConsent])).rows[0];
    await assert.rejects(applyPhotoReplacements(db,[photoReplacement(before,{...before,photo_url:reduced.photo_url})]),/roll back/);
    assert.deepEqual((await db.query('select * from profiles where id=$1',[noConsent])).rows[0],before);
  });
  await test('original photo bytes can be restored with the same compare-and-swap operation',async()=>{
    await applyPhotoReplacements(db,[photoReplacement(original,reduced)]);
    await applyPhotoReplacements(db,[photoReplacement(reduced,original)]);
    assert.deepEqual((await db.query('select * from profiles where id=$1',[id])).rows[0],original);
  });
  await db.query('rollback');
} finally {await db.query('rollback');await db.end();}
