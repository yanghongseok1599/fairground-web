import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
const url=process.env.FAIRGROUND_TEST_DB_URL;
if(!url || !['localhost','127.0.0.1'].includes(new URL(url).hostname)) throw Error('Isolated local database required');
const db=new pg.Client({connectionString:url});await db.connect();
const [actor,player,outsider,home,away,match]=Array.from({length:6},randomUUID);
const rpc=async(client,id,kind,payload={},matchId=match)=>(await client.query('select public.apply_match_recording_operation($1,$2,$3,$4) result',[id,matchId,kind,payload])).rows[0].result;
const asActor=async(client,id=actor)=>{await client.query('set session authorization authenticated');await client.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);};
try {
  await db.query('begin');
  for(const id of [actor,player,outsider]) await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)',[id,`${id}@synthetic.invalid`,{name:'합성 기록 검수',portrait_consent:true}]);
  await db.query("select set_config('app.in_end_match','1',true)");
  await db.query("update profiles set role='referee',is_approved=true where id=$1",[actor]);
  for(const id of [home,away]) await db.query("insert into teams(id,name,is_approved) values($1,'합성 기록팀',true)",[id]);
  await db.query('update profiles set team_id=$1,is_approved=true where id=$2',[home,player]);
  await db.query("insert into matches(id,home_team_id,away_team_id,home_team_name,away_team_name,status) values($1,$2,$3,'합성 홈','합성 원정','scheduled')",[match,home,away]);
  await db.query('commit');await asActor(db);
  const start=randomUUID();
  await test('start + lost response retry has one receipt',async()=>{await rpc(db,start,'start');await rpc(db,start,'start');const r=(await db.query('select get_match_recording_snapshot($1) r',[match])).rows[0].r;assert.equal(r.match.status,'live');});
  const event=randomUUID(),payload={type:'goal',playerId:player,playerName:'합성 선수',teamId:home,minute:2,half:1};
  await test('concurrent replay of the same goal commits once',async()=>{
    const clients=await Promise.all(Array.from({length:8},async()=>{const c=new pg.Client({connectionString:url});await c.connect();await asActor(c);return c;}));
    try{await Promise.all(clients.map(c=>rpc(c,event,'event',payload)));}finally{await Promise.all(clients.map(c=>c.end()));}
    const r=await rpc(db,event,'event',payload);assert.equal(r.match.home_score,1);assert.equal(r.events.filter(e=>e.type==='goal').length,1);assert.equal(r.eventOperations[r.events[0].id],event);
  });
  await test('same ID with changed payload or actor is rejected',async()=>{
    await assert.rejects(rpc(db,event,'event',{...payload,minute:3}),/conflict/);
    await db.query('reset session authorization');await asActor(db,outsider);await assert.rejects(rpc(db,event,'event',payload),/approved referee/);await db.query('reset session authorization');await asActor(db);
  });
  await test('cancel pending goal by original operation UUID and replay safely',async()=>{const id=randomUUID();await rpc(db,id,'cancel',{eventOperationId:event});const r=await rpc(db,id,'cancel',{eventOperationId:event});assert.equal(r.match.home_score,0);assert.equal(r.events[0].is_cancelled,true);});
  await test('timer never regresses on delayed command',async()=>{await rpc(db,randomUUID(),'timer',{seconds:120,half:1});const r=await rpc(db,randomUUID(),'timer',{seconds:30,half:1});assert.equal(r.match.elapsed_seconds,120);});
  await test('two yellows create one red even after retries',async()=>{for(let i=0;i<2;i++){const id=randomUUID();await rpc(db,id,'event',{...payload,type:'yellow_card'});await rpc(db,id,'event',{...payload,type:'yellow_card'});}const r=await rpc(db,randomUUID(),'pause');assert.equal(r.events.filter(e=>e.type==='red_card').length,1);});
  await test('end finalizes once, including response-loss replay',async()=>{await rpc(db,randomUUID(),'mom',{playerId:player});const id=randomUUID();await rpc(db,id,'end');const r=await rpc(db,id,'end');assert.equal(r.match.status,'finished');assert.equal(r.match.stats_applied,true);await db.query('reset session authorization');const p=(await db.query('select games,mom from profiles where id=$1',[player])).rows[0];assert.equal(p.games,1);assert.equal(p.mom,1);await asActor(db);});
  await test('new command against a finished match is rejected, not silently lost',async()=>{await assert.rejects(rpc(db,randomUUID(),'event',payload),/already closed/);});
  await test('receipt table cannot be written or read by API roles',async()=>{for(const role of ['anon','authenticated'])for(const permission of ['SELECT','INSERT','UPDATE','DELETE'])assert.equal((await db.query("select has_table_privilege($1,'public.match_recording_receipts',$2) allowed",[role,permission])).rows[0].allowed,false);});
} finally {await db.query('reset session authorization');await db.end();}
