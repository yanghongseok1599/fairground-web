import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
const url=process.env.FAIRGROUND_TEST_DB_URL;
if(!url || !['localhost','127.0.0.1'].includes(new URL(url).hostname)) throw Error('Isolated local database required');
const db=new pg.Client({connectionString:url});await db.connect();
const [actorA,actorB,player,home,away,match]=Array.from({length:6},randomUUID);
const as=async(c,actor)=>{await c.query('reset session authorization');await c.query('set session authorization authenticated');await c.query("select set_config('request.jwt.claim.sub',$1,false)",[actor]);};
const rpc=async(c,kind,payload={},id=randomUUID())=>(await c.query('select apply_match_recording_operation($1,$2,$3,$4) r',[id,match,kind,payload])).rows[0].r;
const read=async(c=db)=>(await c.query('select get_match_recording_snapshot($1) r',[match])).rows[0].r;
const clock=(version,device)=>({_clockVersion:version,_deviceId:device});
const goal={type:'goal',playerId:player,playerName:'합성 선수',teamId:home,minute:1,half:1};
let b;
try {
  await db.query('begin');
  for(const [id,name] of [[actorA,'합성 심판 A'],[actorB,'합성 운영 B'],[player,'합성 선수']])await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)',[id,`${id}@synthetic.invalid`,{name,portrait_consent:true}]);
  await db.query("select set_config('app.in_end_match','1',true)");
  await db.query("update profiles set role='referee',is_approved=true where id=any($1::uuid[])",[[actorA,actorB]]);
  for(const id of [home,away])await db.query("insert into teams(id,name,is_approved) values($1,'합성 공동 기록팀',true)",[id]);
  await db.query('update profiles set team_id=$1,is_approved=true where id=$2',[home,player]);
  await db.query("insert into matches(id,home_team_id,away_team_id,home_team_name,away_team_name,status) values($1,$2,$3,'합성 홈','합성 원정','scheduled')",[match,home,away]);
  await db.query('commit');await as(db,actorA);
  b=new pg.Client({connectionString:url});await b.connect();await as(b,actorB);
  await test('simultaneous start keeps one owner and never resets elapsed time',async()=>{
    const first=await rpc(db,'start',clock(0,'A'));assert.equal(first.clock.version,1);assert.equal(first.clock.ownerId,actorA);
    await rpc(db,'timer',{...clock(1,'A'),seconds:30,half:1});
    const duplicate=await rpc(b,'start',clock(0,'B'));assert.equal(duplicate.match.elapsed_seconds,30);assert.equal(duplicate.clock.ownerId,actorA);
  });
  await test('a second recorder cannot write the active owner clock',async()=>{
    const id=randomUUID();const r=await rpc(b,'timer',{...clock(1,'B'),seconds:500,half:1},id);
    assert.equal(r.match.elapsed_seconds,30);assert.ok(r.appliedOperationIds.includes(id));
  });
  await test('independent concurrent goals merge and expose verified record authors',async()=>{
    const ids=[randomUUID(),randomUUID()];const before=(await read()).serverRevision;
    await Promise.all([rpc(db,'event',goal,ids[0]),rpc(b,'event',goal,ids[1])]);
    const a=await read(),other=await read(b);assert.equal(a.match.home_score,2);assert.equal(a.events.length,2);assert.ok(a.serverRevision>before);
    assert.deepEqual(new Set(Object.values(a.eventAuthors).map(v=>v.id)),new Set([actorA,actorB]));
    assert.ok(a.appliedOperationIds.includes(ids[0]));assert.ok(!a.appliedOperationIds.includes(ids[1]));
    assert.ok(other.appliedOperationIds.includes(ids[1]));assert.equal(Object.keys(other.eventOperations).length,1);
  });
  await test('pause and resume transfer clock ownership; stale timers become safe acknowledgements',async()=>{
    const paused=await rpc(b,'pause',clock(1,'B'));assert.equal(paused.clock.version,2);assert.equal(paused.match.is_running,false);
    const late=await rpc(db,'timer',{...clock(1,'A'),seconds:99,half:1});assert.equal(late.match.elapsed_seconds,30);
    const resumed=await rpc(b,'resume',clock(2,'B'));assert.equal(resumed.clock.version,3);assert.equal(resumed.clock.ownerId,actorB);
    const stale=await rpc(db,'timer',{...clock(1,'A'),seconds:300,half:1});assert.equal(stale.match.elapsed_seconds,30);
    const legacy=await rpc(db,'timer',{seconds:400,half:1});assert.equal(legacy.match.elapsed_seconds,30);
    const current=await rpc(b,'timer',{...clock(3,'B'),seconds:40,half:1});assert.equal(current.match.elapsed_seconds,40);
    await assert.rejects(rpc(db,'end',clock(1,'A')),/clock control changed/);
  });
  await test('another recorder can cancel a shared event without losing author attribution',async()=>{
    const a=await read();const event=a.events.find(e=>a.eventAuthors[e.id].id===actorA);
    const r=await rpc(b,'cancel',{eventId:event.id});assert.equal(r.match.home_score,1);assert.equal(r.events.find(e=>e.id===event.id).is_cancelled,true);assert.equal(r.eventAuthors[event.id].id,actorA);
  });
  await test('multiple recorder finalization and delayed timer are idempotent',async()=>{
    await rpc(b,'mom',{playerId:player});await rpc(b,'end',clock(3,'B'));
    const r=await rpc(db,'end',clock(1,'A'));assert.equal(r.match.status,'finished');
    const timer=await rpc(db,'timer',{...clock(1,'A'),seconds:600,half:1});assert.equal(timer.match.elapsed_seconds,40);
    await assert.rejects(rpc(db,'event',goal),/already closed/);
    await db.query('reset session authorization');const p=(await db.query('select games,mom,goals from profiles where id=$1',[player])).rows[0];assert.deepEqual(p,{games:1,mom:1,goals:1});
  });
  await test('shared metadata table remains private and non-recorders cannot fetch the room',async()=>{
    for(const role of ['anon','authenticated'])for(const permission of ['SELECT','INSERT','UPDATE','DELETE'])assert.equal((await db.query("select has_table_privilege($1,'public.match_recording_state',$2) allowed",[role,permission])).rows[0].allowed,false);
    await as(db,player);await assert.rejects(read(),/approved referee/);
  });
}finally{await db.end();if(b)await b.end();}
