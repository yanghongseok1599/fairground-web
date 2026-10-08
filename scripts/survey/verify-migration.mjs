#!/usr/bin/env node
// Schema-only remote reads and disposable PG17 rehearsal; never applies hosted SQL.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { rootCertificates } from "node:tls";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { verifiedDatabaseClient } from "../supabase/verified-db-client.mjs";
import { catalog, differences, hash, quote } from "./catalog.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const target = option("--environment", "development");
const refs = { development: "fhytkbjadhnmozppolrv", production: "ovtnmslyjzvghirdvife" };
assert.ok(refs[target], "Only FairGround development or production may be inspected.");
const output = path.resolve(option("--output", path.join(root, "../output/ops/2026-10-08-festival-survey", target)));
assert.ok(!output.startsWith(root + path.sep), "Keep private backup evidence outside the Git checkout.");
const migration = path.join(root, "supabase/migrations/20261008010000_festival_survey.sql");
const testFile = path.join(root, "tests/festival-survey-database.test.mjs");
const pgBin = "/opt/homebrew/opt/postgresql@17/bin";
const save = (name, data) => fs.writeFileSync(path.join(output, name), JSON.stringify(data, null, 2), { mode: 0o600 });
const parseEnvText = source => Object.fromEntries(source.split(/\r?\n/).flatMap(line => {
  const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!match) return [];
  let value = match[2].trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
  else value = value.replace(/\s+#.*$/, "");
  return [[match[1], value]];
}));
const parseEnv = file => parseEnvText(fs.readFileSync(file, "utf8"));

const freePort = () => new Promise((resolve,reject) => {
  const server = net.createServer(); server.once("error",reject);
  server.listen(0,"127.0.0.1",() => { const port=server.address().port; server.close(() => resolve(port)); });
});

