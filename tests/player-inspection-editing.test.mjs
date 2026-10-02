import assert from 'node:assert/strict';
import test from 'node:test';
import { moduleLoader } from './helpers/load-ts-module.mjs';

const { normalizeInspectionBirthDate: normalize } = moduleLoader()('src/features/player-inspection/birth-date.ts');
const today = new Date('2026-10-01T15:00:00Z');
test('birth dates accept numeric typing, leap days and the Korean calendar date', () => {
  assert.equal(normalize(' 19900101 ', today), '1990-01-01');
  assert.equal(normalize('2000-02-29', today), '2000-02-29');
  assert.equal(normalize('20261002', today), '2026-10-02');
  for (const input of ['', '900101', '1990/01/01', '19000229', '20260230', '20261301', '18991231', '20261003']) {
    assert.throws(() => normalize(input, today), /입력/);
  }
});

const player = { player_id:'player', team_id:'team', birth_date:null };
function fixture({ current = player, saved = {data:{id:'player'},error:null} } = {}) {
  const writes=[]; let signals=0;
  const query={};
  for(const method of ['update','eq','in','select','single']) query[method]=(...args)=>{writes.push([method,...args]);return query;};
  query.abortSignal=()=>query;
  query.then=(resolve,reject)=>Promise.resolve(saved).then(resolve,reject);
  const load=moduleLoader({
    '@/config/supabase':{supabase:{from:table=>{writes.push(['from',table]);return query;}}},
    '@/lib/inspection-sync':{notifyInspectionChange:()=>signals++},
    './api':{fetchInspectionPlayers:async()=>current?[current]:[]},
  });
  return {api:load('src/features/player-inspection/birth-date-api.ts'),writes,signals:()=>signals};
}
test('birth-date saves update only one roster member and acknowledge the affected row', async () => {
  const f=fixture();await f.api.saveInspectionBirthDate('event',player,'20000102');
  assert.deepEqual(f.writes,[['from','profiles'],['update',{birth_date:'2000-01-02'}],['eq','id','player'],['eq','team_id','team'],['in','role',['player','captain']],['select','id'],['single']]);
  assert.equal(f.signals(),1);
});
test('missing players, team changes, stale DOBs and invalid input never write', async () => {
  for(const current of [null,{...player,team_id:'other'},{...player,birth_date:'2001-02-03'}]) {
    const f=fixture({current});await assert.rejects(f.api.saveInspectionBirthDate('event',player,'20000102'));
    assert.equal(f.writes.length,0);assert.equal(f.signals(),0);
  }
  const f=fixture();await assert.rejects(f.api.saveInspectionBirthDate('event',player,'20010230'));assert.equal(f.writes.length,0);
});
test('denied, missing or unacknowledged writes fail without retry or refresh broadcasts', async () => {
  for(const saved of [{data:null,error:{message:'denied'}},{data:null,error:null},{data:{id:'wrong'},error:null}]) {
    const f=fixture({saved});await assert.rejects(f.api.saveInspectionBirthDate('event',player,'20000102'));
    assert.equal(f.writes.filter(([method])=>method==='update').length,1);assert.equal(f.signals(),0);
  }
});

test('broadcast carries no personal data, shares a subscription and ignores untrusted payloads', async () => {
  const before=global.window;global.window={};
  const sent=[];const removed=[];let onMessage,onStatus,channels=0,received=0;
  const channel={on:(_type,_filter,callback)=>{onMessage=callback;return channel;},subscribe:callback=>{onStatus=callback;return channel;},httpSend:async(...args)=>{sent.push(args);return {success:true};}};
  const sync=moduleLoader({'@/config/supabase':{isDemoMode:false,supabase:{channel:()=>{channels++;return channel;},removeChannel:async c=>removed.push(c)}}})('src/lib/inspection-sync.ts');
  try {
    const off1=sync.subscribeInspectionChanges({refresh:()=>received++,connection:()=>{}});
    const off2=sync.subscribeInspectionChanges({refresh:()=>received++,connection:()=>{}});
    assert.equal(channels,1);onStatus('SUBSCRIBED');received=0;
    onMessage({payload:{birth_date:'malicious',checked_at:'fake'}});assert.equal(received,2);
    sync.notifyInspectionChange();await Promise.resolve();assert.deepEqual(sent,[['refresh',{}, {timeout:2000}]]);
    off1();assert.equal(removed.length,0);off2();assert.equal(removed.length,1);
    onMessage({});assert.equal(received,2);
  } finally {global.window=before;}
});

test('visible pages poll every five seconds, coalesce signals, preserve in-flight invalidation and clean up', async t => {
  t.mock.timers.enable({apis:['setTimeout','setInterval']});
  const beforeWindow=global.window,beforeDocument=global.document;
  global.window=new EventTarget();global.document=Object.assign(new EventTarget(),{visibilityState:'visible'});
  let effect,listener,unsubscribed=false,resolveRead;const reads=[];
  const react={useState:value=>[value,()=>{}],useRef:value=>({current:value}),useCallback:fn=>fn,useEffect:fn=>{effect=fn;}};
  const hook=moduleLoader({react,'@/lib/inspection-sync':{subscribeInspectionChanges:value=>{listener=value;return()=>{unsubscribed=true;};}}})('src/features/player-inspection/use-inspection-query.ts');
  try {
    hook.useInspectionQuery(signal=>{reads.push(signal);return new Promise(resolve=>{resolveRead=resolve;});},true);
    const cleanup=effect();assert.equal(reads.length,1);
    listener.refresh();listener.refresh();t.mock.timers.tick(500);assert.equal(reads.length,1);
    resolveRead([]);await Promise.resolve();t.mock.timers.tick(250);assert.equal(reads.length,2);
    resolveRead([]);await Promise.resolve();t.mock.timers.tick(4250);assert.equal(reads.length,3);
    resolveRead([]);await Promise.resolve();document.visibilityState='hidden';t.mock.timers.tick(5000);assert.equal(reads.length,3);
    document.visibilityState='visible';document.dispatchEvent(new Event('visibilitychange'));assert.equal(reads.length,4);
    cleanup();assert.equal(reads[3].aborted,true);assert.equal(unsubscribed,true);
    t.mock.timers.tick(10000);window.dispatchEvent(new Event('focus'));assert.equal(reads.length,4);
  } finally {global.window=beforeWindow;global.document=beforeDocument;}
});
