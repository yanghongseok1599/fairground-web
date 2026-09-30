import assert from 'node:assert/strict';
import test from 'node:test';
import { moduleLoader } from './helpers/load-ts-module.mjs';

const load = moduleLoader();
const { inspectionRequest } = load('src/features/player-inspection/request.ts');
const { filterInspections, summarizeInspections, inspectionBlockReason, inspectionNumber } = load('src/features/player-inspection/policy.ts');
const pending = { player_id:'a', name:'가나다', number:7, number_label:'007', team_id:'t1', team_name:'파랑 FC', birth_date:null, is_approved:true, has_player_experience:false, checked_at:null, checked_by_name:null, revision:0 };
const checked = { ...pending, player_id:'b', name:'라마바', number:0, number_label:'00', team_id:'t2', team_name:'초록 FC', checked_at:'2026-10-03T01:00:00Z', revision:1 };

test('inspection summaries count pending and complete independently of approval', () => {
  assert.deepEqual(summarizeInspections([pending, checked, {...pending, is_approved:false}]), {total:3, complete:1, pending:2});
  assert.deepEqual(summarizeInspections([]), {total:0, complete:0, pending:0});
});
test('team, status and name/jersey searches compose without merging 0 and 00', () => {
  assert.equal(inspectionNumber(checked),'00');
  assert.deepEqual(filterInspections([checked,pending],' 007 ','t1','pending'),[pending]);
  assert.deepEqual(filterInspections([checked,pending],'초록','','complete'),[checked]);
  assert.deepEqual(filterInspections([checked,pending],'','t1','complete'),[]);
  assert.deepEqual(filterInspections([checked,pending],'','','all'),[pending,checked]);
});
test('approval and registered-player restrictions block completion', () => {
  assert.equal(inspectionBlockReason(pending),null);
  assert.match(inspectionBlockReason({...pending,is_approved:false}),/승인/);
  assert.match(inspectionBlockReason({...pending,has_player_experience:true}),/참가 자격/);
});

function apiFixture(response) {
  const requests=[];
  const supabase={rpc:(rpc,args)=>{requests.push({rpc,args});const request=Promise.resolve(response);request.abortSignal=()=>request;return request;}};
  return { requests, api:moduleLoader({'@/config/supabase':{supabase}})('src/features/player-inspection/api.ts') };
}
test('writes use explicit desired state and expected revision; never client timestamps', async () => {
  const {api,requests}=apiFixture({data:2,error:null});
  await api.saveInspection('event',checked,false);
  assert.deepEqual(requests,[{rpc:'set_player_inspection',args:{p_tournament_id:'event',p_player_id:'b',p_checked:false,p_expected_revision:1}}]);
});
test('failed/empty/unacknowledged saves never report success or retry the write', async () => {
  for(const response of [{data:null,error:{message:'권한 없음'}},{data:null,error:null},{data:6,error:null}]) {
    const {api,requests}=apiFixture(response);
    await assert.rejects(api.saveInspection('event',pending,true));
    assert.equal(requests.length,1);
  }
});
test('my read is server-scoped and errors are not converted into pending/empty results', async () => {
  const {api,requests}=apiFixture({data:[],error:null});
  assert.deepEqual(await api.fetchMyInspections(new AbortController().signal),[]);
  assert.deepEqual(requests,[{rpc:'get_my_player_inspections',args:undefined}]);
  await assert.rejects(apiFixture({data:null,error:{message:'offline'}}).api.fetchMyInspections(new AbortController().signal),/offline/);
});
test('auth/network hangs expire, abort the request, and do not retry', async () => {
  let calls=0, requestSignal;
  await assert.rejects(inspectionRequest(new AbortController().signal,signal=>{
    calls++;requestSignal=signal;return new Promise(()=>{});
  },10),/timeout/);
  assert.equal(calls,1);assert.equal(requestSignal.aborted,true);
});
test('cancelled navigation never starts another request', async () => {
  const controller=new AbortController();controller.abort();
  await assert.rejects(inspectionRequest(controller.signal,()=>{throw Error('must not run')}),/취소/);
});
