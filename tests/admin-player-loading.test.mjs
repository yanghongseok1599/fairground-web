import assert from 'node:assert/strict';
import test from 'node:test';
import { moduleLoader } from './helpers/load-ts-module.mjs';

function fixture(response = { data: [], error: null }) {
  const calls = [];
  const query = {};
  for (const method of ['select', 'eq', 'maybeSingle', 'abortSignal']) {
    query[method] = (...args) => { calls.push([method, ...args]); return query; };
  }
  query.then = (resolve, reject) => Promise.resolve(response).then(resolve, reject);
  const supabase = { rpc: (...args) => { calls.push(['rpc', ...args]); return query; } };
  const api = moduleLoader({ '@/config/supabase': { supabase, isDemoMode: false } })('src/features/admin-players/api.ts');
  return { api, calls };
}
const signal = () => new AbortController().signal;

test('approval list requests only small review fields, without any photo, contact or biography payload', async () => {
  const row = {id:'p1',name:'선수',number:7,position:'ALA',role:'player',is_approved:false,has_player_experience:false,portrait_consent_at:'2026-09-20T00:00:00Z',created_at:'2026-09-01T00:00:00Z'};
  const {api,calls} = fixture({data:[row],error:null});
  const players=await api.fetchApprovalPlayers(signal());
  assert.deepEqual(calls[0],['rpc','get_admin_profiles',undefined, {get:true}]);
  assert.doesNotMatch(calls.find(x=>x[0]==='select')[1],/photo|phone|email|bio|\*/);
  assert.equal(players[0].isApproved,false);
  assert.equal(players[0].portraitConsentAt,Date.parse(row.portrait_consent_at));
  assert.equal(players[0].id,'p1');
});
test('database/permission errors do not turn into a successful empty list',async()=>{
  for(const error of [{message:'관리자 권한이 필요합니다'},{message:'network failure'}]){
    const {api}=fixture({data:null,error});
    await assert.rejects(api.fetchApprovalPlayers(signal()),new RegExp(error.message));
  }
});
test('empty list is valid; malformed responses are retryable errors',async()=>{
  assert.deepEqual(await fixture().api.fetchApprovalPlayers(signal()),[]);
  await assert.rejects(fixture({data:null,error:null}).api.fetchApprovalPlayers(signal()),/다시 시도/);
});
test('deadline ends even when a pending auth/network operation ignores AbortSignal',async()=>{
  const {api}=fixture();let received;
  await assert.rejects(api.withApprovalDeadline(s=>{received=s;return new Promise(()=>{});},signal(),10),/시간이 오래/);
  assert.equal(received.aborted,true);
});
test('cancelling during navigation aborts the underlying request and rejects late results',async()=>{
  const {api}=fixture();const controller=new AbortController();let received;let complete;
  const request=api.withApprovalDeadline(s=>{received=s;return new Promise(resolve=>{complete=resolve;});},controller.signal,100);
  controller.abort();
  await assert.rejects(request,/취소/);
  assert.equal(received.aborted,true);
  complete(['late old result']);
});
test('an already cancelled request does not begin another network read',async()=>{
  const {api}=fixture();const controller=new AbortController();controller.abort();let reads=0;
  await assert.rejects(api.withApprovalDeadline(()=>{reads++;return Promise.resolve([]);},controller.signal),/취소/);
  assert.equal(reads,0);
});
test('photo retrieval is limited to the clicked player and respects their locked profile image',async()=>{
  const {api,calls}=fixture({data:{photo_url:'card.webp',profile_photo_url:'profile.webp',profile_photo_locked:true},error:null});
  assert.equal(await api.fetchApprovalPhoto('p2',signal()),'profile.webp');
  assert.ok(calls.some(x=>x[0]==='eq'&&x[1]==='id'&&x[2]==='p2'));
  assert.ok(calls.some(x=>x[0]==='maybeSingle'));
});
test('missing photo record and failed photo queries allow explicit retry',async()=>{
  await assert.rejects(fixture({data:null,error:null}).api.fetchApprovalPhoto('missing',signal()),/찾지 못/);
  await assert.rejects(fixture({data:null,error:{message:'network failure'}}).api.fetchApprovalPhoto('p1',signal()),/network failure/);
});
