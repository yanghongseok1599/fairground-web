import assert from 'node:assert/strict';
import test from 'node:test';
import {moduleLoader} from './helpers/load-ts-module.mjs';

const load=moduleLoader();
const {createRecordingOutbox}=load('src/features/match-review/outbox.ts');
const {parseJerseyNumber,jerseyNumberFromRow,jerseyNumberToRow,jerseySortOrder}=load('src/lib/jersey-number.ts');
const {hasCompletedPlayerCardSetup}=load('src/lib/player-onboarding.ts');
const {rowToPublicPlayer,playerPatchToRow}=load('src/lib/mappers.ts');
const {recordingDuty,uncheckedGoals}=load('src/features/match-review/policy.ts');
const storage=()=>{
  const data=new Map();
  return {get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
};
const input={type:'goal',playerId:'player',playerName:'선수',teamId:'team',minute:3,half:1};

test('failed writes survive reload and repeat the same request ID, actor and original minute',async()=>{
  const s=storage(),q=createRecordingOutbox(s,'referee','match');
  const event=q.stage(input);
  await assert.rejects(q.send(event,async()=>{throw Error('response lost');}));
  const afterReload=createRecordingOutbox(s,'referee','match');
  assert.deepEqual(afterReload.list(),[event]);
  assert.equal(event.actorId,'referee');
  await afterReload.send(afterReload.list()[0],async replay=>assert.deepEqual(replay,event));
  assert.deepEqual(afterReload.list(),[]);
});
test('accounts, matches and two tabs do not overwrite one another’s pending inputs',()=>{
  const s=storage(),a=createRecordingOutbox(s,'ref1','m'),b=createRecordingOutbox(s,'ref1','m');
  a.stage(input);b.stage({...input,type:'foul'});assert.equal(a.list().length,2);
  assert.equal(createRecordingOutbox(s,'ref2','m').list().length,0);
  assert.equal(createRecordingOutbox(s,'ref1','other-match').list().length,0);
});
test('local storage failure blocks acceptance and corrupt input remains available for recovery',()=>{
  const s=storage(),q=createRecordingOutbox(s,'r','m');
  s.setItem=()=>{throw Error('quota');};assert.throws(()=>q.stage(input),/quota/);assert.equal(q.list().length,0);
  const s2=storage(),q2=createRecordingOutbox(s2,'r','m');const e=q2.stage(input);s2.setItem('fg-recording-v1:r:m:'+e.requestId,'{broken');
  assert.throws(()=>q2.list());assert.equal(s2.length,1);
});
test('a failed receipt cleanup can be retried without replacing its request ID',async()=>{
  const s=storage(),q=createRecordingOutbox(s,'r','m'),e=q.stage(input);s.removeItem=()=>{throw Error('blocked');};
  await assert.rejects(q.send(e,async()=>{}),/blocked/);assert.equal(q.list()[0].requestId,e.requestId);
});
test('duties and goal-specific assist checks are independent of aggregate counts',()=>{
  const m={primaryRefereeId:'r1',assistantRefereeId:'r2'};
  assert.equal(recordingDuty(m,'r1',false),'primary');assert.equal(recordingDuty(m,'r2',false),'assistant');assert.equal(recordingDuty(m,'admin',true),'admin');
  assert.deepEqual(uncheckedGoals([{id:'g1',type:'goal',assistChecked:true},{id:'g2',type:'goal'},{id:'a',type:'assist',goalEventId:'g1'}]).map(e=>e.id),['g2']);
});
test('0 and 00 retain distinct display values through profile save and read',()=>{
  for(const [value,expected] of [['0',0],['00','00'],['1',1],['99',99]]){
    assert.equal(parseJerseyNumber(value),expected);
    const row=playerPatchToRow({number:expected});assert.deepEqual(row,jerseyNumberToRow(expected));assert.equal(jerseyNumberFromRow(row),expected);
    assert.equal(rowToPublicPlayer({...row,id:'p',name:'선수',created_at:'2026-01-01'}).number,expected);
  }
  for(const invalid of ['','000','01','100','-1','1.5','1e1',' 0','가'])assert.equal(parseJerseyNumber(invalid),null);
});
test('an unset legacy zero is not a completed card; an explicitly registered zero is',()=>{
  const base={name:'선수',position:'ALA',portraitConsentAt:1000};
  assert.equal(hasCompletedPlayerCardSetup({...base,number:0}),false);
  assert.equal(hasCompletedPlayerCardSetup({...base,number:0,jerseyNumberAssigned:true}),true);
  assert.equal(hasCompletedPlayerCardSetup({...base,number:'00'}),true);
  assert.equal(hasCompletedPlayerCardSetup({...base,number:'00',portraitConsentAt:undefined}),false);
});

test('valid 0 / 00 sort before 1, while legacy unset zero stays last',()=>{
  const players=[{number:0},{number:1},{number:'00'},{number:0,jerseyNumberAssigned:true}];
  players.sort((a,b)=>jerseySortOrder(a)-jerseySortOrder(b));
  assert.equal(players.at(-1).jerseyNumberAssigned,undefined);assert.equal(players.at(-1).number,0);
  assert.ok(players.slice(0,2).every(p=>Number(p.number)===0));
});
