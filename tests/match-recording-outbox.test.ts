import assert from 'node:assert/strict';
import test from 'node:test';
import { projectRoom } from '../src/features/match-recording/model.ts';
import { flushRoom } from '../src/features/match-recording/sync-core.ts';
import type { RecordingRoom, RecordingCommand } from '../src/features/match-recording/model.ts';
const command=(id:string,kind:RecordingCommand['kind'],payload:RecordingCommand['payload']={}):RecordingCommand=>({id,kind,payload,at:100});
const room=():RecordingRoom=>({key:'actor:match',actorId:'actor',matchId:'match',revision:1,savedAt:0,players:[],lineups:[],journal:[],pending:[],base:{id:'match',tournamentId:'tournament',round:1,homeTeamId:'home',awayTeamId:'away',homeTeamName:'홈',awayTeamName:'원정',homeScore:0,awayScore:0,status:'scheduled',scheduledAt:0,events:[],elapsedSeconds:0,currentHalf:1,isRunning:false}});
const goal={type:'goal',playerId:'player',playerName:'선수',teamId:'home',minute:3,half:1};
await test('offline projection survives JSON round-trip: start, goal, cancel, MOM, end',()=>{
 const r=room();r.pending=[command('start','start'),command('goal','event',goal),command('cancel','cancel',{eventOperationId:'goal'}),command('mom','mom',{playerId:'player'}),command('end','end')];
 const result=projectRoom(JSON.parse(JSON.stringify(r)));assert.equal(result.homeScore,0);assert.equal(result.events[0].minute,3);assert.equal(result.events[0].isCancelled,true);assert.equal(result.status,'finished');assert.equal(result.momPlayerId,'player');assert.equal(r.base.status,'scheduled');
});
await test('response loss retains original operation ID and FIFO, then retries once',async()=>{
 let r=room();r.pending=[command('start','start'),command('goal','event',goal),command('end','end')];const ids:string[]=[];let fail=true;
 const deps={currentActor:()=> 'actor',update:async(_key:string,change:(r?:RecordingRoom)=>RecordingRoom)=>r=change(r),send:async(_match:string,c:RecordingCommand)=>{ids.push(c.id);if(fail){fail=false;throw new Error('response lost');}return projectRoom({...r,pending:[c]});}};
 await flushRoom(r,deps);assert.deepEqual(ids,['start']);assert.equal(r.pending.length,3);await flushRoom(r,deps);assert.deepEqual(ids,['start','start','goal','end']);assert.equal(r.pending.length,0);assert.equal(r.base.homeScore,1);assert.equal(r.base.status,'finished');
});
await test('commands added while sending remain queued and ordered',async()=>{
 let r=room();r.pending=[command('start','start')];let first=true;
 await flushRoom(r,{currentActor:()=> 'actor',update:async(_k,change)=>r=change(r),send:async(_m,c)=>{if(first){first=false;r.pending.push(command('goal','event',goal));}return projectRoom({...r,pending:[c]});}});
 assert.equal(r.pending.length,0);assert.equal(r.base.homeScore,1);
});
await test('account change prevents any send',async()=>{const r=room();r.pending=[command('start','start')];await flushRoom(r,{currentActor:()=> 'different',update:async()=>{throw Error('must not write');},send:async()=>{throw Error('must not send');}});assert.equal(r.pending.length,1);});
await test('permission/conflict failure preserves entire queue and blocks automatic replay',async()=>{let r=room();r.pending=[command('start','start'),command('goal','event',goal)];await flushRoom(r,{currentActor:()=> 'actor',update:async(_k,change)=>r=change(r),send:async()=>{throw {code:'42501'};}});assert.equal(r.blocked,true);assert.equal(r.pending.length,2);});
await test('acknowledgement storage failure keeps ID for safe server replay',async()=>{const r=room();r.pending=[command('start','start')];await assert.rejects(flushRoom(r,{currentActor:()=> 'actor',update:async()=>{throw Error('quota');},send:async()=>projectRoom(r)}),/quota/);assert.equal(r.pending[0].id,'start');});
