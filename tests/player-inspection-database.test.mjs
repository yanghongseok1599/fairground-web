// Requires an isolated local schema restored from the verified FairGround baseline
// and 20260930010000 applied. All fixtures are synthetic and rolled back.
import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';
import { randomUUID } from 'node:crypto';

const url = process.env.FAIRGROUND_TEST_DB_URL;
if (!url || !['localhost','127.0.0.1','[::1]'].includes(new URL(url).hostname)) throw Error('Local synthetic DB required');
const db = new pg.Client({connectionString:url});
await db.connect();
await db.query('begin');
const [admin,otherAdmin,player,other,pending,registered,referee,team,otherTeam,unapprovedTeam,event,secondEvent] = Array.from({length:12},randomUUID);
const asUser = async (id,role='authenticated') => {
  await db.query('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,true)",[id ?? '']);
  await db.query(`set local role ${role}`);
};
const rejected = async (sql,args,pattern) => {
  await db.query('savepoint rejected');
  await assert.rejects(db.query(sql,args),pattern);
  await db.query('rollback to savepoint rejected');
};
const read = async () => (await db.query('select * from get_admin_player_inspections($1)',[event])).rows;
const save = async (id,complete,revision,tournament=event) => (await db.query('select set_player_inspection($1,$2,$3,$4) revision',[tournament,id,complete,revision])).rows[0].revision;
try {
  for (const id of [admin,otherAdmin,player,other,pending,registered,referee]) {
    await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)',[id,`${id}@example.invalid`,{name:'검인 합성 선수',portrait_consent:true}]);
  }
  await db.query("select set_config('app.in_end_match','1',true)");
  await db.query("update profiles set is_approved=true where id=any($1::uuid[])",[[admin,otherAdmin,player,other,registered,referee]]);
  await db.query("update profiles set role='admin' where id=any($1::uuid[])",[[admin,otherAdmin]]);
  await db.query("update profiles set role='referee' where id=$1",[referee]);
  await db.query("insert into teams(id,name,is_approved) values($1,'검인 파랑 FC',true),($2,'검인 초록 FC',true),($3,'미승인 FC',false)",[team,otherTeam,unapprovedTeam]);
  await db.query('update profiles set team_id=$1 where id=any($2::uuid[])',[team,[player,pending,registered,admin,referee]]);
  await db.query('update profiles set team_id=$1 where id=$2',[otherTeam,other]);
  await db.query("update profiles set number=7,number_label='007',birth_date='2000-01-02' where id=$1",[player]);
  await db.query('update profiles set has_player_experience=true where id=$1',[registered]);
  await db.query("insert into tournaments(id,name,groups) values($1,'검인 합성 대회',$3),($2,'다음 합성 대회',$3)",[event,secondEvent,JSON.stringify([{id:'a',name:'A',teamIds:[team]}])]);
  await db.query("select set_config('app.in_end_match','0',true)");

  await test('admin roster includes only event teams and player/captain roles, retains leading zero',async()=>{
    await asUser(admin);
    const roster=await read();
    assert.deepEqual(roster.map(p=>p.player_id).sort(),[player,pending,registered].sort());
    const p=roster.find(p=>p.player_id===player);
    assert.equal(p.number_label,'007');assert.equal(p.birth_date,'2000-01-02');assert.equal(p.checked_at,null);assert.equal(p.revision,0);
  });
  await test('anonymous, player and referee cannot inspect or read the admin roster',async()=>{
    for(const [id,role] of [[null,'anon'],[player,'authenticated'],[referee,'authenticated']]) {
      await asUser(id,role);
      await rejected('select * from get_admin_player_inspections($1)',[event],/permission denied|관리자/);
      await rejected('select set_player_inspection($1,$2,true,0)',[event,player],/permission denied|관리자/);
    }
  });
  await test('even authenticated admins cannot forge or directly read inspection table rows',async()=>{
    await asUser(admin);
    await rejected('select * from player_inspections',[],/permission denied/);
    await rejected('insert into player_inspections(tournament_id,player_id,team_id,revision) values($1,$2,$3,1)',[event,player,team],/permission denied/);
  });
  await test('unapproved, registered, unrelated-team, and nonexistent players fail atomically',async()=>{
    for(const [id,pattern] of [[pending,/가입 승인/],[registered,/참가 자격/],[other,/참가팀/],[randomUUID(),/선수를 찾을/]])
      await rejected('select set_player_inspection($1,$2,true,0)',[event,id],pattern);
    assert.equal((await read()).every(p=>p.checked_at===null),true);
  });
  await test('completion is durable, stamped by the server and scoped to one tournament',async()=>{
    assert.equal(await save(player,true,0),1);
    const p=(await read()).find(p=>p.player_id===player);
    assert.ok(p.checked_at instanceof Date);assert.equal(p.revision,1);assert.equal(p.checked_by_name,'검인 합성 선수');
    await asUser(player);
    const mine=(await db.query('select * from get_my_player_inspections()')).rows;
    assert.equal(mine.length,2);assert.ok(mine.find(r=>r.tournament_id===event).checked_at);
    assert.equal(mine.find(r=>r.tournament_id===secondEvent).checked_at,null);
    await asUser(other);assert.equal((await db.query('select * from get_my_player_inspections()')).rowCount,0);
  });
  await test('stale second operator cannot overwrite a completion or cancellation',async()=>{
    await asUser(otherAdmin);
    await rejected('select set_player_inspection($1,$2,false,0)',[event,player],/다른 관리자/);
    assert.equal(await save(player,false,1),2);
    await rejected('select set_player_inspection($1,$2,true,1)',[event,player],/다른 관리자/);
    await asUser(player);
    assert.equal((await db.query('select checked_at from get_my_player_inspections() where tournament_id=$1',[event])).rows[0].checked_at,null);
  });
  await test('approval and team changes invalidate the displayed completion',async()=>{
    await asUser(admin);await save(player,true,2);
    await db.query('reset role');await db.query("select set_config('app.in_end_match','1',true)");
    await db.query('update profiles set is_approved=false where id=$1',[player]);
    await asUser(player);assert.equal((await db.query('select checked_at from get_my_player_inspections() where tournament_id=$1',[event])).rows[0].checked_at,null);
    await db.query('reset role');await db.query('update profiles set is_approved=true,team_id=$1 where id=$2',[otherTeam,player]);
    await db.query('update tournaments set groups=$1 where id=$2',[JSON.stringify([{teamIds:[team,otherTeam]}]),event]);
    await asUser(player);assert.equal((await db.query('select checked_at from get_my_player_inspections() where tournament_id=$1',[event])).rows[0].checked_at,null);
    await asUser(admin);assert.equal((await read()).find(r=>r.player_id===player).checked_at,null);
  });
  await test('before group assignment approved teams are available; unapproved teams are excluded',async()=>{
    await db.query('reset role');await db.query("update tournaments set groups='[]' where id=$1",[event]);
    await db.query('update profiles set team_id=$1 where id=$2',[unapprovedTeam,pending]);
    await asUser(admin);const roster=await read();
    assert.ok(roster.some(r=>r.player_id===other));assert.ok(!roster.some(r=>r.player_id===pending));
  });
} finally { await db.query('rollback');await db.end(); }
