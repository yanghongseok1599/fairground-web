import assert from 'node:assert/strict';
import test from 'node:test';
import { moduleLoader, memoryStorage, storeFixture } from './helpers/load-ts-module.mjs';
const load = moduleLoader();
const { requireSavedRow, registrationError, registrationFetch } = load('src/lib/registration/reliability.ts');
const { readDraft, writeDraft, removeDraft } = load('src/lib/registration/draft-storage.ts');
const { canEditTeamDetails, canManageTeamMembers } = load('src/lib/team-permissions.ts');
const { teamPatchToRow, playerPatchToRow, playerToInsert } = load('src/lib/mappers.ts');

test('RLS zero-row save and server errors never count as success', () => {
  assert.throws(() => requireSavedRow(null,null), /저장이 확인되지/);
  assert.throws(() => requireSavedRow(null,{message:'permission denied'}), /수정 권한/);
  assert.equal(requireSavedRow({id:'saved'},null).id,'saved');
});
test('lost response copy does not falsely claim rollback or encourage duplicate writes', () => {
  assert.match(registrationError(new Error('Failed to fetch')), /저장 결과를 확인/);
  assert.match(registrationError(new Error('timeout')), /입력은 유지/);
});
test('draft survives reload; separate accounts never share a draft; clear only after success', () => {
  const storage=memoryStorage();
  writeDraft(storage,'team:account-a',{name:'수정 중',logo:'data:image/png;base64,AA=='});
  assert.equal(readDraft(storage,'team:account-a').name,'수정 중');
  assert.equal(readDraft(storage,'team:account-b'),null);
  removeDraft(storage,'team:account-a');
  assert.equal(readDraft(storage,'team:account-a'),null);
});
test('expired drafts are removed and quota failure surfaces', () => {
  const storage=memoryStorage(); writeDraft(storage,'test',{name:'old'});
  assert.equal(readDraft(storage,'test',Date.now()+8*86400000),null);
  assert.throws(()=>writeDraft({setItem(){throw new Error('QuotaExceededError');}},'test',{}),/Quota/);
});
test('pending owner may edit registration but may not operate roster', () => {
  const p={id:'owner',role:'player',teamId:'t',isApproved:false}; const t={id:'t',captainId:'owner'};
  assert.equal(canEditTeamDetails(p,t),true); assert.equal(canManageTeamMembers(p,t),false);
  assert.equal(canEditTeamDetails({...p,id:'other'},t),false);
});
test('clearing optional fields reaches DB; omitted fields never erase existing values', () => {
  assert.deepEqual(teamPatchToRow({description:undefined,foundedYear:undefined,logo:''}),{description:null,founded_year:null,logo:''});
  assert.deepEqual(teamPatchToRow({name:'new'}),{name:'new'});
  assert.deepEqual(playerPatchToRow({birthDate:'',gender:''}),{birth_date:null,gender:null});
});
test('profile save without session is explicit failure', async () => {
  const f=storeFixture(); f.auth.setState({user:null});
  await assert.rejects(f.auth.getState().updatePlayer({name:'new'}),/로그인/);
  assert.equal(f.requests.length,0);
});
test('profile save checks returned row before touching local state', async () => {
  const f=storeFixture(); f.responses.push({data:null,error:null});
  await assert.rejects(f.auth.getState().updatePlayer({name:'new'}),/저장이 확인되지/);
  assert.equal(f.auth.getState().player.name,'원래 이름');
  assert.ok(f.requests[0].steps.some(x=>x[0]==='single'));
});
test('profile successful patch preserves statistics and membership', async () => {
  const f=storeFixture(); f.responses.push({data:{id:'player-1'},error:null},{data:{...playerToInsert(f.player),name:'server normalized',created_at:new Date(f.player.createdAt).toISOString()},error:null});
  await f.auth.getState().updatePlayer({name:'new'});
  assert.equal(f.auth.getState().player.name,'server normalized');
  assert.deepEqual(f.auth.getState().player.stats,f.player.stats);
  assert.deepEqual(f.requests[0].steps.find(x=>x[0]==='update')[1],{name:'new'});
});
test('existing player setup never resubmits badges, privilege, membership or prior consent', async () => {
  const f=storeFixture();
  f.responses.push({data:{id:'player-1',name:'원래 이름',number:7,position:'ALA',role:'player',is_approved:true,team_id:null,
    goals:19,assists:7,games:22,mom:3,badges:['earned'],phone:'01000000000',portrait_consent_at:'2026-01-01T00:00:00Z',created_at:'2026-01-01T00:00:00Z'},error:null},
    {data:{id:'player-1'},error:null},
    {data:{id:'player-1',name:'new',number:9,position:'PIVO',role:'player',is_approved:true,team_id:null,
      goals:19,assists:7,games:22,mom:3,badges:['earned'],phone:'01000000000',portrait_consent_at:'2026-01-01T00:00:00Z',created_at:'2026-01-01T00:00:00Z'},error:null});
  await f.auth.getState().createPlayer({name:'new',number:9,position:'PIVO',teamId:'another-team',role:'captain',teamRole:'coach',portraitConsentAt:Date.now()});
  const patch=f.requests[1].steps.find(x=>x[0]==='update')[1];
  for(const field of ['team_id','role','team_role','badges','goals','is_approved','portrait_consent_at']) assert.equal(Object.hasOwn(patch,field),false,field);
  assert.equal(f.auth.getState().player.phone,'01000000000');
  assert.equal(f.auth.getState().player.stats.goals,19);
});
test('forced team reload reads server instead of stale ownership cache', async () => {
  const f=storeFixture(); f.data.setState({teams:{t:{id:'t',captainId:'old'}}});
  assert.equal((await f.data.getState().fetchTeam('t')).captainId,'old');
  assert.equal(f.requests.length,0);
  f.responses.push({data:{id:'t',name:'team',captain_id:'new'},error:null});
  assert.equal((await f.data.getState().fetchTeam('t',true)).captainId,'new');
});
test('team read failure is not an empty/new team', async () => {
  const f=storeFixture();f.responses.push({data:null,error:{message:'Failed to fetch'}});
  await assert.rejects(f.data.getState().fetchTeam('t',true),/서버 응답/);
});
test('team update uses returned canonical values, not a locally invented success', async () => {
  const f=storeFixture(); f.responses.push({data:{id:'t',name:'server normalized',captain_id:'owner'},error:null});
  await f.data.getState().updateTeam('t',{name:'client'});
  assert.equal(f.data.getState().teams.t.name,'server normalized');
});
test('ownership transfer refreshes cached owner immediately', async () => {
  const f=storeFixture(); f.data.setState({teams:{t:{id:'t',captainId:'old'}}});
  f.responses.push({data:null,error:null});
  await f.data.getState().transferTeamOwnership('t','new');
  assert.equal(f.data.getState().teams.t.captainId,'new');
});
test('failed roster lookup is not silently shown as zero members', async () => {
  const f=storeFixture();f.responses.push({data:null,error:{message:'network error'}});
  await assert.rejects(f.data.getState().fetchTeamMembers('t'),/서버 응답/);
});
test('team creation uses one RPC and keeps retry ID after lost response', async () => {
  const f=storeFixture();globalThis.sessionStorage=memoryStorage();
  f.responses.push({data:null,error:{message:'timeout'}});
  await assert.rejects(f.data.getState().createTeam({name:'team'}));
  const id=f.requests[0].args.p_request_id;
  f.responses.push({data:{id,name:'team',captain_id:'player-1'},error:null});
  assert.equal(await f.data.getState().createTeam({name:'team'}),id);
  assert.equal(f.requests[1].args.p_request_id,id);
  assert.equal(f.requests.every(r=>r.rpc==='register_team'),true);
  assert.equal(f.auth.getState().player.teamId,id);
});
test('an existing join request is recovered without a second insert', async () => {
  const f=storeFixture(); f.responses.push({data:{id:'pending'},error:null});
  assert.equal(await f.data.getState().requestJoinTeam('t'),'pending');
  assert.equal(f.requests.some(r=>r.steps.some(x=>x[0]==='insert')),false);
});
test('concurrent join uniqueness collision recovers original request', async () => {
  const f=storeFixture();f.responses.push({data:null,error:null},{data:null,error:{code:'23505',message:'duplicate'}},{data:{id:'original'},error:null});
  assert.equal(await f.data.getState().requestJoinTeam('t'),'original');
});
test('request wrapper propagates cancellation and does not retry', async () => {
  const before=globalThis.fetch; let calls=0; const source=new AbortController();source.abort();
  globalThis.fetch=async (_input,init)=>{calls++;assert.equal(init.signal.aborted,true);throw new Error('aborted');};
  try { await assert.rejects(registrationFetch('https://synthetic.invalid',{signal:source.signal}),/aborted/);assert.equal(calls,1); }
  finally {globalThis.fetch=before;}
});

