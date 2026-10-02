import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { moduleLoader } from './helpers/load-ts-module.mjs';

function fixture(responses) {
  const calls = [];
  const makeQuery = (source) => {
    const call = { source, steps: [] }; calls.push(call);
    const chain = {};
    for (const method of ['select','eq','abortSignal']) chain[method] = (...args) => { call.steps.push([method,...args]); return chain; };
    chain.then = (resolve, reject) => Promise.resolve(responses.shift()).then(resolve, reject);
    return chain;
  };
  const api = moduleLoader({ '@/config/supabase': { isDemoMode: false, supabase: {
    rpc: name => makeQuery(name), from: name => makeQuery(name),
  } } })('src/features/admin-directory/api.ts');
  return { api, calls };
}
const signal = () => new AbortController().signal;
const ok = data => ({ data, error: null });

test('referees use a server-side role filter and small projection, with pending first', async () => {
  const {api,calls}=fixture([ok([
    {id:'active',name:'심판',role:'referee',is_approved:true,created_at:'2026-01-01'},
    {id:'pending',name:'심판',role:'referee',is_approved:false,created_at:'2025-01-01'},
  ])]);
  const result=await api.fetchRefereeSummaries(signal());
  assert.deepEqual(result.map(p=>p.id),['pending','active']);
  assert.ok(calls[0].steps.some(s=>s[0]==='eq' && s[1]==='role' && s[2]==='referee'));
  assert.doesNotMatch(calls[0].steps.find(s=>s[0]==='select')[1],/photo|\*|bio/);
});
test('penalties map remaining bans and sort banned players first without photos or contact data', async () => {
  const {api,calls}=fixture([ok([
    {id:'normal',name:'가',position:'ALA',is_banned:false,ban_matches_remaining:0,season_yellow_cards:1},
    {id:'banned',name:'나',position:'PIVO',is_banned:true,ban_matches_remaining:2,season_yellow_cards:2},
  ])]);
  const result=await api.fetchPenaltySummaries(signal());
  assert.equal(result[0].id,'banned'); assert.equal(result[0].penaltyStatus.banMatchesRemaining,2);
  assert.doesNotMatch(calls[0].steps.find(s=>s[0]==='select')[1],/photo|phone|email|\*/);
});
test('coach queue filters both pending approval and team role at the server', async () => {
  const {api,calls}=fixture([ok([])]); assert.deepEqual(await api.fetchCoachSummaries(signal()),[]);
  assert.ok(calls[0].steps.some(s=>s[0]==='eq'&&s[1]==='team_role'&&s[2]==='coach'));
  assert.ok(calls[0].steps.some(s=>s[0]==='eq'&&s[1]==='is_approved'&&s[2]===false));
  assert.doesNotMatch(calls[0].steps.find(s=>s[0]==='select')[1],/photo|\*/);
});
test('push directory reads names and IDs only, joining team labels without full team/profile reads', async () => {
  const {api,calls}=fixture([ok([{id:'t',name:'팀'}]),ok([{id:'p',name:'선수',team_id:'t'}])]);
  const result=await api.fetchPushDirectory(signal());
  assert.equal(result.players[0].teamName,'팀');
  assert.deepEqual(calls.map(c=>c.steps.find(s=>s[0]==='select')[1]),['id,name','id,name,team_id']);
});
test('every directory rejects permission failures and malformed responses instead of reporting zero members', async () => {
  for(const method of ['fetchRefereeSummaries','fetchPenaltySummaries','fetchCoachSummaries','fetchPushDirectory']) {
    for(const result of [{data:null,error:{message:'권한 없음'}},ok(null)]) {
      const {api}=fixture([result]); await assert.rejects(api[method](signal()));
    }
  }
});
test('push profile failure is not hidden by a successful teams request', async () => {
  const {api}=fixture([ok([]),{data:null,error:{message:'network failure'}}]);
  await assert.rejects(api.fetchPushDirectory(signal()),/network failure/);
});
test('a cancelled directory load never starts a request',async()=>{
  const {api,calls}=fixture([]);const controller=new AbortController();controller.abort();
  await assert.rejects(api.fetchRefereeSummaries(controller.signal),/취소/);assert.equal(calls.length,0);
});
test('generic store no longer exposes an unrestricted get_admin_profiles list',()=>{
  const store=fs.readFileSync('src/stores/dataStore.ts','utf8');
  assert.doesNotMatch(store,/rpc\("get_admin_profiles"\)/);
  assert.doesNotMatch(store,/fetchPlayers:\s*async/);
});
