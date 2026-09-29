import assert from 'node:assert/strict';import test from 'node:test';import fs from 'node:fs';import ts from 'typescript';
const source=fs.readFileSync('src/lib/jersey-number.ts','utf8');
const mod=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText).toString('base64'));
const {parseJerseyNumber:parse,jerseyNumberText:text,hasJerseyNumber:has,jerseyNumberOrder:order,lineupJerseyNumberText:lineup}=mod;
test('0 and 00 survive serialization as distinct registered numbers',()=>{
 for(const input of ['0','00','1','9','10','99']) {const value=JSON.parse(JSON.stringify(parse(input)));assert.equal(text(value),input);assert.ok(has(value));}
 assert.notDeepEqual(parse('0'),parse('00'));
});
test('unset and malformed numbers never become registered zero',()=>{
 for(const value of ['', '000','01','100','-1','1.5','1e1',' 0','0 ','가','０'])assert.equal(parse(value),null,value);
 for(const value of [{number:0},{number:null},{number:NaN},{number:100},{number:0,numberLabel:'000'}])assert.equal(has(value),false);
});
test('explicit zero sorts before positives; legacy zero remains last',()=>{
 assert.equal(order(parse('00')),0);assert.equal(order(parse('0')),0);assert.ok(order({number:0})>order(parse('99')));
});
test('lineup snapshots preserve 00 and do not depend on changed profile numbers',()=>{
 assert.equal(lineup({jerseyNumber:0,jerseyNumberLabel:'00'}),'00');assert.equal(lineup({jerseyNumber:0}),'0');assert.equal(lineup({}),'—');
});
// Exercise the actual profile serialization boundary, not a copied implementation.
const mapper=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(fs.readFileSync('src/lib/mappers.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText).toString('base64'));
test('profile patch and read roundtrip preserves zero labels; positive clears stale label',()=>{
 for(const input of ['0','00','27']) {
  const row=mapper.playerPatchToRow(parse(input));
  const player=mapper.rowToPublicPlayer({...row,id:'synthetic',created_at:new Date().toISOString()});assert.equal(text(player),input);
 }
 assert.deepEqual(mapper.playerPatchToRow({number:8,numberLabel:'00'}),{number:8,number_label:null});
 assert.deepEqual(mapper.playerPatchToRow({name:'선수'}),{name:'선수'});
});
const {moduleLoader,storeFixture}=await import('./helpers/load-ts-module.mjs');
const {hasCompletedPlayerCardSetup}=moduleLoader()('src/lib/player-onboarding.ts');
test('0 and 00 finish onboarding; legacy unset zero does not',()=>{
 const base={name:'합성 선수',position:'ALA',portraitConsentAt:1000};
 assert.equal(hasCompletedPlayerCardSetup({...base,number:0}),false);
 for(const n of ['0','00'])assert.equal(hasCompletedPlayerCardSetup({...base,...parse(n)}),true);
});
test('actual registration and card-edit stores send and reload the label',async()=>{
 for(const label of ['0','00']){
  const f=storeFixture(),row={id:'player-1',name:'합성 선수',number:0,number_label:label,position:'ALA',portrait_consent_at:'2026-09-29T00:00:00Z',created_at:'2026-01-01'};
  f.responses.push({data:{...row,number:9,number_label:null},error:null},{data:{id:'player-1'},error:null},{data:row,error:null});
  await f.auth.getState().createPlayer({name:'합성 선수',position:'ALA',...parse(label),portraitConsentAt:1000});
  assert.equal(text(f.auth.getState().player),label);
  const write=f.requests.flatMap(r=>r.steps).find(([method])=>method==='update')[1];assert.equal(write.number,0);assert.equal(write.number_label,label);
  f.responses.push({data:{id:'player-1'},error:null},{data:{...row,number_label:label==='0'?'00':'0'},error:null});
  await f.auth.getState().updatePlayer(parse(label==='0'?'00':'0'));assert.equal(text(f.auth.getState().player),label==='0'?'00':'0');
 }
});
