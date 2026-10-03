import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
const url=process.env.FAIRGROUND_TEST_DB_URL;
if(!url || !['localhost','127.0.0.1'].includes(new URL(url).hostname)) throw Error('Isolated local database required');
const db=new pg.Client({connectionString:url});await db.connect();
const [referee,admin,playerHome,playerAway,outsider,unapproved,home,away,match,running,group,nonTie,early,scheduled,cancelled]=Array.from({length:15},randomUUID);
const as=async(c,id=referee)=>{await c.query('reset session authorization');await c.query('set session authorization authenticated');await c.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);};
const rpc=async(c,kind,payload={},id=randomUUID(),matchId=match)=>(await c.query('select apply_match_recording_operation($1,$2,$3,$4) r',[id,matchId,kind,payload])).rows[0].r;
const read=async(c=db)=>(await c.query('select get_match_recording_snapshot($1) r',[match])).rows[0].r;
const result=(h=4,a=3,bh=-1,ba=-1)=>({homeScore:h,awayScore:a,_shootoutHomeBefore:bh,_shootoutAwayBefore:ba,_deviceId:'shootout-test'});
let other;
try{
  await db.query('begin');
  for(const id of [referee,admin,playerHome,playerAway,outsider,unapproved])await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)',[id,`${id}@synthetic.invalid`,{name:'합성 승부차기 검수',portrait_consent:true}]);
  await db.query("select set_config('app.in_end_match','1',true)");
  await db.query("update profiles set role='referee',is_approved=true where id=$1",[referee]);
  await db.query("update profiles set role='admin',is_approved=true where id=$1",[admin]);
  await db.query("update profiles set role='referee',is_approved=false where id=$1",[unapproved]);
  for(const id of [home,away])await db.query("insert into teams(id,name,is_approved) values($1,'합성 승부차기팀',true)",[id]);
  await db.query('update profiles set team_id=$1,is_approved=true where id=$2',[home,playerHome]);
  await db.query('update profiles set team_id=$1,is_approved=true where id=$2',[away,playerAway]);
  for(const [id,status,isRunning,groupId,round,h,a] of [[match,'live',false,null,13,0,0],[running,'live',true,null,14,0,0],[group,'live',false,'A',15,0,0],[nonTie,'live',false,null,15,1,0],[early,'live',false,null,3,0,0],[scheduled,'scheduled',false,null,16,0,0],[cancelled,'cancelled',false,null,16,0,0]])await db.query("insert into matches(id,home_team_id,away_team_id,home_team_name,away_team_name,status,is_running,group_id,round,home_score,away_score) values($1,$2,$3,'합성 홈','합성 원정',$4,$5,$6,$7,$8,$9)",[id,home,away,status,isRunning,groupId,round,h,a]);
  await db.query('commit');await as(db);
  other=new pg.Client({connectionString:url});await other.connect();await as(other,admin);
  await test('unapproved, ordinary and anonymous roles cannot record shootout',async()=>{
    for(const id of [outsider,unapproved]){await as(db,id);await assert.rejects(rpc(db,'shootout',result()),/approved referee/);}
    await db.query('reset session authorization');await db.query('set session authorization anon');await assert.rejects(rpc(db,'shootout',result()),/permission denied/);await as(db);
  });
  await test('regulation goals remain ordinary player events',async()=>{
    for(const [player,team] of [[playerHome,home],[playerAway,away]])await rpc(db,'event',{type:'goal',playerId:player,playerName:'합성 선수',teamId:team,minute:2,half:1});
    const r=await read();assert.equal(r.match.home_score,1);assert.equal(r.match.away_score,1);assert.equal(r.events.length,2);
  });
  await test('tied placement match cannot be finalized before shootout',async()=>{await assert.rejects(rpc(db,'end'),/승부차기 결과/);assert.equal((await read()).match.status,'live');});
  await test('running, grouped, earlier, scheduled, cancelled and non-tied matches reject shootout',async()=>{
    await assert.rejects(rpc(db,'shootout',result(),randomUUID(),running),/pause the match/);
    for(const id of [group,nonTie,early,scheduled,cancelled])await assert.rejects(rpc(db,'shootout',result(),randomUUID(),id),/tied placement|already closed/);
  });
  await test('negative, fractional, out-of-range, string, missing, equal scores and missing before values reject',async()=>{
    for(const p of [result(-1,3),result(1.5,3),result(100,3),result('4',3),{...result(),homeScore:undefined},result(3,3),{homeScore:4,awayScore:3},result(4,3,-2,-1)])await assert.rejects(rpc(db,'shootout',p),/integers|winner|previous scores/);
  });
  await test('stale server revision rejects without creating a receipt',async()=>{const r=await read();await assert.rejects(rpc(db,'shootout',{...result(),_serverRevision:r.serverRevision-1}),/result changed/);assert.equal((await read()).match.home_shootout_score,null);});
  const op=randomUUID(),payload=result();let revision;
  await test('save separate shootout totals and response-loss replay once',async()=>{
    const before=await read();const r=await rpc(db,'shootout',payload,op);revision=r.serverRevision;
    assert.equal(r.match.home_shootout_score,4);assert.equal(r.match.away_shootout_score,3);assert.equal(r.match.home_score,1);assert.equal(r.match.away_score,1);assert.equal(r.events.length,2);assert.ok(revision>before.serverRevision);assert.ok(r.appliedOperationIds.includes(op));
    const replay=await rpc(db,'shootout',payload,op);assert.equal(replay.serverRevision,revision);await db.query('reset session authorization');assert.equal((await db.query('select count(*)::int n from match_recording_receipts where operation_id=$1',[op])).rows[0].n,1);await as(db);
  });
  await test('same operation UUID with changed result is rejected',async()=>{await assert.rejects(rpc(db,'shootout',result(5,3),op),/ID conflict/);});
  await test('another approved recorder sees saved result and stale values cannot overwrite it',async()=>{const r=await read(other);assert.equal(r.match.home_shootout_score,4);await assert.rejects(rpc(other,'shootout',result(5,2)),/result changed/);assert.equal((await read()).serverRevision,revision);});
  await test('simultaneous corrections accept one expected-value update',async()=>{
    const updates=await Promise.allSettled([rpc(db,'shootout',result(5,3,4,3)),rpc(other,'shootout',result(4,2,4,3))]);assert.equal(updates.filter(r=>r.status==='fulfilled').length,1);assert.match(updates.find(r=>r.status==='rejected').reason.message,/result changed/);
  });
  await test('finalization uses regulation goals and draw statistics once',async()=>{
    const id=randomUUID();await rpc(db,'end',{},id);await rpc(db,'end',{},id);const r=await read();assert.equal(r.match.status,'finished');assert.equal(r.match.stats_applied,true);
    await db.query('reset session authorization');const players=(await db.query('select games,goals from profiles where id=any($1::uuid[]) order by id',[[playerHome,playerAway]])).rows;assert.deepEqual(players,[{games:1,goals:1},{games:1,goals:1}]);
    const teams=(await db.query('select season_stats from teams where id=any($1::uuid[])',[[home,away]])).rows;for(const {season_stats:s} of teams){assert.equal(s.draws,1);assert.equal(s.goalsFor,1);assert.equal(s.goalsAgainst,1);}await as(db);
  });
  await test('finished correction leaves regulation result, events and all statistics untouched',async()=>{
    await db.query('reset session authorization');const before=(await db.query('select (select jsonb_agg(to_jsonb(p) order by id) from profiles p) profiles,(select jsonb_agg(to_jsonb(t) order by id) from teams t) teams')).rows[0];await as(db);const r=await read();const edited=await rpc(db,'shootout',result(3,4,r.match.home_shootout_score,r.match.away_shootout_score));assert.equal(edited.match.status,'finished');assert.equal(edited.match.home_shootout_score,3);assert.equal(edited.match.away_shootout_score,4);assert.equal(edited.match.home_score,1);assert.equal(edited.events.length,2);
    await db.query('reset session authorization');assert.deepEqual((await db.query('select (select jsonb_agg(to_jsonb(p) order by id) from profiles p) profiles,(select jsonb_agg(to_jsonb(t) order by id) from teams t) teams')).rows[0],before);await as(db);
  });
  await test('table constraint prevents partial, equal, negative and oversized saved totals',async()=>{await db.query('reset session authorization');for(const [h,a] of [[null,3],[3,null],[3,3],[-1,3],[100,3]])await assert.rejects(db.query('update matches set home_shootout_score=$1,away_shootout_score=$2 where id=$3',[h,a,scheduled]),/matches_shootout_score_check/);});
}finally{await db.query('reset session authorization');await db.end();if(other)await other.end();}
