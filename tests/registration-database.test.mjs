import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
const connectionString=process.env.FAIRGROUND_TEST_DB_URL;
if (!connectionString) throw new Error('Set FAIRGROUND_TEST_DB_URL to an isolated local PostgreSQL database.');
const target=new URL(connectionString);
if (!['127.0.0.1','localhost','[::1]'].includes(target.hostname)) throw new Error('Only an isolated LOCAL database is permitted.');
const admin=new pg.Client({connectionString});await admin.connect();
const owner=randomUUID(), nextOwner=randomUUID(), rival=randomUUID(), failing=randomUUID(), teamId=randomUUID();
const actor=async(id)=>{const db=new pg.Client({connectionString});await db.connect();await db.query('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);return db;};
let ownerDb, nextDb;
try {
  // Synthetic records only; this script deliberately refuses hosted databases.
  for(const id of [owner,nextOwner,rival,failing]){
    await admin.query('insert into auth.users(id,email) values($1,$2)',[id,`${id}@synthetic.invalid`]);
    await admin.query('insert into public.profiles(id,name,number,position,is_approved) values($1,$2,7,\'ALA\',$3)',[id,'검증용 선수',id!==owner]);
  }
  ownerDb=await actor(owner);nextDb=await actor(nextOwner);
  await test('team creation commits team, membership and mandatory history together',async()=>{
    const result=await ownerDb.query("select (public.register_team($1,'검증용 팀','',2026,'community',now())).*",[teamId]);
    assert.equal(result.rows[0].captain_id,owner);assert.equal(result.rows[0].member_count,1);
    const profile=(await admin.query('select team_id,team_role,is_approved from public.profiles where id=$1',[owner])).rows[0];
    assert.equal(profile.team_id,teamId);assert.equal(profile.team_role,'coach');assert.equal(profile.is_approved,false);
    const history=(await admin.query("select entity_type from registration_history where entity_id in ($1,$2)",[teamId,owner])).rows;
    assert.ok(history.some(r=>r.entity_type==='team'));assert.ok(history.some(r=>r.entity_type==='player'));
  });
  await test('same or different retry ID recovers the existing team without a duplicate',async()=>{
    const retry=(await ownerDb.query("select (public.register_team($1,'검증용 팀','',2026,'community')).id",[teamId])).rows[0];
    const another=(await ownerDb.query("select (public.register_team($1,'검증용 팀','',2026,'community')).id",[randomUUID()])).rows[0];
    assert.equal(retry.id,teamId);assert.equal(another.id,teamId);
    assert.equal((await admin.query('select count(*)::int n from teams where captain_id=$1',[owner])).rows[0].n,1);
  });
  await test('changed retry details are rejected instead of silently discarding the new input',async()=>{
    await assert.rejects(ownerDb.query("select public.register_team($1,'검증용 팀','new-logo',2026,'community')",[teamId]),/이미 등록된 팀/);
    const saved=(await admin.query('select logo,founded_year from teams where id=$1',[teamId])).rows[0];
    assert.equal(saved.logo,'');assert.equal(saved.founded_year,2026);
  });
  await test('claim failure rolls back the inserted team and history',async()=>{
    await admin.query(`create function public.registration_test_fail_claim() returns trigger language plpgsql as $$ begin if new.id = '${failing}'::uuid and new.team_id is not null then raise exception 'synthetic claim failure'; end if; return new; end $$`);
    await admin.query('create trigger registration_test_fail_claim before update on profiles for each row execute function registration_test_fail_claim()');
    const db=await actor(failing); const id=randomUUID();
    try {
      await assert.rejects(db.query("select public.register_team($1,'롤백 검증')",[id]),/synthetic claim failure/);
      assert.equal((await admin.query('select count(*)::int n from teams where id=$1',[id])).rows[0].n,0);
      assert.equal((await admin.query('select count(*)::int n from registration_history where entity_id=$1',[id])).rows[0].n,0);
      assert.equal((await admin.query('select team_id from profiles where id=$1',[failing])).rows[0].team_id,null);
    } finally {await db.end();await admin.query('drop trigger registration_test_fail_claim on profiles; drop function registration_test_fail_claim()');}
  });
  // The live guards permit admin fixture setup, but ordinary actors keep real RLS/trigger enforcement.
  await admin.query("select set_config('app.applying_team_join_request','1',false)");
  await admin.query('update profiles set team_id=$1 where id=any($2::uuid[])',[teamId,[nextOwner,rival]]);
  await admin.query('update profiles set is_approved=true where id=$1',[owner]);
  await admin.query("select set_config('app.applying_team_join_request','',false)");
  await test('ownership transfer changes only owner and retains roster, player statistics and team identity',async()=>{
    const roster=(await admin.query('select id,team_id,goals,games from profiles where team_id=$1 order by id',[teamId])).rows;
    await ownerDb.query('select public.transfer_team_ownership($1,$2)',[teamId,nextOwner]);
    assert.equal((await admin.query('select captain_id from teams where id=$1',[teamId])).rows[0].captain_id,nextOwner);
    assert.deepEqual((await admin.query('select id,team_id,goals,games from profiles where team_id=$1 order by id',[teamId])).rows,roster);
    const h=(await admin.query("select before_values,after_values from registration_history where entity_id=$1 and operation='UPDATE' order by id desc limit 1",[teamId])).rows[0];
    assert.equal(h.before_values.captain_id,owner);assert.equal(h.after_values.captain_id,nextOwner);
  });
  await test('two concurrent transfers cannot both authorize as the previous owner',async()=>{
    await nextDb.query('select public.transfer_team_ownership($1,$2)',[teamId,owner]);
    const second=await actor(owner);
    try {
      await ownerDb.query('begin');
      await ownerDb.query('select public.transfer_team_ownership($1,$2)',[teamId,nextOwner]);
      let settled=false;
      const competing=second.query('select public.transfer_team_ownership($1,$2)',[teamId,rival]).then(()=>({ok:true}),e=>({error:e.message})).finally(()=>{settled=true;});
      await new Promise(r=>setTimeout(r,100));assert.equal(settled,false,'competing transfer must wait for team row lock');
      await ownerDb.query('commit');
      assert.match((await competing).error,/팀 소유자만/);
      assert.equal((await admin.query('select captain_id from teams where id=$1',[teamId])).rows[0].captain_id,nextOwner);
    } finally {await ownerDb.query('rollback');await second.end();}
  });
  await test('mandatory audit failure rolls back ownership instead of losing the change record',async()=>{
    await admin.query(`create function public.registration_test_fail_history() returns trigger language plpgsql as $$ begin if new.entity_id = '${teamId}'::uuid then raise exception 'synthetic audit failure'; end if; return new; end $$`);
    await admin.query('create trigger registration_test_fail_history before insert on registration_history for each row execute function registration_test_fail_history()');
    try {
      await assert.rejects(nextDb.query('select public.transfer_team_ownership($1,$2)',[teamId,owner]),/synthetic audit failure/);
      assert.equal((await admin.query('select captain_id from teams where id=$1',[teamId])).rows[0].captain_id,nextOwner);
    } finally {await admin.query('drop trigger registration_test_fail_history on registration_history; drop function registration_test_fail_history()');}
  });
  await test('ownerless team does not bypass ownership authorization through SQL NULL',async()=>{
    const orphan=randomUUID();await admin.query("insert into teams(id,name) values($1,'소유자 없음')",[orphan]);
    await assert.rejects(ownerDb.query('select public.transfer_team_ownership($1,$2)',[orphan,nextOwner]),/팀 소유자만/);
  });
  await test('ordinary participants cannot alter or view protected audit history',async()=>{
    assert.equal((await ownerDb.query('select * from registration_history')).rowCount,0);
    await assert.rejects(ownerDb.query('delete from registration_history'),/permission denied/);
  });
  await test('initial consent evidence is preserved across subsequent profile edits',async()=>{
    await ownerDb.query("update profiles set portrait_consent_at='2026-01-02T00:00:00Z' where id=$1",[owner]);
    await ownerDb.query("update profiles set portrait_consent_at='2026-09-08T00:00:00Z',name='변경 이름' where id=$1",[owner]);
    const p=(await admin.query('select portrait_consent_at,name from profiles where id=$1',[owner])).rows[0];
    assert.equal(p.portrait_consent_at.toISOString(),'2026-01-02T00:00:00.000Z');assert.equal(p.name,'변경 이름');
  });
} finally {await ownerDb?.end();await nextDb?.end();await admin.end();}
