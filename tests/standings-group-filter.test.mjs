import assert from 'node:assert/strict';
import {test} from 'node:test';
import {moduleLoader} from './helpers/load-ts-module.mjs';
const {filterGroupStandings,seasonGroupSource}=moduleLoader()('src/features/standings/group-filter.ts');
const rows=[{teamId:'b1',points:7,rank:1},{teamId:'a1',points:5,rank:2},{teamId:'b2',points:3,rank:3},{teamId:'a2',points:0,rank:4}];
const groups=[{id:'a',name:'A조',teamIds:['a1','a2']},{id:'b',name:'B조',teamIds:['b1','b2']}];
test('조별 팀만 표시하고 승점·정렬은 보존하면서 순위를 다시 매긴다',()=>{
  assert.deepEqual(filterGroupStandings(rows,groups,'a'),[{teamId:'a1',points:5,rank:1},{teamId:'a2',points:0,rank:2}]);
  assert.deepEqual(filterGroupStandings(rows,groups,'b').map(t=>t.teamId),['b1','b2']);
  assert.equal(rows[1].rank,2);
});
test('전체 또는 사라진 조는 전체 순위로 돌아간다',()=>{
  assert.equal(filterGroupStandings(rows,groups,''),rows);
  assert.equal(filterGroupStandings(rows,[],'a'),rows);
});
test('리그 표는 다른 시즌이나 시즌 미지정 대회의 조를 섞지 않는다',()=>{
  const league={id:'league',seasonId:'current',groups,status:'ongoing',createdAt:1};
  assert.equal(seasonGroupSource([league,{...league,id:'other',seasonId:'',createdAt:99}],'current')?.id,'league');
  assert.equal(seasonGroupSource([league],'other'),undefined);
});