fs.mkdirSync(output, { recursive: true, mode: 0o700 });
const privateDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "fg-survey-rehearsal-"));
fs.chmodSync(privateDirectory, 0o700);
process.once("exit", () => fs.rmSync(privateDirectory,{recursive:true,force:true}));
const env = parseEnv(path.join(root, target === "development" ? ".env.development.local" : ".env.production"));
assert.equal(new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname, refs[target] + ".supabase.co", "Public URL must match the exact requested FairGround target.");
const externalPg = option("--pg-env-file", null);
let pgEnvironment = externalPg ? JSON.parse(fs.readFileSync(externalPg, "utf8")) : {};
if (args.includes("--linked-credentials")) {
  assert.equal(target,"production","Linked short-lived credentials are only needed for production reads.");
  assert.equal(fs.readFileSync(path.join(root,"supabase/.temp/project-ref"),"utf8").trim(),refs.production,"Linked CLI target is not FairGround production.");
  let dryRun;
  try {
    dryRun = execFileSync("supabase",["db","dump","--linked","--dry-run"],{cwd:root,encoding:"utf8",stdio:["ignore","pipe","pipe"],maxBuffer:2_000_000});
  } catch {
    throw new Error("Could not obtain short-lived PostgreSQL credentials; CLI output is redacted.");
  }
  pgEnvironment = parseEnvText(dryRun);
  assert.ok(pgEnvironment.PGHOST && pgEnvironment.PGUSER && pgEnvironment.PGPASSWORD && pgEnvironment.PGDATABASE,"CLI dry-run did not return a complete temporary PostgreSQL environment.");
}
const remote = verifiedDatabaseClient(pg, env.SUPABASE_DB_URL ? { connectionString: env.SUPABASE_DB_URL, connectionTimeoutMillis: 15000 } : { ...Object.fromEntries(Object.entries({ host:pgEnvironment.PGHOST,port:pgEnvironment.PGPORT,user:pgEnvironment.PGUSER,password:pgEnvironment.PGPASSWORD,database:pgEnvironment.PGDATABASE }).filter(([,v])=>v)), connectionTimeoutMillis:15000 });
assert.ok(remote.user.endsWith("." + refs[target]) || remote.host === "db." + refs[target] + ".supabase.co", "DB connection must match the exact requested FairGround ref.");
const ca = path.join(privateDirectory,"trusted-ca.pem");
fs.writeFileSync(ca,[...rootCertificates,fs.readFileSync(path.join(root,"scripts/supabase/certificates/supabase-ca-2021.crt"),"utf8")].join("\n"),{mode:0o600});
const dumpEnvironment = { ...process.env, PGHOST:remote.host,PGPORT:String(remote.port),PGUSER:remote.user,PGPASSWORD:remote.password,PGDATABASE:remote.database,PGSSLMODE:"verify-full",PGSSLROOTCERT:ca };
const archive = path.join(output,"before.dump");
const run = (program, commandArgs, runtimeEnv = process.env) => execFileSync(program,commandArgs,{env:runtimeEnv,encoding:"utf8",stdio:["ignore","pipe","pipe"],maxBuffer:20_000_000});
let local;
let started = false;
try {
  await remote.connect();
  await remote.query("begin read only; set local role postgres; set local statement_timeout='30s'");
  const before = await catalog(remote);
  const roles = (await remote.query("select rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls from pg_roles where rolname !~ '^pg_' order by rolname")).rows;
  const history = (await remote.query("select * from supabase_migrations.schema_migrations order by version")).rows;
  const protectedRows = {};
  const tables = (await remote.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows;
  for (const {tablename} of tables) protectedRows[tablename] = (await remote.query(`select count(*)::int count,md5(coalesce(string_agg(h,'' order by h),'')) hash from (select md5(to_jsonb(r)::text) h from public.${quote(tablename)} r) q`)).rows[0];
  await remote.query("rollback");
  save("before.json",{target,schemaHash:hash(before),objects:before,history});
  save("protected-before.json",protectedRows);
  run(path.join(pgBin,"pg_dump"),["--role=postgres","--format=custom","--schema-only","--schema=public","--schema=auth","--schema=storage","--schema=extensions","--schema=supabase_migrations","--file",archive],dumpEnvironment);
  fs.chmodSync(archive,0o600);
  assert.ok(fs.statSync(archive).size > 1000,"Schema archive is empty.");
  const toc = run(path.join(pgBin,"pg_restore"),["--list",archive]);
  fs.writeFileSync(path.join(output,"archive-list.txt"),toc,{mode:0o600});
  const filteredToc = toc.split("\n").filter(line => !/\bEXTENSION\b/.test(line) && !/ SCHEMA - (?:public|extensions) /.test(line));
  const tocFile = path.join(privateDirectory,"restore-list.txt");
  fs.writeFileSync(tocFile,filteredToc.join("\n"),{mode:0o600});
  const cluster = path.join(privateDirectory,"cluster");
  run(path.join(pgBin,"initdb"),["-D",cluster,"-U","postgres","--auth=trust","--no-locale","--encoding=UTF8"]);
  const port = await freePort();
  run(path.join(pgBin,"pg_ctl"),["-D",cluster,"-l",path.join(privateDirectory,"postgres.log"),"-o",`-p ${port} -h 127.0.0.1 -k ${privateDirectory}`,"-w","start"]);
  started = true;
  const localUrl = `postgresql://postgres@127.0.0.1:${port}/postgres`;
  local = new pg.Client({connectionString:localUrl}); await local.connect();
  for (const role of roles) if (role.rolname !== "postgres") await local.query(`create role ${quote(role.rolname)} ${role.rolsuper?'superuser':'nosuperuser'} ${role.rolinherit?'inherit':'noinherit'} ${role.rolcreaterole?'createrole':'nocreaterole'} ${role.rolcreatedb?'createdb':'nocreatedb'} ${role.rolcanlogin?'login':'nologin'} ${role.rolreplication?'replication':'noreplication'} ${role.rolbypassrls?'bypassrls':'nobypassrls'}`);
  // Hosted extension objects are omitted by pg_dump; restore the available functions they require.
  await local.query('create schema extensions; create extension if not exists pgcrypto with schema extensions; create extension if not exists "uuid-ossp" with schema extensions; create extension if not exists pg_trgm with schema extensions');
  const restoreEnvironment = { ...process.env,PGHOST:"127.0.0.1",PGPORT:String(port),PGUSER:"postgres",PGDATABASE:"postgres",PGPASSWORD:"",PGSSLMODE:"disable" };
  run(path.join(pgBin,"pg_restore"),["--exit-on-error","--use-list",tocFile,"--dbname","postgres",archive],restoreEnvironment);
  const restored = await catalog(local);
  const restoreDiff = differences(before,restored);
  save("restore-diff.json",restoreDiff);
  assert.equal(restoreDiff.added.length+restoreDiff.removed.length+restoreDiff.changed.length,0,"Restored definitions/grants do not exactly match target; inspect private restore-diff.json.");
  const sql = fs.readFileSync(migration,"utf8");
  const sqlHash = hash(sql);
  // Keep the exact source hash; own the transaction while executing its identical DDL.
  const statements = sql.replace(/^begin;\s*$/gmi, "").replace(/^commit;\s*$/gmi, "");
  await local.query("begin"); await local.query(statements);
  const planned = await catalog(local);
  const diff = differences(restored,planned);
  save("plan.json",{target,file:path.basename(migration),sqlHash,beforeHash:hash(restored),afterHash:hash(planned),...diff});
  assert.equal(diff.removed.length,0,"Additive survey migration removes existing objects.");
  assert.equal(diff.changed.length,0,"Additive survey migration modifies existing definitions/grants.");
  assert.ok(diff.added.length>0,"Migration added no objects.");
  assert.ok(diff.added.every(row=>row.identity.includes("festival_survey")||row.identity.includes("submit_festival_survey")),"Migration unexpectedly adds objects outside survey scope.");
  await local.query("rollback"); assert.deepEqual(await catalog(local),restored,"Transaction rollback did not restore exact catalog.");
  await local.query(sql);
  const testOutput = run(process.execPath,[testFile],{...process.env,FESTIVAL_SURVEY_TEST_DATABASE_URL:localUrl,FESTIVAL_SURVEY_TEST_MIGRATION_APPLIED:"1"});
  fs.writeFileSync(path.join(output,"database-tests.txt"),testOutput,{mode:0o600});
  const report = {target,checkedAt:new Date().toISOString(),hostedMutation:false,archiveBytes:fs.statSync(archive).size,archiveHash:hash(fs.readFileSync(archive)),restoredObjects:restored.length,exactDefinitionAndGrantMatch:true,existingObjectsChanged:0,addedObjects:diff.added.length,sqlHash,rollbackVerified:true,databaseTestsPassed:true,historyPreserved:true};
  save("rehearsal.json",report); fs.rmSync(path.join(output,"failed.json"),{force:true}); console.log(JSON.stringify(report));
} catch (error) {
  save("failed.json",{target,time:new Date().toISOString(),message:error.message,code:error.code,position:error.position,internalPosition:error.internalPosition,where:error.where,stderr:error.stderr ? String(error.stderr).slice(0,3000) : undefined,hostedMutation:false});
  console.error("Survey rehearsal failed. Inspect private failed.json; no hosted migration applied.");
  process.exitCode=1;
} finally {
  await local?.end().catch(()=>{}); await remote.end().catch(()=>{});
  if(started) { try { run(path.join(pgBin,"pg_ctl"),["-D",path.join(privateDirectory,"cluster"),"-m","immediate","-w","stop"]); } catch { process.exitCode=1; } }
  fs.rmSync(privateDirectory,{recursive:true,force:true});
}
