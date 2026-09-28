import {test} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import pg from 'pg';
import {resetApprovedPracticeRecords} from '../scripts/ops/practice-record-reset.mjs';
const url=process.env.FAIRGROUND_TEST_DB_URL;
if(!url||new URL(url).hostname!=='127.0.0.1')throw Error('Disposable local DB required');
async function fixture(t){
 const db=new pg.Client({connectionString:url});await db.connect();await db.query('begin');t.after(async()=>{await db.query('rollback');await db.end();});
 const [admin,player,home,away,tour,match,otherTour,otherMatch,badge]=Array.from({length:9},randomUUID);
 for(const [id,name] of [[admin,'검수 관리자'],[player,'검수 선수']])await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)',[id,`${id}@synthetic.invalid`,{name,portrait_consent:true}]);
 await db.query("select set_config('app.in_end_match','1',true)");await db.query("update public.profiles set role='admin',is_approved=true where id=$1",[admin]);await db.query("select set_config('request.jwt.claim.sub',$1,true)",[admin]);
 for(const [id,name] of [[home,'검수 A'],[away,'검수 B']])await db.query('insert into public.teams(id,name,is_approved,captain_id,portrait_consent_at)values($1,$2,true,$3,now())',[id,name,admin]);
 await db.query("update public.profiles set team_id=$2,is_approved=true,number=7,photo_url='data:image/png;base64,c3ludGhldGlj',card_type='gold' where id=$1",[player,home]);
 for(const id of [tour,otherTour])await db.query("insert into public.tournaments(id,name)values($1,'합성 대회')",[id]);
 for(const [id,tr]of [[match,tour],[otherMatch,otherTour]])await db.query("insert into public.matches(id,tournament_id,home_team_id,away_team_id,home_team_name,away_team_name)values($1,$2,$3,$4,'검수 A','검수 B')",[id,tr,home,away]);
 await db.query("insert into public.badges(id,name,unlock_condition,max_progress)values($1,'검수 MOM 배지','mom>=1',1)",[badge+'-auto']);
 await db.query('select public.start_match($1)',[match]);
 for(const type of ['yellow_card','red_card','foul'])await db.query('select public.add_match_event($1,$2,$3,$4,$5)',[match,type,player,'검수 선수',home]);
 await db.query('select public.set_match_mom($1,$2)',[match,player]);await db.query('select public.end_match($1)',[match]);
 await db.query("insert into public.badges(id,name,unlock_condition,max_progress)values($1,'수동 배지','manual',1)",[badge]);await db.query('insert into public.player_badges(player_id,badge_id,is_earned,progress,earned_at)values($1,$2,true,1,now())',[player,badge]);
 const badgePairs=[{playerId:player,badgeId:badge+'-auto'}];
 const scope={tournamentIds:[tour],profileIds:[player],badgePairs};
 return {db,player,home,away,tour,match,otherTour,otherMatch,badge,scope};
}
test('연습 기록 초기화는 선수 신원·사진·대진·대회·다른 경기·수동 배지를 보존한다',async t=>{
 const f=await fixture(t);const {db}=f;
 const prior=(await db.query('select name,number,photo_url,card_type from public.profiles where id=$1',[f.player])).rows[0];
 const other=(await db.query('select * from public.matches where id=$1',[f.otherMatch])).rows[0];
 const badge=(await db.query('select * from public.player_badges where player_id=$1 and badge_id=$2',[f.player,f.badge])).rows[0];
 const result=await resetApprovedPracticeRecords(db,f.scope);assert.equal(result.counts.events,3);assert.deepEqual((await db.query('select progress,is_earned,earned_at from public.player_badges where player_id=$1 and badge_id=$2',[f.player,f.badge+'-auto'])).rows[0],{progress:0,is_earned:false,earned_at:null});assert.equal(result.counts.matches,1);
 assert.deepEqual((await db.query('select name,number,photo_url,card_type from public.profiles where id=$1',[f.player])).rows[0],prior);
 assert.deepEqual((await db.query('select * from public.matches where id=$1',[f.otherMatch])).rows[0],other);
 assert.deepEqual((await db.query('select * from public.player_badges where player_id=$1 and badge_id=$2',[f.player,f.badge])).rows[0],badge);
 assert.deepEqual((await db.query('select status,home_score,away_score,is_running,stats_applied,mom_player_id,elapsed_seconds from public.matches where id=$1',[f.match])).rows[0],{status:'scheduled',home_score:0,away_score:0,is_running:false,stats_applied:false,mom_player_id:null,elapsed_seconds:0});
 assert.deepEqual((await db.query('select games,mom,season_yellow_cards,ban_matches_remaining,is_banned,card_rating from public.profiles where id=$1',[f.player])).rows[0],{games:0,mom:0,season_yellow_cards:0,ban_matches_remaining:0,is_banned:false,card_rating:70});
 assert.equal((await db.query('select count(*)::int n from public.tournaments where id=$1',[f.tour])).rows[0].n,1);
});
test('다른 확정 경기와 통계가 섞여 있으면 변경 전에 중단한다',async t=>{const f=await fixture(t);await f.db.query("update public.matches set stats_applied=true,status='finished' where id=$1",[f.otherMatch]);await assert.rejects(resetApprovedPracticeRecords(f.db,f.scope),/Other finalized/);assert.equal((await f.db.query('select count(*)::int n from public.match_events where match_id=$1',[f.match])).rows[0].n,3);});
test('초기화 후 오류 시 트랜잭션으로 기록·집계를 함께 복원한다',async t=>{const f=await fixture(t);await f.db.query('savepoint before_reset');await resetApprovedPracticeRecords(f.db,f.scope);await f.db.query('rollback to savepoint before_reset');assert.equal((await f.db.query('select count(*)::int n from public.match_events where match_id=$1',[f.match])).rows[0].n,3);assert.equal((await f.db.query('select mom from public.profiles where id=$1',[f.player])).rows[0].mom,1);});
