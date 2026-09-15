import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

// Restore the schema and apply the migration as postgres before running.
// Use a disposable local database: tests create synthetic member/team rows.
const connectionString = process.env.FAIRGROUND_TEST_DB_URL;
const localHosts = ['127.0.0.1', 'localhost', '[::1]'];
if (!connectionString || !localHosts.includes(new URL(connectionString).hostname)) {
  throw new Error('Only a restored LOCAL production schema is allowed.');
}
const admin = new pg.Client({ connectionString });
await admin.connect();
const member = randomUUID();
const legacy = randomUUID();
const other = randomUUID();

async function actor(id) {
  const db = new pg.Client({ connectionString });
  await db.connect();
  await db.query('set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
  return db;
}

let memberDb;
let legacyDb;
try {
 // Assert the restored deployment contract; do not repair it within the test.
 const owners = await admin.query(`
   select pg_get_userbyid(proowner) as owner from pg_proc
   where oid in (
     'public.enforce_personal_portrait_consent()'::regprocedure,
     'public.require_applicant_portrait_consent()'::regprocedure
   )
 `);
 assert.deepEqual(owners.rows.map(row => row.owner), ['postgres', 'postgres']);
 await test('actual Auth signup trigger stores explicit consent before email confirmation',async()=>{
  await admin.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)',[member,`${member}@synthetic.invalid`,{name:'신규 테스트',portrait_consent:true}]);
  const p=(await admin.query('select * from profiles where id=$1',[member])).rows[0];
  assert.ok(p,'handle_new_user must create the row');assert.ok(p.portrait_consent_at);assert.equal(p.number,0);
 });
 await admin.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3),($4,$5,$6)',[legacy,`${legacy}@synthetic.invalid`,{name:'기존 테스트'},other,`${other}@synthetic.invalid`,{name:'다른 테스트'}]);
 memberDb=await actor(member);legacyDb=await actor(legacy);
 await test('real column grants keep private consent unreadable through profiles and readable through own RPC',async()=>{
  await assert.rejects(memberDb.query('select portrait_consent_at from profiles'),/permission denied/);
  const p=(await memberDb.query('select * from get_my_profile()')).rows;
  assert.equal(p.length,1);assert.equal(p[0].id,member);assert.ok(p[0].portrait_consent_at);
 });
 await test('real RLS and all existing triggers reject a non-consenting card creation',async()=>{
  await assert.rejects(legacyDb.query("update profiles set number=8,position='ALA' where id=$1 returning id",[legacy]),/초상권/);
  assert.equal((await legacyDb.query('select portrait_consent_at from get_my_profile()')).rows[0].portrait_consent_at,null);
 });
 await test('consented photo-optional card is saved with all deployed guards and statistics intact',async()=>{
  const original=(await memberDb.query('select * from get_my_profile()')).rows[0];
  await memberDb.query("update profiles set number=7,position='ALA',name='이름 수정' where id=$1 returning id",[member]);
  const saved=(await memberDb.query('select * from get_my_profile()')).rows[0];
  assert.equal(saved.number,7);assert.equal(saved.goals,original.goals);assert.equal(saved.portrait_consent_at.getTime(),original.portrait_consent_at.getTime());
 });
 await test('existing member can consent without a card; server time replaces submitted time',async()=>{
  await legacyDb.query("update profiles set portrait_consent_at='2000-01-01' where id=$1 returning id",[legacy]);
  const p=(await legacyDb.query('select * from get_my_profile()')).rows[0];assert.ok(Math.abs(p.portrait_consent_at.getTime()-Date.now())<5000);
 });
 await test('personal consent plus deployed team INSERT/claim flow succeeds',async()=>{
  const id=randomUUID();
  await memberDb.query("insert into teams(id,name,captain_id,portrait_consent_at) values($1,'합성 검증 팀',$2,now()) returning id",[id,member]);
  await memberDb.query('select claim_team_coach($1)',[id]);
  const p=(await memberDb.query('select * from get_my_profile()')).rows[0];assert.equal(p.team_id,id);assert.equal(p.team_role,'coach');
 });
 await test('team application with only team attestation is rejected',async()=>{
  const db=await actor(other);try{await assert.rejects(db.query("insert into teams(id,name,captain_id,portrait_consent_at) values($1,'미동의 검증',$2,now())",[randomUUID(),other]),/신청자 본인/);}finally{await db.end();}
 });
 await test('ordinary member cannot consent on behalf of another member',async()=>{
  const result=await memberDb.query('update profiles set portrait_consent_at=now() where id=$1 returning id',[other]);assert.equal(result.rowCount,0);
 });
}finally{await memberDb?.end();await legacyDb?.end();await admin.end();}
