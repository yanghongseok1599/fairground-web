import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { typedColumns, inspectQueryColumns, diffColumns } from '../scripts/supabase/column-contract.mjs';
const catalog = { columns: [
  {kind:'relation',name:'profiles',column:'name'},
  {kind:'function',name:'get_admin_profiles',column:'name'},
],foreignKeys:[] };
test('select(*)로 숨겨진 미적용 컬럼도 타입 계약에서 차단한다', () => {
  const contract = typedColumns('export type Database = { public: { Tables: { profiles: { Row: { name: string; number_label: string } } }; Views: {} } }');
  assert.deepEqual(diffColumns(contract,[],catalog).map(x=>x.column),['number_label']);
});
test('실제 장애의 imported constant RPC projection을 찾아 차단한다', t => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'fg-column-test-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.writeFileSync(path.join(root,'tsconfig.json'),'{}');
  fs.writeFileSync(path.join(root,'columns.ts'),'export const COLUMNS = ["name", "number_label"].join(",");');
  const file=path.join(root,'app.ts');
  fs.writeFileSync(file,'import {COLUMNS} from "./columns"; supabase.rpc("get_admin_profiles",undefined,{get:true}).select(COLUMNS); supabase.from("profiles").select(dynamicColumns);');
  const result=inspectQueryColumns([file],root);
  assert.equal(result.projections[0].select,'name,number_label');
  assert.equal(result.unresolved.length,1);
  assert.deepEqual(diffColumns([],result.projections,catalog).map(x=>x.column),['number_label']);
});
test('이미 존재하는 컬럼과 정상 RPC 응답은 통과한다', () => {
  assert.deepEqual(diffColumns([], [{kind:'function',name:'get_admin_profiles',select:'display:name'}], catalog),[]);
});
test('우회 플래그는 운영·CI·로컬 어디에서도 빌드를 통과시키지 않는다', () => {
  for (const VERCEL_ENV of ['production','preview','development']) {
    const result=spawnSync(process.execPath,['scripts/supabase/check-schema-parity.mjs','--json'],{encoding:'utf8',env:{...process.env,VERCEL_ENV,FAIRGROUND_SKIP_DB_PARITY:'1'}});
    assert.equal(result.status,1);
    assert.equal(JSON.parse(result.stdout).checked,false);
  }
});
