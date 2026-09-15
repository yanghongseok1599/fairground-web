import assert from 'node:assert/strict';
import test from 'node:test';
import { moduleLoader, storeFixture } from './helpers/load-ts-module.mjs';
const load = moduleLoader();
const { hasPortraitConsent, needsPortraitConsent, consentReturnTo } = load('src/features/portrait-consent/policy.ts');
const { hasCompletedPlayerCardSetup } = load('src/lib/player-onboarding.ts');
const row = (consent = null) => ({ id: 'player-1', name: '선수', number: 7, position: 'ALA', portrait_consent_at: consent, created_at: '2026-01-01' });

test('missing, invalid and team-only consent never unlock a personal card', () => {
  for (const at of [undefined, null, 0, -1, NaN, Infinity, '1000']) assert.equal(hasPortraitConsent({portraitConsentAt: at}), false);
  assert.equal(hasCompletedPlayerCardSetup({name:'선수',number:7,position:'ALA',photoUrl:'legacy-photo'}),false);
  assert.equal(hasCompletedPlayerCardSetup({name:'선수',number:7,position:'ALA',portraitConsentAt:1000}),true);
  assert.equal(needsPortraitConsent(null),false);
  assert.equal(needsPortraitConsent({}),true);
  assert.equal(needsPortraitConsent({portraitConsentAt:1000}),false);
});
test('consent return URL rejects external redirects and loops', () => {
  for (const url of ['https://evil.invalid','//evil.invalid','/\\evil.invalid','/\nevil.invalid','/my/portrait-consent','/x/../my/portrait-consent']) assert.equal(consentReturnTo(url),'/my');
  assert.equal(consentReturnTo('/my/player-setup?event=ground-challenge'),'/my/player-setup?event=ground-challenge');
});
test('direct createPlayer without consent performs no write, including with a stale consent cache', async () => {
  const f=storeFixture();f.responses.push({data:row(),error:null});
  await assert.rejects(f.auth.getState().createPlayer({name:'선수',number:7,position:'ALA',photoUrl:'photo'}),/초상권/);
  assert.equal(f.requests.length,1);
  assert.ok(f.requests[0].steps.every(([method])=>method!=='update'&&method!=='insert'));
});
test('new consent is saved with the card and canonical server timestamp is used', async () => {
  const f=storeFixture();const serverTime='2026-09-15T10:00:00Z';
  f.responses.push({data:row(),error:null},{data:{id:'player-1'},error:null},{data:row(serverTime),error:null});
  await f.auth.getState().createPlayer({name:'선수',number:7,position:'ALA',portraitConsentAt:1000});
  assert.equal(f.auth.getState().player.portraitConsentAt,Date.parse(serverTime));
});
test('card edit bypass is rejected; ordinary contact changes and explicit consent remain available', async () => {
  const f=storeFixture();f.auth.setState({player:{...f.player,portraitConsentAt:undefined}});
  await assert.rejects(f.auth.getState().updatePlayer({number:9}),/초상권/);
  assert.equal(f.requests.length,0);
  f.responses.push({data:{id:'player-1'},error:null},{data:row(),error:null});
  await f.auth.getState().updatePlayer({phone:'01000000000'});
  f.responses.push({data:{id:'player-1'},error:null},{data:row('2026-09-15T10:00:00Z'),error:null});
  await f.auth.getState().updatePlayer({portraitConsentAt:1000});
  assert.equal(needsPortraitConsent(f.auth.getState().player),false);
});
test('failed consent save never clears the reminder', async () => {
  const f=storeFixture();f.auth.setState({player:{...f.player,portraitConsentAt:undefined}});
  f.responses.push({data:null,error:{message:'network failure'}});
  await assert.rejects(f.auth.getState().updatePlayer({portraitConsentAt:1000}));
  assert.equal(needsPortraitConsent(f.auth.getState().player),true);
});
test('email signup requires explicit consent before reaching Auth', async () => {
  const f=storeFixture();let calls=0;f.supabase.auth.signUp=async()=>{calls++;throw new Error('unexpected signup');};
  await assert.rejects(f.auth.getState().register({email:'test@synthetic.invalid',portraitConsent:false}),/초상권/);
  assert.equal(calls,0);
});
test('email verification signup sends consent evidence without inventing a logged-in profile', async () => {
  const f=storeFixture();let metadata;
  f.supabase.auth.signUp=async(input)=>{metadata=input.options.data;return {data:{user:{id:'new-user'},session:null},error:null};};
  await f.auth.getState().register({email:'test@synthetic.invalid',password:'pass',name:'선수',portraitConsent:true});
  assert.equal(metadata.portrait_consent,true);
  assert.equal(f.auth.getState().user,null);
  assert.equal(f.auth.getState().player,null);
});

test('a successful response without persisted consent never unlocks subsequent work', async () => {
  const f=storeFixture();f.auth.setState({player:{...f.player,portraitConsentAt:undefined}});
  f.responses.push({data:{id:'player-1'},error:null},{data:row(),error:null});
  await assert.rejects(f.auth.getState().updatePlayer({portraitConsentAt:1000}),/초상권/);
  assert.equal(needsPortraitConsent(f.auth.getState().player),true);
});
