import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import pg from 'pg';

const url=process.env.FAIRGROUND_TEST_DB_URL;
if(!url || !['localhost','127.0.0.1'].includes(new URL(url).hostname))throw Error('Isolated local database required');
const db=new pg.Client({connectionString:url});await db.connect();
const [referee,admin,ordinary,unapproved,playerHome,playerAway,home,away,match,legacy,maximum,running,group]=Array.from({length:13},randomUUID);
const owner=async(c=db)=>c.query('reset session authorization');
const as=async(c=db,id=referee)=>{await owner(c);await c.query('set session authorization authenticated');await c.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);};
const rpc=async(c,kind,payload={},id=randomUUID(),matchId=match)=>(await c.query('select apply_match_recording_operation($1,$2,$3,$4) r',[id,matchId,kind,payload])).rows[0].r;
const read=async(c=db,id=match)=>(await c.query('select get_match_recording_snapshot($1) r',[id])).rows[0].r;
const count=a=>a.filter(Boolean).length;
const attempts=(h,a,before={})=>({homeScore:count(h),awayScore:count(a),homeAttempts:h,awayAttempts:a,
  _shootoutHomeBefore:before.home_shootout_score??-1,_shootoutAwayBefore:before.away_shootout_score??-1,
  _shootoutHomeAttemptsBefore:before.home_shootout_attempts??null,_shootoutAwayAttemptsBefore:before.away_shootout_attempts??null,_deviceId:'attempt-test'});
