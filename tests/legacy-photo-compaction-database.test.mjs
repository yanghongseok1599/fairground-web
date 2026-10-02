import assert from 'node:assert/strict';import test from 'node:test';import {randomUUID} from 'node:crypto';import pg from 'pg';
import {compactLegacyPhoto,compactionScope} from '../scripts/photos/compact-photo-data.mjs';
const connectionString=process.env.FAIRGROUND_TEST_DB_URL;
if(!connectionString||!['127.0.0.1','localhost','[::1]'].includes(new URL(connectionString).hostname))throw Error('Use an isolated local database only');
const db=new pg.Client({connectionString});await db.connect();
const id=randomUUID(),originalPhoto='data:image/png;base64,'+'eA=='.repeat(100),compressed='data:image/webp;base64,eA==';
try{await db.query('begin');await db.query('insert into auth.users(id,email) values($1,$2)',[id,id+'@synthetic.invalid']);
// Reproduce legacy data in this isolated database only; production never disables a trigger.
await db.query('alter table profiles disable trigger aa_enforce_personal_portrait_consent');
await db.query('update profiles set photo_url=$2,profile_photo_url=$2,profile_photo_locked=true where id=$1',[id,originalPhoto]);
await db.query('alter table profiles enable trigger aa_enforce_personal_portrait_consent');
const before=(await db.query('select * from profiles where id=$1',[id])).rows[0],after={...before,photo_url:compressed,profile_photo_url:compressed};assert.equal(before.portrait_consent_at,null);
const attempt=async fn=>{await db.query('savepoint attempt');try{await fn();}finally{await db.query('rollback to attempt');}};
await test('owner-scoped byte reduction preserves absent consent and every non-photo value',()=>attempt(async()=>{
await compactLegacyPhoto(db,before,after);assert.deepEqual((await db.query('select * from profiles where id=$1',[id])).rows[0],after);
assert.equal((await db.query("select current_setting('app.inline_photo_compaction',true) scope")).rows[0].scope,'');
}));
await test('even a database owner cannot bypass consent without the exact scope',()=>attempt(async()=>{
await assert.rejects(db.query('update profiles set photo_url=$2 where id=$1',[id,compressed]),/동의/);
}));
await test('scope does not authorize any accompanying name or card setting edit',()=>attempt(async()=>{
await db.query("select set_config('app.inline_photo_compaction',$1,true)",[compactionScope(before,after)]);
await assert.rejects(db.query("update profiles set photo_url=$2,profile_photo_url=$2,name='새 이름' where id=$1",[id,compressed]),/동의/);
}));
for(const role of ['authenticated','service_role'])await test(role+' cannot use the maintenance scope to bypass consent',()=>attempt(async()=>{
await db.query("select set_config('request.jwt.claim.sub',$1,true)",[id]);await db.query("select set_config('app.inline_photo_compaction',$1,true)",[compactionScope(before,after)]);
await db.query('set session authorization '+role);
try{await assert.rejects(db.query('update public.profiles set photo_url=$2,profile_photo_url=$2 where id=$1',[id,compressed]),/동의|permission denied/);}finally{await db.query('rollback to attempt');await db.query('reset session authorization');}
}));
for(const [name,photo]of [['larger image','data:image/webp;base64,'+'eA=='.repeat(1000)],['external replacement','https://example.invalid/new.webp']])await test(name+' is rejected even with a matching owner scope',()=>attempt(async()=>{
await assert.rejects(compactLegacyPhoto(db,before,{...after,photo_url:photo}),/동의/);
}));
await test('rollback restores the exact original legacy photo bytes and absent consent',async()=>{
assert.deepEqual((await db.query('select * from profiles where id=$1',[id])).rows[0],before);
});
await db.query('rollback');
}finally{await db.query('rollback');await db.end();}
