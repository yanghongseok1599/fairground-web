import assert from 'node:assert/strict';
import { test } from 'node:test';
import { moduleLoader } from './helpers/load-ts-module.mjs';

const load = moduleLoader();
const { shootoutRecordingError, shootoutRecordingPayload } = load('src/features/match-shootout/recording-contract.ts');
const { projectRoom, reconcileSnapshot } = load('src/features/match-recording/model.ts');
const { rowToMatch } = load('src/lib/mappers.ts');
const base = { id:'match',tournamentId:'cup',round:18,homeTeamId:'home',awayTeamId:'away',homeTeamName:'홈',awayTeamName:'원정',homeScore:0,awayScore:0,status:'live',scheduledAt:0,events:[],elapsedSeconds:720,currentHalf:1,isRunning:false,serverRevision:1 };

test('진행 중 동률 O/X를 저장하되 종료 경기와 기존 합계 입력은 최종 승자를 요구한다', () => {
 assert.equal(shootoutRecordingError(0,0,{home:[false],away:[false]},'live'),undefined);
 assert.ok(shootoutRecordingError(0,0,{home:[false],away:[false]},'finished'));
 assert.ok(shootoutRecordingError(0,0));
 assert.ok(shootoutRecordingError(2,0,{home:[true],away:[false]},'live'));
 assert.ok(shootoutRecordingError(0,0,{home:[],away:[]},'live'));
 assert.ok(shootoutRecordingError(0,0,{home:[null],away:[false]},'live'));
});

test('같은 합계의 O/X 순서 정정은 기존 배열을 CAS로 전달한다', () => {
 const current={...base,homeShootoutScore:1,awayShootoutScore:0,homeShootoutAttempts:[true,false],awayShootoutAttempts:[false]};
 const payload=shootoutRecordingPayload(current,1,0,{home:[false,true],away:[false]});
 assert.deepEqual(payload.homeAttempts,[false,true]);
 assert.deepEqual(payload._shootoutHomeAttemptsBefore,[true,false]);
 assert.deepEqual(payload._shootoutAwayAttemptsBefore,[false]);
 assert.equal(payload._shootoutHomeBefore,1);
 const legacy=shootoutRecordingPayload(base,0,1);
 assert.equal(Object.hasOwn(legacy,'homeAttempts'),false);
 assert.equal(Object.hasOwn(legacy,'_shootoutHomeAttemptsBefore'),false);
 const initial=shootoutRecordingPayload(base,0,0,{home:[false],away:[false]});
 assert.equal(initial._shootoutHomeAttemptsBefore,null);
});

test('오프라인 직렬화와 서버 응답 복원은 O/X 순서를 보존하고 정규 골·선수 이벤트를 바꾸지 않는다', () => {
 const room={key:'actor:match',actorId:'actor',matchId:'match',base,players:[],lineups:[],revision:1,savedAt:0,journal:[],pending:[{id:'first',kind:'shootout',at:10,payload:shootoutRecordingPayload(base,1,0,{home:[true,false],away:[false]})}]};
 room.journal=structuredClone(room.pending);
 const restored=JSON.parse(JSON.stringify(room));
 const projected=projectRoom(restored);
 assert.deepEqual(projected.homeShootoutAttempts,[true,false]);
 assert.deepEqual(projected.awayShootoutAttempts,[false]);
 assert.equal(projected.homeScore,0);assert.equal(projected.awayScore,0);assert.deepEqual(projected.events,[]);
 assert.equal(room.base.homeShootoutAttempts,undefined);
 const incoming={...projected,serverRevision:2,appliedOperationIds:['first']};
 const next=reconcileSnapshot(restored,incoming);
 assert.equal(next.pending.length,0);assert.equal(next.journal[0].id,'first');
 assert.deepEqual(next.base.homeShootoutAttempts,[true,false]);
 const decoded=rowToMatch({id:'match',tournament_id:'cup',round:18,home_team_name:'홈',away_team_name:'원정',home_score:0,away_score:0,status:'live',home_shootout_score:1,away_shootout_score:0,home_shootout_attempts:[true,false],away_shootout_attempts:[false]});
 assert.deepEqual(decoded.homeShootoutAttempts,[true,false]);assert.deepEqual(decoded.awayShootoutAttempts,[false]);
 const old=rowToMatch({id:'old',home_shootout_score:0,away_shootout_score:1,home_shootout_attempts:null,away_shootout_attempts:null});
 assert.equal(old.homeShootoutAttempts,undefined);assert.equal(old.awayShootoutAttempts,undefined);
});

test('연속 저장 큐는 앞선 자기 O/X 명령을 이전 배열로 삼아 같은 합계 정정을 순서대로 보낸다', async () => {
 let room={key:'actor:match',actorId:'actor',matchId:'match',base,players:[],lineups:[],revision:1,savedAt:0,journal:[],pending:[]};
 const actor={user:{uid:'actor'},player:{name:'심판'}};
 const adapterLoad=moduleLoader({
  '@/stores/dataStore':{useDataStore:{getState:()=>({})}},
  '@/stores/authStore':{useAuthStore:{getState:()=>actor}},
  './device':{recordingDeviceId:()=> 'device'},
  './storage':{updateRoom:async (_key,update)=>room=update(room)},
  './control-safety':{createObservedClock:()=>({payload:()=>({}),remember:()=>{}}),finalizationWaitMessage:()=>undefined,otherPendingCount:()=>0},
 });
 const previousWindow=globalThis.window;
 globalThis.window={dispatchEvent:()=>true};
 try {
  const {createRecordingAdapter}=adapterLoad('src/features/match-recording/adapter.ts');
  const store=createRecordingAdapter(room).store;
  await store.getState().setMatchShootout('cup','match',1,0,{home:[true,false],away:[false]});
  await store.getState().setMatchShootout('cup','match',1,0,{home:[false,true],away:[false]});
  assert.equal(room.pending.length,2);
  assert.deepEqual(room.pending[1].payload._shootoutHomeAttemptsBefore,[true,false]);
  assert.deepEqual(room.pending[1].payload.homeAttempts,[false,true]);
  assert.notEqual(room.pending[0].id,room.pending[1].id);
  assert.deepEqual(projectRoom(room).homeShootoutAttempts,[false,true]);
  assert.equal(room.journal.length,2);
 } finally {globalThis.window=previousWindow;}
});
