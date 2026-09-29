// Run only on a local database restored from the current schema and migrated first.
import assert from 'node:assert/strict';import test from 'node:test';import pg from 'pg';import {randomUUID} from 'node:crypto';
const url=process.env.FAIRGROUND_TEST_DB_URL;
if(!url||!['localhost','127.0.0.1','[::1]'].includes(new URL(url).hostname))throw Error('Local synthetic DB required');
const db=new pg.Client({connectionString:url});await db.connect();await db.query('begin');
const user=randomUUID(),other=randomUUID(),admin=randomUUID(),team=randomUUID(),match=randomUUID();
try{
 await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,'jersey-test@example.invalid',$4),($2,'jersey-unset@example.invalid','{}'),($3,'jersey-admin@example.invalid',$4)",[user,other,admin,{name:'합성 선수',portrait_consent:true}]);
 // Bootstrap synthetic approval/admin using the existing authorized-workflow switch.
 await db.query("select set_config('app.in_end_match','1',true)");
 await db.query("update profiles set is_approved=true where id in ($1,$2,$3)",[user,other,admin]);
 await db.query("update profiles set role='admin' where id=$1",[admin]);
 await db.query("insert into teams(id,name) values($1,'합성 팀')",[team]);
 await db.query('update profiles set team_id=$1 where id=$2',[team,user]);
 await db.query('insert into matches(id,home_team_id) values($1,$2)',[match,team]);
 await db.query("select set_config('app.in_end_match','0',true)");
 const asUser=async id=>{await db.query('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[id]);await db.query('set local role authenticated')};
 const rejected=async(sql,args,pattern)=>{await db.query('savepoint rejected');await assert.rejects(db.query(sql,args),pattern);await db.query('rollback to savepoint rejected')};
 await test('authenticated owner can save and reload all 1–3 digit spellings via get_my_profile',async()=>{
  await asUser(user);
  for(const label of ['0','00','000','1','01','02','99','100','999','007']) {await db.query('update profiles set number=$1,number_label=$2 where id=$3',[Number(label),label,user]);const r=(await db.query('select number,number_label from get_my_profile()')).rows;assert.deepEqual(r,[{number:Number(label),number_label:label}]);}
 });
 await test('public/member views and admin RPC expose label with existing security',async()=>{
  await db.query('reset role;set local role anon');assert.equal((await db.query('select number_label from public_player_profiles where id=$1',[user])).rows[0].number_label,'007');
  await asUser(user);assert.equal((await db.query('select number_label from get_team_member_profiles($1) where id=$2',[team,user])).rows[0].number_label,'007');
  await rejected('select * from get_admin_profiles()',[],/관리자/);
  await asUser(admin);assert.equal((await db.query('select number_label from get_admin_profiles() where id=$1',[user])).rows[0].number_label,'007');
 });
 await test('zero labels still require the owner portrait consent',async()=>{await asUser(other);await rejected("update profiles set number_label='00' where id=$1",[other],/초상권/);assert.equal((await db.query('select number_label from get_my_profile()')).rows[0].number_label,null)});
 await test('invalid labels and mismatched numeric values fail atomically',async()=>{await asUser(user);for(const [num,label] of [[5,'00'],[0,'1'],[1000,null],[-1,null],[7,'0007'],[7,'7.0'],[7,'+7'],[7,' 7'],[7,'7\n'],[7,'７']])await rejected('update profiles set number=$1,number_label=$2 where id=$3',[num,label,user],/profiles_jersey_number_label/);assert.equal((await db.query('select number_label from get_my_profile()')).rows[0].number_label,'007')});
 await test('lineup keeps 007 independently of profile edits',async()=>{await asUser(admin);await db.query("insert into match_lineups(match_id,team_id,player_id,jersey_number,jersey_number_label) values($1,$2,$3,7,'007')",[match,team,user]);await asUser(user)});
 await test('lineup rejects four digits, mismatched labels and labels without a number',async()=>{await asUser(admin);for(const [n,label] of [[1000,null],[7,'0007'],[7,'008'],[null,'007']])await rejected('update match_lineups set jersey_number=$1,jersey_number_label=$2 where match_id=$3',[n,label,match],/lineups_jersey_number_label/);await asUser(user)});
 await test('owner can change to a positive number without losing identity/photo/stats',async()=>{
  const before=(await db.query('select to_jsonb(p)-\'number\'-\'number_label\' value from get_my_profile() p')).rows[0].value;
  await db.query('update profiles set number=12,number_label=null where id=$1',[user]);
  const after=(await db.query('select to_jsonb(p)-\'number\'-\'number_label\' value from get_my_profile() p')).rows[0].value;assert.deepEqual(after,before);
  assert.equal((await db.query('select jersey_number_label from match_lineups where match_id=$1',[match])).rows[0].jersey_number_label,'007');
 });
}finally{await db.query('rollback');await db.end();}
