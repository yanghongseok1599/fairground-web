import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { moduleLoader } from './helpers/load-ts-module.mjs';
const { notificationTarget, notificationPushPayload } = moduleLoader()('supabase/functions/_shared/notification-target.ts');

for (const kind of ['match_ready', 'admin_broadcast', 'match_score', 'match_mom']) {
  test(`${kind}: match identity wins over team identity in inbox and push`, () => {
    assert.equal(notificationTarget({kind, matchId:'match-1', teamId:'team-1'}), '/matches/match-1');
    const payload=notificationPushPayload({id:'notification-1',user_id:'player-1',kind,title:'경기 안내',snippet:'안내 본문',match_id:'match-1',team_id:'team-1'});
    assert.deepEqual(payload,{title:'경기 안내',body:'안내 본문',url:'/matches/match-1',kind,notificationId:'notification-1'});
  });
}
test('missing match identity uses live schedule without fabricating a match or parsing title text', () => {
  for(const kind of ['admin_broadcast','match_ready']) assert.equal(notificationTarget({kind}), '/live');
  assert.equal(notificationTarget({kind:'match_ready',teamId:'team-1'}), '/live');
});
test('community and profile notifications keep their destinations', () => {
  assert.equal(notificationTarget({kind:'reply',postId:'post',commentId:'comment'}),'/board/post#cm-comment');
  assert.equal(notificationTarget({kind:'team_notice',teamId:'team'}),'/teams/team/notices');
  assert.equal(notificationTarget({kind:'tier_promoted'}),'/my');
  assert.equal(notificationTarget({kind:'coach_approved'}),'/my');
  assert.equal(notificationTarget({kind:'player_approved'}),'/my');
  assert.equal(notificationTarget({kind:'team_role_changed',teamId:'team'}),'/teams/team');
});
test('identifiers cannot inject query strings, hashes or route separators', () => {
  assert.equal(notificationTarget({kind:'match_ready',matchId:'id/?x#y'}),'/matches/id%2F%3Fx%23y');
});
function worker(file, clients=[]) {
  const handlers={}, shown=[], opened=[];
  vm.runInNewContext(fs.readFileSync(file,'utf8'),{URL,self:{location:{origin:'https://fairground-kor.com'},addEventListener:(type,handler)=>{handlers[type]=handler;},registration:{showNotification:async (...args)=>shown.push(args)},clients:{matchAll:async()=>clients,openWindow:async url=>opened.push(url)}}});
  async function event(type, fields) { let promise; handlers[type]({...fields,waitUntil:p=>{promise=p;}});await promise; }
  return {shown,opened,push:payload=>event('push',{data:{json:()=>payload}}),click:url=>event('notificationclick',{notification:{data:{url},close(){}}})};
}
for(const file of ['public/sw.js','public/sw-push.js']) {
  test(`${file}: duplicate delivery uses a stable tag; distinct events stay separate`,async()=>{
    const w=worker(file);
    for(const id of ['one','one','two'])await w.push({notificationId:id,url:'/matches/match-1',title:'경기 안내'});
    assert.equal(w.shown[0][1].tag,w.shown[1][1].tag);
    assert.notEqual(w.shown[0][1].tag,w.shown[2][1].tag);
    assert.equal(w.shown[0][1].data.url,'/matches/match-1');
    assert.notEqual(w.shown[0][1].renotify,true);
  });
  test(`${file}: clicking with no open window opens the exact match`,async()=>{
    const w=worker(file);await w.click('/matches/match-1');assert.deepEqual(w.opened,['https://fairground-kor.com/matches/match-1']);
  });
  test(`${file}: an already open match is focused without reloading it`,async()=>{
    let focused=0;const w=worker(file,[{url:'https://fairground-kor.com/matches/match-1',focus:async()=>{focused++;}}]);
    await w.click('/matches/match-1');assert.equal(focused,1);assert.equal(w.opened.length,0);
  });
  test(`${file}: home is navigated to the match before it is focused`,async()=>{
    const actions=[];const client={url:'https://fairground-kor.com/',navigate:async url=>{actions.push(url);return client;},focus:async()=>actions.push('focus')};
    const w=worker(file,[client]);await w.click('/matches/match-1');assert.deepEqual(actions,['https://fairground-kor.com/matches/match-1','focus']);assert.equal(w.opened.length,0);
  });
  test(`${file}: referee and editing pages are preserved`,async()=>{
    const w=worker(file,[{url:'https://fairground-kor.com/referee/match-1',navigate:()=>{throw Error('must not navigate');}}]);
    await w.click('/matches/match-2');assert.deepEqual(w.opened,['https://fairground-kor.com/matches/match-2']);
  });
  test(`${file}: failed or null navigation falls back to opening the match`,async()=>{
    const w=worker(file,[{url:'https://fairground-kor.com/',navigate:async()=>null}]);await w.click('/matches/match-1');assert.equal(w.opened.length,1);
  });
  test(`${file}: external URLs and malformed payloads are safe`,async()=>{
    const w=worker(file);await w.push(null);assert.equal(w.shown[0][0],'FairGround');
    for(const url of ['//evil.example/','https://evil.example/','javascript:alert(1)']) {await w.click(url);assert.equal(w.opened.at(-1),'https://fairground-kor.com/');}
  });
}
test('both workers have identical push and click implementations',()=>{
  const handlers=file=>fs.readFileSync(file,'utf8').split('// Only same-origin destinations')[1];
  assert.equal(handlers('public/sw.js'),handlers('public/sw-push.js'));
});
test('realtime refreshes the inbox without creating another device notification',()=>{
  const realtime=fs.readFileSync('src/components/notification-realtime.tsx','utf8');
  assert.doesNotMatch(realtime,/showDeviceNotification|showNotification|new Notification/);
  assert.match(realtime,/dispatchEvent\(new Event\(NOTIFICATION_INBOX_CHANGED\)\)/);
  for(const file of ['notification-bell','notification-panel'])assert.match(fs.readFileSync(`src/components/${file}.tsx`,'utf8'),/addEventListener\(NOTIFICATION_INBOX_CHANGED/);
});
