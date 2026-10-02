import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
const url=process.env.FAIRGROUND_TEST_DB_URL;
if(!url || !['localhost','127.0.0.1','[::1]'].includes(new URL(url).hostname)) throw Error('Local synthetic DB required');
const db=new pg.Client({connectionString:url});await db.connect();await db.query('begin');
const [admin,coach,captain,former,member,pending,banned,team]=Array.from({length:8},randomUUID);
try {
  for(const id of [admin,coach,captain,former,member,pending,banned]) await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)',[id,`${id}@example.invalid`,{name:'합성 명단 검수',portrait_consent:true}]);
  await db.query("select set_config('app.in_end_match','1',true)");
  await db.query("update profiles set role='admin',is_approved=true where id=$1",[admin]);
  await db.query("insert into teams(id,name,is_approved) values($1,'합성 출전팀',true)",[team]);
  await db.query("select set_config('request.jwt.claim.sub',$1,true)",[admin]);
  await db.query('update profiles set team_id=$1,is_approved=true where id=any($2::uuid[])',[team,[coach,captain,former,member,pending,banned]]);
  await db.query("update profiles set role='captain',team_role='coach' where id=any($1::uuid[])",[[coach,former]]);
  await db.query("update profiles set team_role='captain' where id=$1",[captain]);
  await db.query('update profiles set is_approved=false where id=$1',[pending]);
  await db.query('update profiles set is_banned=true where id=$1',[banned]);
  await db.query("select set_config('app.in_end_match','0',true)");
  await db.query('set local role authenticated');
  await db.query('select set_player_eligibility($1,true)',[former]);
  await test('참가 자격 있는 감독·주장은 유지하고 선출·미승인·징계 회원은 경기 명단에서 제외한다',async()=>{
    for(const role of ['anon','authenticated']) {
      await db.query('reset role');await db.query('set local role '+role);
      const ids=(await db.query('select id from public_match_player_profiles where team_id=$1',[team])).rows.map(r=>r.id).sort();
      assert.deepEqual(ids,[coach,captain,member].sort());
      assert.equal((await db.query('select id from public_player_profiles where id=$1',[former])).rowCount,1,'일반 공개 프로필은 보존');
    }
  });
  await test('경기 명단에 비공개 프로필 필드를 추가 노출하거나 쓰기 권한을 주지 않는다',async()=>{
    const cols=(await db.query("select column_name from information_schema.columns where table_schema='public' and table_name='public_match_player_profiles'")).rows.map(r=>r.column_name);
    for(const privateColumn of ['phone','email','birth_date','gender','has_player_experience','team_role']) assert.ok(!cols.includes(privateColumn));
    for(const role of ['anon','authenticated']) for(const permission of ['INSERT','UPDATE','DELETE']) assert.equal((await db.query("select has_table_privilege($1,'public.public_match_player_profiles',$2) allowed",[role,permission])).rows[0].allowed,false);
  });
  await test('선출 정정은 직책·소속을 바꾸지 않으며 기존 서버 출전 제한에도 적용된다',async()=>{
    await db.query('reset role');
    const row=(await db.query('select role,team_role,team_id,has_player_experience from profiles where id=$1',[former])).rows[0];
    assert.deepEqual(row,{role:'captain',team_role:'coach',team_id:team,has_player_experience:true});
    await db.query('savepoint eligible_check');
    await assert.rejects(db.query('select assert_player_is_eligible($1)',[former]),/선출/);
    await db.query('rollback to savepoint eligible_check');
  });
} finally {await db.query('rollback');await db.end();}
