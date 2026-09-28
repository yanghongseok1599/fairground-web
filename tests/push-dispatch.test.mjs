import assert from 'node:assert/strict';
import test from 'node:test';
import { moduleLoader } from './helpers/load-ts-module.mjs';

function dispatcher({subscriptions=[],failures={}}={}) {
  const sent=[],deleted=[],queries=[];let handler;
  const admin={from(table){queries.push(table);const chain={select(){return chain;},eq(){return chain;},maybeSingle:async()=>({data:{vapid_public:'public',vapid_private:'private',subject:'mailto:test@example.com',webhook_secret:'test-secret'}}),delete(){return chain;},in:async(column,ids)=>{deleted.push(...ids);return {error:null};},then(resolve){return Promise.resolve({data:subscriptions,error:null}).then(resolve);}};return chain;}};
  globalThis.Deno={env:{get:()=> 'synthetic'},serve:fn=>{handler=fn;}};
  moduleLoader({
    'jsr:@supabase/functions-js/edge-runtime.d.ts':{},
    'jsr:@supabase/supabase-js@2':{createClient:()=>admin},
    'npm:web-push@3.6.7':{setVapidDetails(){},sendNotification:async(subscription,payload)=>{if(failures[subscription.endpoint])throw {statusCode:failures[subscription.endpoint]};sent.push({subscription,payload:JSON.parse(payload)});}},
  })('supabase/functions/push-dispatch/index.ts');
  delete globalThis.Deno;
  return {handler,sent,deleted,queries};
}
function request(record,secret='test-secret') {return new Request('https://synthetic.test',{method:'POST',headers:{'x-webhook-secret':secret},body:JSON.stringify({record})});}
const record={id:'notif-1',user_id:'user-1',kind:'match_ready',title:'경기 준비',match_id:'match-1',snippet:'경기장 앞 대기'};
const sub=(id)=>({id,endpoint:id,p256dh:'key',auth:'auth'});

test('dispatcher rejects unauthenticated requests before reading subscriptions',async()=>{
  const d=dispatcher();assert.equal((await d.handler(request(record,'wrong'))).status,403);assert.deepEqual(d.queries,['app_push_config']);assert.equal(d.sent.length,0);
});
test('dispatcher preserves match and notification identity and all independent devices',async()=>{
  const d=dispatcher({subscriptions:[sub('android'),sub('iphone')]});const r=await d.handler(request(record));assert.deepEqual(await r.json(),{sent:2,removed:0});
  for(const {payload} of d.sent){assert.equal(payload.url,'/matches/match-1');assert.equal(payload.notificationId,'notif-1');assert.equal(payload.body,'경기장 앞 대기');}
});
test('generic test broadcasts open the live schedule',async()=>{
  const d=dispatcher({subscriptions:[sub('android')]});await d.handler(request({...record,kind:'admin_broadcast',match_id:null}));assert.equal(d.sent[0].payload.url,'/live');
});
test('only expired endpoints are removed and rejected sends do not count as sent',async()=>{
  const d=dispatcher({subscriptions:[sub('good'),sub('expired'),sub('missing'),sub('throttled')],failures:{expired:410,missing:404,throttled:429}});
  const r=await d.handler(request(record));assert.deepEqual(await r.json(),{sent:1,removed:2});assert.deepEqual(d.deleted.sort(),['expired','missing']);
});
test('an unsubscribed account does not cause a provider send',async()=>{
  const d=dispatcher();const r=await d.handler(request(record));assert.deepEqual(await r.json(),{sent:0,reason:'no subscriptions'});assert.equal(d.sent.length,0);
});
