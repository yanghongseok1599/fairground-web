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

const { reconcileSnapshot } = await import('../src/features/match-recording/model.ts');
await test('remote records merge while own offline commands stay pending',()=>{
 const r=room();r.base.status='live';r.base.serverRevision=1;r.pending=[command('local','event',goal)];
 const incoming=projectRoom({...r,pending:[command('remote','event',goal)]});incoming.serverRevision=2;incoming.appliedOperationIds=[];
 const merged=reconcileSnapshot(r,incoming);assert.equal(merged.pending.length,1);assert.equal(projectRoom(merged).homeScore,2);
});
await test('realtime acknowledgement before HTTP response never doubles a score or drops a new command',async()=>{
 let r=room();r.base.status='live';r.base.serverRevision=1;r.pending=[command('one','event',goal)];
 await flushRoom(r,{currentActor:()=> 'actor',update:async(_k,change)=>r=change(r),send:async(_m,c)=>{
   const incoming=projectRoom({...r,pending:[c]});incoming.serverRevision=(r.base.serverRevision??0)+1;incoming.appliedOperationIds=[...(r.base.appliedOperationIds??[]),c.id];
   r=reconcileSnapshot(r,incoming);if(c.id==='one')r.pending.push(command('two','event',goal));return incoming;
 }});assert.equal(r.pending.length,0);assert.equal(r.base.homeScore,2);
});
await test('late older snapshot cannot roll back newer remote score',()=>{
 const r=room();r.base.serverRevision=4;r.base.homeScore=3;const old={...r.base,serverRevision:3,homeScore:2};assert.equal(reconcileSnapshot(r,old).base.homeScore,3);
});
await test('timer from a previous clock owner never overlays a shared snapshot',()=>{
 const r=room();r.base.status='live';r.base.elapsedSeconds=40;r.base.clock={version:3,ownerId:'other',deviceId:'B',ownerName:'다른 심판'};
 r.pending=[command('late','timer',{_clockVersion:1,_deviceId:'A',seconds:500,half:1})];assert.equal(projectRoom(r).elapsedSeconds,40);
});
await test('response error after realtime acknowledgement cannot block the remaining queue',async()=>{
 let r=room();r.pending=[command('start','start')];await flushRoom(r,{currentActor:()=> 'actor',update:async(_k,change)=>r=change(r),send:async()=>{r={...r,pending:[]};throw {code:'22023'};}});assert.notEqual(r.blocked,true);
});

await test('cancelling a synced second yellow clears its automatic red offline but preserves a direct red',()=>{
 const r=room();r.base.status='live';
 const event={playerId:'player',playerName:'선수',teamId:'home',minute:3,half:1 as const,timestamp:100};
 r.base.events=[
  {...event,id:'yellow-one',type:'yellow_card'},
  {...event,id:'local:yellow-two',type:'yellow_card'},
  {...event,id:'server-auto-red',type:'red_card',sourceYellowEventId:'local:yellow-two'},
  {...event,id:'direct-red',type:'red_card'},
 ];
 r.pending=[command('cancel-yellow','cancel',{eventOperationId:'yellow-two'})];
 const projected=projectRoom(JSON.parse(JSON.stringify(r)));
 assert.equal(projected.events.find(e=>e.id==='local:yellow-two')?.isCancelled,true);
 assert.equal(projected.events.find(e=>e.id==='server-auto-red')?.isCancelled,true);
 assert.notEqual(projected.events.find(e=>e.id==='direct-red')?.isCancelled,true);
 assert.notEqual(r.base.events[2].isCancelled,true);
});

await test('unsent yellow and cancellation keep the automatic red linked and cancelled after refresh',()=>{
 const r=room();r.base.status='live';
 r.pending=[command('yellow-one','event',{...goal,type:'yellow_card'}),command('yellow-two','event',{...goal,type:'yellow_card'}),command('cancel-yellow','cancel',{eventOperationId:'yellow-two'})];
 const projected=projectRoom(JSON.parse(JSON.stringify(r)));
 assert.equal(projected.events.find(e=>e.id==='auto:yellow-two')?.sourceYellowEventId,'local:yellow-two');
 assert.equal(projected.events.find(e=>e.id==='auto:yellow-two')?.isCancelled,true);
});

await test('goal and assist corrections are separate, repeated cancel never subtracts twice',()=>{
 const r=room();r.base.status='live';
 r.pending=[command('goal','event',goal),command('assist','event',{...goal,type:'assist',playerId:'teammate'}),command('cancel-goal','cancel',{eventOperationId:'goal'}),command('cancel-goal-again','cancel',{eventOperationId:'goal'})];
 const projected=projectRoom(r);assert.equal(projected.homeScore,0);assert.notEqual(projected.events[1].isCancelled,true);
 r.pending.push(command('cancel-assist','cancel',{eventOperationId:'assist'}));
 assert.equal(projectRoom(r).events[1].isCancelled,true);
});