test('optional photo does not force completed registrations through onboarding again', () => {
  const {hasCompletedPlayerCardSetup}=load('src/lib/player-onboarding.ts');
  const p={name:'선수',number:12,position:'ALA',photoUrl:'',portraitConsentAt:1000};
  assert.equal(hasCompletedPlayerCardSetup(p),true);
  assert.equal(hasCompletedPlayerCardSetup({...p,number:0,portraitConsentAt:undefined}),false);
});
test('a committed coach claim does not fail because of an unnecessary follow-up read', async () => {
  const f=storeFixture();f.data.setState({teams:{t:{id:'t',captainId:undefined}}});
  f.responses.push({data:null,error:null});
  await f.data.getState().claimTeamCoach('t');
  assert.equal(f.requests.length,1);assert.equal(f.auth.getState().player.teamRole,'coach');
  assert.equal(f.data.getState().teams.t.captainId,'player-1');
});
test('auth refresh failure retains the last known player instead of erasing the active form identity', async () => {
  const f=storeFixture(); let callback;
  f.supabase.auth.onAuthStateChange=(fn)=>{callback=fn;return {data:{subscription:{unsubscribe(){}}}};};
  f.auth.getState().init(); f.responses.push({data:null,error:{message:'network error'}});
  callback('TOKEN_REFRESHED',{user:{id:'player-1',email:'synthetic@example.com',user_metadata:{}}});
  await new Promise(r=>setTimeout(r,10));
  assert.equal(f.auth.getState().player.name,'원래 이름');
  assert.match(f.auth.getState().error,/서버 응답/);
});
test('a delayed auth read cannot resurrect the user after sign-out', async () => {
  const f=storeFixture();let callback,resolveRead;
  f.supabase.auth.onAuthStateChange=(fn)=>{callback=fn;return {data:{subscription:{unsubscribe(){}}}};};
  f.auth.getState().init();f.responses.push(new Promise(r=>{resolveRead=r;}));
  callback('TOKEN_REFRESHED',{user:{id:'player-1',email:'synthetic@example.com',user_metadata:{}}});
  await new Promise(r=>setTimeout(r,5));callback('SIGNED_OUT',null);
  resolveRead({data:{id:'player-1',name:'stale',number:7,position:'ALA',created_at:'2026-01-01'},error:null});
  await new Promise(r=>setTimeout(r,5));
  assert.equal(f.auth.getState().user,null);assert.equal(f.auth.getState().player,null);
});


test('player setup uses the committed row when membership or match statistics changed during the form', async () => {
  const f=storeFixture();
  const before={id:'player-1',name:'old',number:7,position:'ALA',role:'player',team_id:null,goals:19,created_at:'2026-01-01'};
  f.responses.push({data:before,error:null},{data:{id:'player-1'},error:null},{data:{...before,name:'new',team_id:'approved-while-saving',goals:20},error:null});
  await f.auth.getState().createPlayer({name:'new',number:9,position:'PIVO'});
  assert.equal(f.auth.getState().player.teamId,'approved-while-saving');
  assert.equal(f.auth.getState().player.stats.goals,20);
});

test('a delayed coach claim cannot change a different account after switching users', async () => {
  const f=storeFixture(); let finish;
  f.responses.push(new Promise(resolve=>{finish=resolve;}));
  const saving=f.data.getState().claimTeamCoach('team-a');
  f.auth.setState({user:{uid:'different'},player:{...f.player,id:'different',teamId:'team-b'}});
  finish({data:null,error:null}); await saving;
  assert.equal(f.auth.getState().player.teamId,'team-b');
  assert.equal(f.auth.getState().player.teamRole,undefined);
});
