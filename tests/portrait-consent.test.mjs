import assert from 'node:assert/strict';
import test from 'node:test';
import { moduleLoader, storeFixture } from './helpers/load-ts-module.mjs';
const load = moduleLoader();
const { hasPortraitConsent, consentReturnTo, PORTRAIT_CONSENT_VERSION, PORTRAIT_CONSENT_ITEM } = load('src/features/portrait-consent/policy.ts');
const { hasCompletedPlayerCardSetup } = load('src/lib/player-onboarding.ts');
const row = (consent = null) => ({ id: 'player-1', name: '선수', number: 7, position: 'ALA', portrait_consent_at: consent, created_at: '2026-01-01' });

// 2026-10-15: 초상 홍보 이용 동의는 [선택] 이다. 선수카드·대회 신청을 막지 않고, 철회할 수 있다.
test('promotional consent is optional, scoped and never a card prerequisite', () => {
  for (const at of [undefined, null, 0, -1, NaN, Infinity, '1000']) assert.equal(hasPortraitConsent({portraitConsentAt: at}), false);
  assert.equal(hasPortraitConsent({portraitConsentAt: 1000}), true);
  assert.equal(hasCompletedPlayerCardSetup({name:'선수',number:7,position:'ALA'}), true);
  assert.equal(PORTRAIT_CONSENT_ITEM.required, false);
  const text = JSON.stringify(PORTRAIT_CONSENT_ITEM);
  assert.doesNotMatch(text, /기간과 횟수의 제한 없이|주장하지 않습니다/);
  assert.match(text, /2년/); assert.match(text, /철회/); assert.match(text, /동의하지 않아도/);
});
test('consent return URL rejects external redirects and loops', () => {
  for (const url of ['https://evil.invalid','//evil.invalid','/\\evil.invalid','/\nevil.invalid','/my/portrait-consent','/x/../my/portrait-consent']) assert.equal(consentReturnTo(url),'/my');
  assert.equal(consentReturnTo('/my/player-setup?event=ground-challenge'),'/my/player-setup?event=ground-challenge');
});
test('creating a card without consent saves the card and never writes a consent timestamp', async () => {
  const f=storeFixture();f.auth.setState({player:{...f.player,portraitConsentAt:undefined}});
  f.responses.push({data:row(),error:null},{data:{id:'player-1'},error:null},{data:row(),error:null});
  await f.auth.getState().createPlayer({name:'선수',number:7,position:'ALA',photoUrl:'photo'});
  const update=f.requests.find((r)=>r.table==='profiles')?.steps.find(([m])=>m==='update')?.[1];
  assert.ok(update,'card was saved');
  assert.equal('portrait_consent_at' in update,false);
});
test('profile saves strip any consent field; consent changes only through the record RPC', async () => {
  const f=storeFixture();f.auth.setState({player:{...f.player,portraitConsentAt:undefined}});
  f.responses.push({data:{id:'player-1'},error:null},{data:row(),error:null});
  await f.auth.getState().updatePlayer({number:9,portraitConsentAt:1000});
  const update=f.requests[0].steps.find(([m])=>m==='update')[1];
  assert.equal('portrait_consent_at' in update,false);
});
test('grant and withdrawal are recorded, then read back from the database', async () => {
  const f=storeFixture();f.auth.setState({player:{...f.player,portraitConsentAt:undefined}});
  const serverTime='2026-10-15T10:00:00Z';
  f.responses.push({data:1,error:null},{data:row(serverTime),error:null});
  await f.auth.getState().setPortraitConsent(true);
  assert.equal(f.requests[0].rpc,'record_my_consents');
  assert.equal(f.requests[0].args.p_source,'mypage');
  assert.deepEqual(f.requests[0].args.p_items,[{kind:'portrait',version:PORTRAIT_CONSENT_VERSION,granted:true}]);
  assert.equal(f.auth.getState().player.portraitConsentAt,Date.parse(serverTime));
  f.responses.push({data:1,error:null},{data:row(),error:null});
  await f.auth.getState().setPortraitConsent(false);
  assert.deepEqual(f.requests[2].args.p_items,[{kind:'portrait',version:PORTRAIT_CONSENT_VERSION,granted:false}]);
  assert.equal(hasPortraitConsent(f.auth.getState().player),false);
});
test('a failed or unconfirmed consent write never flips local state', async () => {
  const f=storeFixture();f.auth.setState({player:{...f.player,portraitConsentAt:undefined}});
  f.responses.push({data:null,error:{message:'network failure'}});
  await assert.rejects(f.auth.getState().setPortraitConsent(true));
  assert.equal(hasPortraitConsent(f.auth.getState().player),false);
  f.responses.push({data:1,error:null},{data:row(),error:null});
  await assert.rejects(f.auth.getState().setPortraitConsent(true),/확인하지 못했습니다/);
  assert.equal(hasPortraitConsent(f.auth.getState().player),false);
});
test('email signup sends the checklist as consent evidence without inventing a logged-in profile', async () => {
  const f=storeFixture();let metadata;
  const consents=[{kind:'age14',version:'v',granted:true},{kind:'portrait',version:'v',granted:false}];
  f.supabase.auth.signUp=async(input)=>{metadata=input.options.data;return {data:{user:{id:'new-user'},session:null},error:null};};
  await f.auth.getState().register({email:'test@synthetic.invalid',password:'pass',name:'선수',consents});
  assert.deepEqual(metadata.consents,consents);
  assert.equal('portrait_consent' in metadata,false);
  assert.equal(f.auth.getState().user,null);
  assert.equal(f.auth.getState().player,null);
});