const totals=(h,a,bh=-1,ba=-1)=>({homeScore:h,awayScore:a,_shootoutHomeBefore:bh,_shootoutAwayBefore:ba,_deviceId:'legacy-test'});
const update=async(h,a,id=match)=>rpc(db,'shootout',attempts(h,a,(await read(db,id)).match),randomUUID(),id);
let other;
try{
  await db.query('begin');
  for(const id of [referee,admin,ordinary,unapproved,playerHome,playerAway])await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)',[id,`${id}@synthetic.invalid`,{name:'합성 차수별 승부차기',portrait_consent:true}]);
  await db.query("select set_config('app.in_end_match','1',true)");
  await db.query("update profiles set role='referee',is_approved=true where id=$1",[referee]);
  await db.query("update profiles set role='admin',is_approved=true where id=$1",[admin]);
  await db.query("update profiles set role='referee',is_approved=false where id=$1",[unapproved]);
  for(const id of [home,away])await db.query("insert into teams(id,name,is_approved) values($1,'합성 차수별팀',true)",[id]);
  await db.query('update profiles set team_id=$1,is_approved=true where id=$2',[home,playerHome]);
  await db.query('update profiles set team_id=$1,is_approved=true where id=$2',[away,playerAway]);
  for(const id of [match,legacy,maximum,running,group])await db.query("insert into matches(id,home_team_id,away_team_id,home_team_name,away_team_name,status,is_running,group_id,round,home_score,away_score) values($1,$2,$3,'합성 홈','합성 원정','live',$4,$5,18,0,0)",[id,home,away,id===running,id===group?'A':null]);
  await db.query('commit');await as();other=new pg.Client({connectionString:url});await other.connect();await as(other,admin);

  await test('new histories are NULL and legacy totals remain unknown until explicitly recorded',async()=>{
    const r=await read();assert.equal(r.match.home_shootout_attempts,null);assert.equal(r.match.away_shootout_attempts,null);
    const old=await rpc(db,'shootout',totals(4,3),randomUUID(),legacy);assert.equal(old.match.home_shootout_attempts,null);assert.equal(old.match.away_shootout_attempts,null);
  });
  await test('unapproved, ordinary and anonymous roles cannot save per-attempt records',async()=>{
    for(const id of [ordinary,unapproved]){await as(db,id);await assert.rejects(rpc(db,'shootout',attempts([],[])),/approved referee/);}
    await owner();await db.query('set session authorization anon');await assert.rejects(rpc(db,'shootout',attempts([],[])),/permission denied/);await as();
  });
  await test('running and grouped matches retain existing shootout eligibility guards',async()=>{
    await assert.rejects(rpc(db,'shootout',attempts([],[]),randomUUID(),running),/pause the match/);
    await assert.rejects(rpc(db,'shootout',attempts([],[]),randomUUID(),group),/tied placement/);
  });
  await test('paused in-progress shootout permits one empty side and equal 0:0 totals',async()=>{
    const before=await read();const op=randomUUID(),payload=attempts([false],[],before.match),r=await rpc(db,'shootout',payload,op);
    assert.deepEqual(r.match.home_shootout_attempts,[false]);assert.deepEqual(r.match.away_shootout_attempts,[]);assert.equal(r.match.home_shootout_score,0);assert.equal(r.match.away_shootout_score,0);
    assert.equal(r.match.status,'live');assert.equal(r.match.is_running,false);assert.ok(r.serverRevision>before.serverRevision);
    const replay=await rpc(db,'shootout',payload,op);assert.equal(replay.serverRevision,r.serverRevision);
  });
  await test('true/false order and asymmetric kicks are saved with derived equal totals',async()=>{
    const r=await update([true,false], [true]);assert.deepEqual(r.match.home_shootout_attempts,[true,false]);assert.deepEqual(r.match.away_shootout_attempts,[true]);assert.equal(r.match.home_shootout_score,1);assert.equal(r.match.away_shootout_score,1);
    assert.equal(r.match.home_score,0);assert.equal(r.match.away_score,0);assert.equal(r.events.length,0);
  });
  await test('arrays reject missing side, non-booleans, null slots, nested values, oversized lists and inconsistent totals',async()=>{
    const current=(await read()).match,valid=attempts([true],[false],current);
    for(const changes of [{homeAttempts:[],awayAttempts:[],homeScore:0,awayScore:0},{homeAttempts:undefined},{awayAttempts:undefined},{homeAttempts:null},{homeAttempts:{}},{homeAttempts:[null]},{homeAttempts:['true']},{homeAttempts:[1]},{homeAttempts:[[true]]},{homeAttempts:Array(100).fill(false)},{homeScore:0},{awayScore:1}])await assert.rejects(rpc(db,'shootout',{...valid,...changes}),/boolean arrays|goal\/no-goal|match recorded|at least one/,JSON.stringify(changes));
    assert.deepEqual((await read()).match.home_shootout_attempts,current.home_shootout_attempts);
  });
  await test('missing or stale prior arrays reject without changing totals, order or revision',async()=>{
    const current=(await read()),valid=attempts([false,true],[true],current.match);
    for(const key of ['_shootoutHomeAttemptsBefore','_shootoutAwayAttemptsBefore']){const payload={...valid};delete payload[key];await assert.rejects(rpc(db,'shootout',payload),/previous scores required/);}
    for(const changes of [{_shootoutHomeAttemptsBefore:null},{_shootoutAwayAttemptsBefore:[]},{_shootoutHomeAttemptsBefore:[false,true]}])await assert.rejects(rpc(db,'shootout',{...valid,...changes}),/result changed/);
    assert.equal((await read()).serverRevision,current.serverRevision);
  });
  await test('same total with changed order uses exact array CAS across two approved devices',async()=>{
    const current=(await read()).match;
    const updates=await Promise.allSettled([rpc(db,'shootout',attempts([false,true],[true],current)),rpc(other,'shootout',attempts([true,false,false],[true],current))]);
    assert.equal(updates.filter(r=>r.status==='fulfilled').length,1);assert.match(updates.find(r=>r.status==='rejected').reason.message,/result changed/);
    const latest=await read(other);assert.equal(latest.match.home_shootout_score,1);assert.equal(latest.match.away_shootout_score,1);
  });
  await test('response-loss retry applies an array update once and conflicting UUID payload rejects',async()=>{
    const current=await read(),payload=attempts([true,false,true],[false,true],current.match),op=randomUUID();const r=await rpc(db,'shootout',payload,op);
    const replay=await rpc(db,'shootout',payload,op);assert.equal(replay.serverRevision,r.serverRevision);assert.deepEqual(replay.match.home_shootout_attempts,payload.homeAttempts);
    await assert.rejects(rpc(db,'shootout',{...payload,homeAttempts:[true,true,false]},op),/ID conflict/);
    await owner();assert.equal((await db.query('select count(*)::int n from match_recording_receipts where operation_id=$1',[op])).rows[0].n,1);await as();
  });
  await test('new legacy totals-only commands cannot overwrite recorded attempts',async()=>{
    const before=await read();await assert.rejects(rpc(db,'shootout',totals(3,2,before.match.home_shootout_score,before.match.away_shootout_score)),/result changed/);
    assert.equal((await read()).serverRevision,before.serverRevision);assert.deepEqual((await read()).match.home_shootout_attempts,before.match.home_shootout_attempts);
  });
  await test('already-applied legacy operation replays after later array recording without overwriting it',async()=>{
    const op=randomUUID(),payload=totals(5,3,4,3);await rpc(db,'shootout',payload,op,legacy);
    const r=await update([true,true,true,true,true,false],[false,true,true,true],legacy);
    const replay=await rpc(db,'shootout',payload,op,legacy);assert.equal(replay.serverRevision,r.serverRevision);assert.deepEqual(replay.match.home_shootout_attempts,r.match.home_shootout_attempts);
  });
  await test('equal in-progress totals cannot end; final winner records regulation statistics once',async()=>{
    for(const [player,team] of [[playerHome,home],[playerAway,away]])await rpc(db,'event',{type:'goal',playerId:player,playerName:'합성 선수',teamId:team,minute:2,half:1});
    await update([true,false],[false,true]);await assert.rejects(rpc(db,'end'),/승부차기 결과/);assert.equal((await read()).match.status,'live');
    await update([true,false,true],[false,true,false]);const op=randomUUID();const r=await rpc(db,'end',{},op);await rpc(db,'end',{},op);
    assert.equal(r.match.status,'finished');assert.equal(r.match.stats_applied,true);assert.equal(r.match.home_score,1);assert.equal(r.match.away_score,1);assert.equal(r.events.length,2);
    await owner();const players=(await db.query('select games,goals from profiles where id=any($1::uuid[]) order by id',[[playerHome,playerAway]])).rows;assert.deepEqual(players,[{games:1,goals:1},{games:1,goals:1}]);
    for(const {season_stats:s} of (await db.query('select season_stats from teams where id=any($1::uuid[])',[[home,away]])).rows){assert.equal(s.draws,1);assert.equal(s.goalsFor,1);assert.equal(s.goalsAgainst,1);}await as();
  });
  await test('finished match cannot lose its winner to equal attempt totals',async()=>{
    const before=await read();await assert.rejects(rpc(db,'shootout',attempts([true],[true],before.match)),/determine a winner/);assert.equal((await read()).serverRevision,before.serverRevision);
  });
  await test('finished correction preserves player/team statistics, regulation events and clock',async()=>{
    await owner();const before=(await db.query('select (select jsonb_agg(to_jsonb(p) order by id) from profiles p) profiles,(select jsonb_agg(to_jsonb(t) order by id) from teams t) teams')).rows[0];await as();const matchBefore=await read();
    const r=await update([false,true,false],[true,false,true]);assert.equal(r.match.status,'finished');assert.equal(r.match.home_shootout_score,1);assert.equal(r.match.away_shootout_score,2);assert.deepEqual(r.events,matchBefore.events);assert.equal(r.match.elapsed_seconds,matchBefore.match.elapsed_seconds);
    await owner();assert.deepEqual((await db.query('select (select jsonb_agg(to_jsonb(p) order by id) from profiles p) profiles,(select jsonb_agg(to_jsonb(t) order by id) from teams t) teams')).rows[0],before);await as();
  });
  await test('99 attempts per side allow the existing maximum and reject a hundredth kick',async()=>{
    const r=await update(Array(99).fill(true),[...Array(98).fill(true),false],maximum);assert.equal(r.match.home_shootout_score,99);assert.equal(r.match.away_shootout_score,98);
    await assert.rejects(rpc(db,'shootout',attempts(Array(100).fill(false),[],r.match),randomUUID(),maximum),/at most 99/);
  });
  await test('table constraints reject partial, non-boolean, mismatched and finished equal histories',async()=>{
    await owner();
    const query='update matches set home_shootout_attempts=$1::jsonb,away_shootout_attempts=$2::jsonb,home_shootout_score=$3,away_shootout_score=$4 where id=$5';
    for(const [h,a,hs,ascore] of [[[],[],0,0],[null,[],0,0],[[null],[],0,0],[['true'],[],0,0],[[[true]],[],1,0],[{},[],0,0],[[true],[],0,0],[[],[],null,null],[Array(100).fill(false),[],0,0],[[true],[true],1,1]])await assert.rejects(db.query(query,[h===null?null:JSON.stringify(h),JSON.stringify(a),hs,ascore,match]),/matches_shootout_.*_check/,JSON.stringify([h,a,hs,ascore]));
    await as();assert.equal((await read()).match.status,'finished');
  });
}finally{await owner();await db.end();if(other)await other.end();}
