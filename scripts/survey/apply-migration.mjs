#!/usr/bin/env node
// Focused application of a previously rehearsed survey migration, with preservation checks.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { verifiedDatabaseClient } from "../supabase/verified-db-client.mjs";
import { catalog, differences, hash, publicRowHashes } from "./catalog.mjs";
import { taskConfig, assertAdditivePlan } from "./task-config.mjs";
import { verifyLiveAccess } from "./live-checks.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const args = process.argv.slice(2);
const task = taskConfig(args);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const apply = args.includes("--apply");
const target = option("--environment", "development");
const refs = { development: "fhytkbjadhnmozppolrv", production: "ovtnmslyjzvghirdvife" };
assert.ok(refs[target], "Only the exact FairGround development or production target is supported.");
const ref = refs[target];
const directory = path.resolve(root,"../output/ops/"+task.evidenceDirectory,target);
const baseline = JSON.parse(fs.readFileSync(path.join(directory,"before.json"),"utf8"));
const plan = JSON.parse(fs.readFileSync(path.join(directory,"plan.json"),"utf8"));
const rehearsal = JSON.parse(fs.readFileSync(path.join(directory,"rehearsal.json"),"utf8"));
const protectedBefore = JSON.parse(fs.readFileSync(path.join(directory,"protected-before.json"),"utf8"));
for (const evidence of [baseline, plan, rehearsal]) assert.equal(evidence.target,target,"Rehearsal evidence belongs to another environment.");
if(task.name === "results") {
  assert.equal(rehearsal.task,task.name);
  assert.equal(rehearsal.version,task.version);
  assert.equal(rehearsal.syntheticFixtureRollbackVerified,true);
}
assert.equal(rehearsal.exactDefinitionAndGrantMatch,true);
assert.equal(rehearsal.rollbackVerified,true);
assert.equal(rehearsal.databaseTestsPassed,true);
assertAdditivePlan(task,plan);
const sql = fs.readFileSync(path.join(root,"supabase/migrations",task.migrationFile),"utf8");
const sqlHash = hash(sql);
assert.equal(sqlHash,plan.sqlHash,"SQL changed after the verified rehearsal.");
assert.equal(sqlHash,rehearsal.sqlHash,"SQL does not match tested source.");
const statements = sql.replace(/^begin;\s*$/gmi,"").replace(/^commit;\s*$/gmi,"");
const parseEnv = source => Object.fromEntries(source.split(/\r?\n/).flatMap(line=>{
  const m=line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if(!m)return [];
  let v=m[2].trim();
  if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);
  return [[m[1],v]];
}));
const env = parseEnv(fs.readFileSync(path.join(root,target === "development" ? ".env.development.local" : ".env.production"),"utf8"));
assert.equal(new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname,ref+".supabase.co");
let pgEnvironment = {};
if (args.includes("--linked-credentials")) {
  assert.equal(target,"production","Linked temporary credentials are reserved for the allowlisted production target.");
  assert.equal(fs.readFileSync(path.join(root,"supabase/.temp/project-ref"),"utf8").trim(),ref,"Linked CLI target is not FairGround production.");
  let dryRun;
  try { dryRun=execFileSync("supabase",["db","dump","--linked","--dry-run"],{cwd:root,encoding:"utf8",stdio:["ignore","pipe","pipe"],maxBuffer:2_000_000}); }
  catch { throw new Error("Could not obtain short-lived PostgreSQL credentials; CLI output is redacted."); }
  pgEnvironment=parseEnv(dryRun);
  assert.ok(pgEnvironment.PGHOST&&pgEnvironment.PGUSER&&pgEnvironment.PGPASSWORD&&pgEnvironment.PGDATABASE,"Temporary PostgreSQL environment is incomplete.");
}
assert.ok(env.SUPABASE_DB_URL || pgEnvironment.PGPASSWORD,"Explicit allowlisted DB credentials are required.");
const client = verifiedDatabaseClient(pg,env.SUPABASE_DB_URL ? {connectionString:env.SUPABASE_DB_URL,connectionTimeoutMillis:15000} : {host:pgEnvironment.PGHOST,port:pgEnvironment.PGPORT,user:pgEnvironment.PGUSER,password:pgEnvironment.PGPASSWORD,database:pgEnvironment.PGDATABASE,connectionTimeoutMillis:15000});
assert.ok(client.user.endsWith("."+ref)||client.host==="db."+ref+".supabase.co");
const save=(name,value)=>fs.writeFileSync(path.join(directory,name),JSON.stringify(value,null,2),{mode:0o600});
let committed=false;
try{
  await client.connect();
  await client.query("begin isolation level serializable;set local role postgres;set local statement_timeout='30s';set local lock_timeout='5s'");
  const current=await catalog(client);
  assert.deepEqual(current,baseline.objects,"Target definitions/grants changed after backup; take a fresh rehearsal.");
  assert.equal(hash(current),plan.beforeHash);
  const history=(await client.query("select * from supabase_migrations.schema_migrations order by version")).rows;
  assert.deepEqual(history,baseline.history,"Migration history changed after backup.");
  assert.ok(!history.some(row=>row.version===task.version),"Survey version already exists.");
  const tables=Object.keys(protectedBefore);
  const before=await publicRowHashes(client,tables);
  if(task.strictBackupData)assert.deepEqual(before,protectedBefore,"Existing rows changed after the reviewed backup.");
  await client.query(statements);
  const after=await catalog(client);
  assert.equal(hash(after),plan.afterHash,"Applied catalog differs from the exact rehearsed plan.");
  const diff=differences(current,after);
  assert.deepEqual(diff.added,plan.added);
  assertAdditivePlan(task,diff);
  const access=await verifyLiveAccess(client,task);
  const preserved=await publicRowHashes(client,tables);
  assert.deepEqual(preserved,before,"Existing public table rows changed.");
  await client.query("insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3::text[])",[task.version,task.migrationName,[sql]]);
  const newHistory=(await client.query("select * from supabase_migrations.schema_migrations order by version")).rows;
  assert.equal(newHistory.length,history.length+1);
  assert.deepEqual(newHistory.filter(row=>row.version!==task.version),history,"Existing migration history changed.");
  await client.query("notify pgrst,'reload schema'");
  const receipt={task:task.name,target,mode:apply?"applied":"verified-and-rolled-back",sqlHash,beforeHash:hash(current),afterHash:hash(after),addedObjects:diff.added.length,existingObjectsChanged:0,existingTableRowsPreserved:tables.length,oldHistoryPreserved:history.length,newHistoryCount:newHistory.length,newVersion:task.version,...access,transactionSnapshotRowHashesPreserved:true,concurrentSubmissionsAllowed:!task.strictBackupData,productionMutation:apply&&target==="production"};
  save("application-precommit.json",{checkedAt:new Date().toISOString(),...receipt});
  await client.query(apply?"commit":"rollback");committed=apply;
  await client.query("begin read only;set local role postgres");
  assert.equal(hash(await catalog(client)),apply?plan.afterHash:plan.beforeHash);
  if(task.strictBackupData)assert.deepEqual(await publicRowHashes(client,tables),before);
  if(apply&&task.name==="submission")assert.equal((await client.query("select count(*)::int count from public.festival_survey_responses")).rows[0].count,0);
  const verifiedHistory=(await client.query("select * from supabase_migrations.schema_migrations order by version")).rows;
  assert.deepEqual(verifiedHistory,apply?newHistory:history);
  await client.query("rollback");
  save(apply?"applied.json":"application-dry-run.json",{checkedAt:new Date().toISOString(),...receipt});console.log(JSON.stringify(receipt));
}catch(error){
  await client.query("rollback").catch(()=>{});
  save("application-failed.json",{target,message:error.message,code:error.code,committed,time:new Date().toISOString(),productionMutation:committed&&target==="production"});
  console.error("Focused survey application failed; inspect private application-failed.json.");process.exitCode=1;
}finally{await client.end().catch(()=>{});}
