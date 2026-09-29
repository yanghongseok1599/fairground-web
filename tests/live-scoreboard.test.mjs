import assert from 'node:assert/strict';
import test from 'node:test';
import { moduleLoader } from './helpers/load-ts-module.mjs';
const {selectLiveScoreboard,scheduledMatchTime}=moduleLoader()('src/features/live-score/schedule.ts');
const tournament=(id,overrides={})=>({id,name:'대회 '+id,status:'ongoing',fixturesPublished:true,groups:[{id:'group-a',name:'A조'}],...overrides});
const publicFixtureRules=moduleLoader()('src/features/tournaments/public-fixtures.ts');
const match=(id,status,scheduledAt,overrides={})=>({id,status,scheduledAt,createdAt:1,tournamentId:'cup-a',groupId:'group-a',round:1,elapsedSeconds:0,currentHalf:1,isRunning:false,homeTeamName:'홈팀',awayTeamName:'원정팀',...overrides});
const select=(matches,tournaments=[tournament('cup-a')])=>selectLiveScoreboard({matches,tournaments});

test('shows all live games and only the next scheduled slot, preserving the input',()=>{
  const matches=[match('later','scheduled',300),match('next','scheduled',200),match('live','live',100)];
  const result=select(matches);
  assert.deepEqual(result.live.map(m=>m.id),['live']);assert.deepEqual(result.upcoming.map(x=>x.match.id),['next']);assert.equal(matches[0].id,'later');
});
test('simultaneous fixtures remain visible without guessing a court number',()=>{
  const result=select([match('live','live',100),match('next-a','scheduled',200),match('next-b','scheduled',200,{groupId:'group-b'}),match('later','scheduled',300)]);
  assert.deepEqual(result.upcoming.map(x=>x.match.id),['next-a','next-b']);assert.equal(result.upcoming[0].groupName,'A조');assert.equal(result.upcoming[1].groupName,undefined);
});
test('a first match is shown even before any game has started',()=>{
  assert.deepEqual(select([match('first','scheduled',100),match('later','scheduled',200)]).upcoming.map(x=>x.match.id),['first']);
});
test('upcoming becomes live and the following game takes its place after a refresh',()=>{
  const initial=[match('one','live',100),match('two','scheduled',200),match('three','scheduled',300)];
  assert.equal(select(initial).upcoming[0].match.id,'two');
  const updated=select(initial.map(m=>({...m,status:m.id==='one'?'finished':m.id==='two'?'live':m.status})));
  assert.deepEqual(updated.live.map(m=>m.id),['two']);assert.equal(updated.upcoming[0].match.id,'three');assert.equal(updated.recent[0].id,'one');
});
test('cancelled games and stale scheduled games before the current match are not next',()=>{
  const result=select([match('old','scheduled',50),match('live','live',100),match('cancelled','cancelled',200),match('next','scheduled',300)]);
  assert.deepEqual(result.upcoming.map(x=>x.match.id),['next']);assert.equal(result.recent.length,0);
});
test('unpublished and completed tournament fixtures never leak into the public waiting list',()=>{
  for(const t of [tournament('cup-a',{fixturesPublished:false}),tournament('cup-a',{fixturesPublished:undefined}),tournament('cup-a',{status:'completed'})]){
    assert.equal(select([match('hidden','scheduled',100)],[t]).upcoming.length,0);
  }
});
test('organizer-released 2026 fixtures are public and use the official event name',()=>{
  const id='5ff73034-1747-4b9e-874a-6fe19fa68ac1';
  const event=tournament(id,{name:'2026 1필드',fixturesPublished:false});
  assert.equal(publicFixtureRules.isTournamentFixturesPublic(event),true);
  assert.equal(publicFixtureRules.getTournamentDisplayName(event),'2026 제 1회 페어그라운드 혼성풋살대회');
  assert.deepEqual(select([match('event-first','scheduled',100,{tournamentId:id})],[event]).upcoming.map(x=>x.match.id),['event-first']);
  assert.equal(publicFixtureRules.isTournamentFixturesPublic(tournament('another-cup',{fixturesPublished:false})),false);
});
test('each tournament has its own next slot',()=>{
  const result=select([match('a-live','live',100),match('a-next','scheduled',200),match('b-first','scheduled',150,{tournamentId:'cup-b'})],[tournament('cup-a'),tournament('cup-b')]);
  assert.deepEqual(result.upcoming.map(x=>x.match.id),['b-first','a-next']);
});
test('ordering matches readiness notification ties and missing start times',()=>{
  const result=select([match('live','live',0,{createdAt:100}),match('next','scheduled',0,{createdAt:200}),match('later','scheduled',0,{createdAt:300})]);
  assert.equal(result.upcoming[0].match.id,'next');assert.equal(result.upcoming.length,1);
  assert.equal(select([match('live','live',100,{round:1}),match('next','scheduled',100,{round:2})]).upcoming[0].match.id,'next');
});
test('empty and all-completed schedules have no fictitious upcoming game',()=>{
  assert.deepEqual(select([]),{live:[],upcoming:[],recent:[]});
  assert.equal(select([match('finished','finished',100)]).upcoming.length,0);
});
test('scheduled time is explicitly Korean time and handles missing times',()=>{
  assert.match(scheduledMatchTime(Date.parse('2026-10-03T00:00:00Z')),/09:00/);
  assert.equal(scheduledMatchTime(0),'시간 미정');assert.equal(scheduledMatchTime(NaN),'시간 미정');
});
test('scoreboard fetch reports failures instead of treating them as an empty schedule',async()=>{
  const replies={matches:{data:[],error:null},tournaments:{data:null,error:{message:'network offline'}}};
  const load=moduleLoader({'@/config/supabase':{supabase:{from:table=>({select:async()=>replies[table]})}},'@/lib/mappers':{rowToMatch:r=>r,rowToLiveMatch:r=>r,rowToTournament:r=>r}});
  const {fetchLiveScoreSnapshot}=load('src/features/live-score/data.ts');
  await assert.rejects(fetchLiveScoreSnapshot(),/network offline/);
});
