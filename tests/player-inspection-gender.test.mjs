import assert from 'node:assert/strict';
import test from 'node:test';
import { moduleLoader } from './helpers/load-ts-module.mjs';

const { normalizeInspectionGender, inspectionGenderLabel } = moduleLoader()('src/features/player-inspection/gender.ts');
test('gender preserves all registration choices and never guesses missing or legacy values', () => {
  for (const value of ['male','female','other','prefer_not_to_say']) assert.equal(normalizeInspectionGender(value),value);
  for (const value of ['', 'unknown','남성']) assert.throws(() => normalizeInspectionGender(value));
  assert.equal(inspectionGenderLabel(null),'미등록');
  assert.equal(inspectionGenderLabel('legacy'),'확인 필요');
  assert.equal(inspectionGenderLabel('prefer_not_to_say'),'응답 안 함');
});

const player={player_id:'player',team_id:'team',gender:null};
function fixture({players=[player],genders=[{id:'player',gender:null}],readError=null,saved={data:{id:'player'},error:null}}={}) {
  const calls=[];let signals=0;
  function query(kind) {
    const q={};
    for(const method of ['select','in','update','eq','single','retry']) q[method]=(...args)=>{calls.push([method,...args]);return q;};
    q.abortSignal=()=>q;
    q.then=(resolve,reject)=>Promise.resolve(kind==='read'?{data:genders,error:readError}:saved).then(resolve,reject);
    return q;
  }
  const api=moduleLoader({
    '@/config/supabase':{supabase:{rpc:(...args)=>{calls.push(['rpc',...args]);return query('read');},from:table=>{calls.push(['from',table]);return query('write');}}},
    './api':{fetchInspectionPlayers:async()=>players},
    '@/lib/inspection-sync':{notifyInspectionChange:()=>signals++},
  })('src/features/player-inspection/gender-api.ts');
  return {api,calls,signals:()=>signals};
}
test('only scoped IDs and gender are read; empty rosters do not query private profiles',async()=>{
  const f=fixture();assert.deepEqual(await f.api.fetchInspectionPlayersWithGender('event',new AbortController().signal),[player]);
  assert.deepEqual(f.calls,[['rpc','get_admin_profiles',undefined,{get:true}],['select','id,gender'],['in','id',['player']],['retry',false]]);
  const empty=fixture({players:[]});assert.deepEqual(await empty.api.fetchInspectionPlayersWithGender('event',new AbortController().signal),[]);assert.equal(empty.calls.length,0);
});
test('missing private rows and denied reads are errors, not a blank gender',async()=>{
  for(const options of [{genders:[]},{genders:null},{readError:{message:'denied'}}]) {
    await assert.rejects(fixture(options).api.fetchInspectionPlayersWithGender('event',new AbortController().signal));
  }
});
test('gender saves only the selected roster member and broadcasts only after acknowledgement',async()=>{
  const f=fixture();await f.api.saveInspectionGender('event',player,'female');
  assert.deepEqual(f.calls.slice(4),[['from','profiles'],['update',{gender:'female'}],['eq','id','player'],['eq','team_id','team'],['in','role',['player','captain']],['select','id'],['single']]);
  assert.equal(f.signals(),1);
});
test('invalid selections, moved members and stale drafts cannot write',async()=>{
  for(const options of [{players:[]},{players:[{...player,team_id:'other'}]},{genders:[{id:'player',gender:'male'}]}]) {
    const f=fixture(options);await assert.rejects(f.api.saveInspectionGender('event',player,'female'));
    assert.equal(f.calls.some(([m])=>m==='update'),false);assert.equal(f.signals(),0);
  }
  const f=fixture();await assert.rejects(f.api.saveInspectionGender('event',player,''));assert.equal(f.calls.length,0);
});
test('failed or unacknowledged writes never retry or signal success',async()=>{
  for(const saved of [{data:null,error:{message:'denied'}},{data:null,error:null},{data:{id:'wrong'},error:null}]) {
    const f=fixture({saved});await assert.rejects(f.api.saveInspectionGender('event',player,'male'));
    assert.equal(f.calls.filter(([m])=>m==='update').length,1);assert.equal(f.signals(),0);
  }
});
