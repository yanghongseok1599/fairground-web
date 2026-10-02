// Exercise production's existing RLS against synthetic identities in a local restore only.
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
const url=process.env.FAIRGROUND_TEST_DB_URL;
if(!url || !['localhost','127.0.0.1','[::1]'].includes(new URL(url).hostname)) throw Error('Local synthetic DB required');
const db=new pg.Client({connectionString:url});await db.connect();await db.query('begin');
const [admin,operator,player,team,event]=Array.from({length:5},randomUUID);
const asUser=async id=>{await db.query('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[id]);await db.query('set local role authenticated');};
try {
  for(const id of [admin,operator,player]) await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)',[id,`${id}@example.invalid`,{name:'합성 현장 선수',portrait_consent:true}]);
  await db.query("select set_config('app.in_end_match','1',true)");
  await db.query("update profiles set role='admin',is_approved=true where id=$1",[admin]);
  await db.query("insert into teams(id,name,is_approved) values($1,'합성 현장팀',true)",[team]);
  await db.query('update profiles set team_id=$1,is_approved=true where id=any($2::uuid[])',[team,[operator,player]]);
  await db.query("insert into tournaments(id,name,groups) values($1,'합성 현장 대회',$2)",[event,JSON.stringify([{teamIds:[team]}])]);
  await db.query('insert into player_inspection_operators(profile_id,granted_by) values($1,$2)',[operator,admin]);
  await db.query("select set_config('app.in_end_match','0',true)");
  await test('admin can save gender with current table grants; roster and participant RPC agree',async()=>{
    await asUser(admin);
    const saved=await db.query("update profiles set gender=$1 where id=$2 and team_id=$3 and role in ('player','captain') returning id",['female',player,team]);
    assert.equal(saved.rowCount,1);
    assert.equal((await db.query('select gender from get_admin_profiles() where id=$1',[player])).rows[0].gender,'female');
    await asUser(player);assert.equal((await db.query('select gender::text from get_my_profile()')).rows[0].gender,'female');
  });
  await test('inspection-only operators and other participants cannot alter another gender',async()=>{
    for(const actor of [operator,player]) {
      await asUser(actor);
      const target=actor===player?operator:player;
      assert.equal((await db.query('update profiles set gender=$1 where id=$2 returning id',['male',target])).rowCount,0);
    }
  });
} finally {await db.query('rollback');await db.end();}
