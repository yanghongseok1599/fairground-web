import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import pg from 'pg';

const url=process.env.FAIRGROUND_TEST_DB_URL;
if(!url || !['127.0.0.1','localhost','[::1]'].includes(new URL(url).hostname)) throw Error('A disposable LOCAL restored schema with the three pending migrations is required.');
async function fixture(t,{start=true}={}){
  const owner=new pg.Client({connectionString:url});await owner.connect();t.after(()=>owner.end());
  const ids=Array.from({length:11},()=>randomUUID());
  const [admin,primary,assistant,home,away,tournament,match,...players]=ids;
  for(const [i,id] of [admin,primary,assistant,...players].entries())await owner.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)',[id,`${id}@synthetic.invalid`,{name:`합성 선수 ${i}`,portrait_consent:true}]);
  await owner.query("begin; select set_config('app.in_end_match','1',true)");
  await owner.query("update profiles set role='admin',is_approved=true where id=$1",[admin]);
  await owner.query("update profiles set role='referee',is_approved=true where id=any($1)",[[primary,assistant]]);await owner.query('commit');
  await owner.query("select set_config('request.jwt.claim.sub',$1,false)",[admin]);
  for(const [id,name] of [[home,'검수 블루'],[away,'검수 레드']])await owner.query('insert into teams(id,name,is_approved,captain_id,portrait_consent_at) values($1,$2,true,$3,now())',[id,`${name} ${id}`,admin]);
  for(const [i,id] of players.entries())await owner.query('update profiles set team_id=$2,number=$3,is_approved=true where id=$1',[id,i<2?home:away,i+1]);
  await owner.query("insert into tournaments(id,name) values($1,'공동 기록 합성 검수')",[tournament]);
  await owner.query("insert into matches(id,tournament_id,home_team_id,away_team_id,home_team_name,away_team_name) values($1,$2,$3,$4,'검수 블루','검수 레드')",[match,tournament,home,away]);
  for(const [i,id] of players.entries())await owner.query('insert into match_lineups(match_id,team_id,player_id,is_starter) values($1,$2,$3,true)',[match,i<2?home:away,id]);
  const connect=async actor=>{const db=new pg.Client({connectionString:url});await db.connect();t.after(()=>db.end());await db.query('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[actor]);return db;};
  const a=await connect(admin),r=await connect(primary),s=await connect(assistant);
  await r.query("select claim_match_recording_role($1,'primary')",[match]);await s.query("select claim_match_recording_role($1,'assistant')",[match]);if(start)await r.query('select start_match($1)',[match]);
  const record=async(db,type,index=0,goal=null,request=randomUUID(),actor=null)=>{
    const result=await db.query('select record_match_event($1,$2,$3,$4,$5,$6,$7,1,$8,$9) id',[match,request,type,players[index],`합성 ${index}`,index<2?home:away,6,goal,actor]);return result.rows[0].id;
  };
  const row=async()=> (await owner.query('select * from matches where id=$1',[match])).rows[0];
  const finish=async(mom=players[0])=>{await a.query('select pause_match($1)',[match]);const rev=(await row()).recording_revision;return a.query('select confirm_match_recording($1,$2,$3)',[match,rev,mom]);};
  return {owner,a,r,s,admin,primary,assistant,home,away,match,players,record,row,finish};
}

test('주심 입력 → 부심 골 연결 → 관리자 확정 및 랭킹 반영',async t=>{
  const f=await fixture(t);const goal=await f.record(f.r,'goal');const assist=await f.record(f.s,'assist',1,goal);
  const events=(await f.owner.query('select * from match_events where match_id=$1',[f.match])).rows;
  assert.equal(events.find(e=>e.id===goal).recorded_by,f.primary);assert.equal(events.find(e=>e.id===assist).recorded_by,f.assistant);
  assert.equal(events.find(e=>e.id===assist).goal_event_id,goal);assert.equal(events.find(e=>e.id===goal).assist_checked,true);
  assert.equal((await f.owner.query('select goals from profiles where id=$1',[f.players[0]])).rows[0].goals,0);
  await f.finish();const done=await f.row();assert.equal(done.status,'finished');assert.equal(done.confirmed_by,f.admin);
  assert.equal((await f.owner.query('select goals,mom,games from profiles where id=$1',[f.players[0]])).rows[0].goals,1);
  assert.equal((await f.owner.query('select assists from profiles where id=$1',[f.players[1]])).rows[0].assists,1);
  assert.equal((await f.owner.query('select season_stats from teams where id=$1',[f.home])).rows[0].season_stats.points,3);
  await f.a.query('select confirm_match_recording($1,$2,$3)',[f.match,done.recording_revision,f.players[0]]);
  assert.equal((await f.owner.query('select games from profiles where id=$1',[f.players[0]])).rows[0].games,1);
  assert.equal((await f.owner.query("select count(*)::int n from match_recording_audit where match_id=$1 and action='confirm'",[f.match])).rows[0].n,1);
});
test('역할 침범·직접 REST 쓰기·기존 종료 RPC 우회 차단',async t=>{
  const f=await fixture(t);const g=await f.record(f.r,'goal');
  await assert.rejects(f.record(f.s,'goal'),/담당자/);await assert.rejects(f.record(f.r,'assist',1,g),/담당자/);
  await assert.rejects(f.r.query('select cancel_match_event($1,$2)',[f.match,g]),/담당자/);
  await assert.rejects(f.r.query('select end_match($1)',[f.match]),/permission denied/);
  await assert.rejects(f.r.query('select confirm_match_recording($1,0)',[f.match]),/담당자/);
  await assert.rejects(f.s.query('select forfeit_match($1,$2)',[f.match,f.home]),/담당자/);
  assert.equal((await f.r.query("update matches set status='finished',stats_applied=true where id=$1 returning id",[f.match])).rowCount,0);
  assert.equal((await f.a.query('delete from match_events where id=$1 returning id',[g])).rowCount,0);
});
test('응답 유실 후 같은 요청 재전송은 확정 후에도 한 번만 기록',async t=>{
  const f=await fixture(t),request=randomUUID();const g=await f.record(f.r,'goal',0,null,request,f.primary);
  assert.equal(await f.record(f.r,'goal',0,null,request,f.primary),g);assert.equal((await f.row()).home_score,1);
  await assert.rejects(f.record(f.r,'goal',1,null,request,f.primary),/내용이 다릅니다/);
  await assert.rejects(f.record(f.s,'goal',0,null,request,f.primary),/입력한 계정/);
  await f.s.query('select check_goal_without_assist($1,$2)',[f.match,g]);await f.finish();
  assert.equal(await f.record(f.r,'goal',0,null,request,f.primary),g);
  await assert.rejects(f.record(f.r,'goal'),/not editable/);assert.equal((await f.row()).home_score,1);
});
test('같은 골의 중복 어시스트·상대팀·자기 어시스트 차단',async t=>{
  const f=await fixture(t),g=await f.record(f.r,'goal');
  await assert.rejects(f.record(f.s,'assist',0,g),/다른 어시스트/);await assert.rejects(f.record(f.s,'assist',2,g),/다른 어시스트/);
  const results=await Promise.allSettled([f.record(f.s,'assist',1,g),f.record(f.a,'assist',1,g)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal((await f.owner.query("select count(*)::int n from match_events where match_id=$1 and type='assist' and not is_cancelled",[f.match])).rows[0].n,1);
});
test('관리자 취소는 골과 연결된 어시스트를 함께 취소하며 원본을 보존',async t=>{
  const f=await fixture(t),g=await f.record(f.r,'goal');await f.record(f.s,'assist',1,g);
  await f.a.query('select cancel_match_event($1,$2)',[f.match,g]);
  const events=(await f.owner.query('select is_cancelled,cancelled_by from match_events where match_id=$1',[f.match])).rows;
  assert.equal(events.length,2);assert.ok(events.every(e=>e.is_cancelled && e.cancelled_by===f.admin));assert.equal((await f.row()).home_score,0);
  await f.finish(null);assert.equal((await f.owner.query('select assists from profiles where id=$1',[f.players[1]])).rows[0].assists,0);
});
test('검수 중 새 기록·미확인 어시스트·진행 중 시계는 최종 확정을 막는다',async t=>{
  const f=await fixture(t);await assert.rejects(f.a.query('select confirm_match_recording($1,0)',[f.match]),/시간을 멈춘/);
  const g=await f.record(f.r,'goal');await f.a.query('select pause_match($1)',[f.match]);const before=await f.row();
  await assert.rejects(f.a.query('select confirm_match_recording($1,$2)',[f.match,before.recording_revision]),/모든 골/);
  await f.s.query('select check_goal_without_assist($1,$2)',[f.match,g]);
  await assert.rejects(f.a.query('select confirm_match_recording($1,$2)',[f.match,before.recording_revision]),/최신 기록/);
  assert.equal((await f.row()).stats_applied,false);await f.finish();
});
test('시계 쓰기 담당은 시작·재개한 한 명이며 부심은 변경할 수 없다',async t=>{
  const f=await fixture(t);await f.r.query('select update_match_timer($1,90,1)',[f.match]);
  await assert.rejects(f.s.query('select update_match_timer($1,5,1)',[f.match]),/다른 담당자/);
  await assert.rejects(f.a.query('select update_match_timer($1,5,1)',[f.match]),/다른 담당자/);
  await f.a.query('select pause_match($1)',[f.match]);await f.a.query('select resume_match($1)',[f.match]);
  await assert.rejects(f.r.query('select update_match_timer($1,95,1)',[f.match]),/다른 담당자/);
  await f.a.query('select update_match_timer($1,95,1)',[f.match]);assert.equal((await f.row()).elapsed_seconds,95);
});
test('0·00 등번호는 DB와 공개 명단에 구분되며 기존 회원 데이터는 유지',async t=>{
  const f=await fixture(t,{start:false});
  for(const [i,label] of ['0','00'].entries())await f.owner.query('update profiles set number=0,number_label=$2 where id=$1',[f.players[i],label]);
  const rows=(await f.s.query('select id,number,number_label from public_player_profiles where id=any($1)',[f.players.slice(0,2)])).rows;
  assert.equal(rows.find(r=>r.id===f.players[0]).number_label,'0');assert.equal(rows.find(r=>r.id===f.players[1]).number_label,'00');
  await assert.rejects(f.owner.query("update profiles set number_label='000' where id=$1",[f.players[0]]),/profiles_zero_number_label/);
  assert.equal(rows.length,2);
  await f.a.query("update match_lineups set jersey_number=0,jersey_number_label='00' where match_id=$1 and player_id=$2",[f.match,f.players[1]]);
  await f.owner.query('update profiles set number=7,number_label=null where id=$1',[f.players[1]]);
  const jersey=(await f.r.query('select jersey_number,jersey_number_label from match_lineups where match_id=$1 and player_id=$2',[f.match,f.players[1]])).rows[0];
  assert.deepEqual(jersey,{jersey_number:0,jersey_number_label:'00'});
  await assert.rejects(f.a.query("update match_lineups set jersey_number=null where match_id=$1 and player_id=$2",[f.match,f.players[1]]),/lineups_zero_number_label/);
});
