import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(file, require, extra = {}) {
 const exports = {};
 const code = ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(code,{exports,require,URL,AbortSignal,fetch,process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://dev.example',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'public-test'}},...extra});return exports;
}
const {getMatchShareLinks} = load('src/features/match-share/links.ts',()=>{});
const links = getMatchShareLinks('https://fairground-kor.com','one',2,1);
assert.equal(links.url,'https://fairground-kor.com/share/matches/one?v=2-1');
assert.equal(links.imageUrl,'https://fairground-kor.com/share/matches/one/image?v=2-1');
assert.notEqual(getMatchShareLinks('https://fairground-kor.com','one',3,1).imageUrl,links.imageUrl);
const id='00000000-0000-0000-0000-000000000001';
let finished=true, unavailable=false;const queries=[];
const client={from(table){const filters=[];return {select(columns){queries.push({table,columns,filters});return this},eq(column,value){filters.push([column,value]);return this},async maybeSingle(){return unavailable?{data:null,error:{message:'failed'}}:{data:table==='matches'?(finished?{id,tournament_id:id,home_team_name:'홈',away_team_name:'원정',home_score:0,away_score:0,round:1}:null):{id,name:'합성 대회'},error:null}}}}};
const server=load('src/features/match-share/server/result.ts',name=>{
 if(name==='server-only')return {};
 if(name==='react')return {cache:fn=>fn};
 if(name==='@supabase/supabase-js')return {createClient:(url,key,options)=>{assert.equal(key,'public-test');assert.equal(options.auth.persistSession,false);return client}};
 return {getTournamentDisplayName:t=>t.name};
});
assert.equal(await server.getSharedMatchResult('invalid'),null);assert.equal(queries.length,0);
const result=await server.getSharedMatchResult(id);assert.equal(result.title,'홈 0 : 0 원정');
assert.ok(queries[0].filters.some(([key,value])=>key==='status'&&value==='finished'));
assert.ok(!queries.some(q=>q.table==='profiles'||q.columns==='*'));
finished=false;assert.equal(await server.getSharedMatchResult(id),null);
unavailable=true;await assert.rejects(server.getSharedMatchResult(id),/불러오지/);
console.log('경기 결과 OG 링크·수정 캐시·공개 종료 경기 조회 검증 통과');
