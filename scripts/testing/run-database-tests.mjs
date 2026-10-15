#!/usr/bin/env node
// Each suite receives a disposable local schema clone; application env files are never loaded.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import pg from 'pg';

const root = fileURLToPath(new URL('../../', import.meta.url));
const args = process.argv.slice(2);
const option = name => {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
};
const url = new URL(option('--url') ?? 'invalid:');
assert.ok(['postgres:', 'postgresql:'].includes(url.protocol) && url.hostname === '127.0.0.1' && url.port,
  'Pass an explicit disposable 127.0.0.1 PostgreSQL URL and port with --url.');
assert.equal(url.username, 'postgres', 'Tests require the isolated cluster owner.');
assert.equal(url.pathname, '/postgres', 'The orchestration connection must use the local postgres maintenance database.');
assert.equal(url.search, '', 'Connection overrides are not accepted.');
const template = option('--template');
assert.match(template ?? '', /^fg_test_[a-z0-9_]+$/, 'Pass a dedicated schema-only database named fg_test_* with --template.');
const quote = value => '"' + value.replaceAll('"', '""') + '"';
const all = fs.readdirSync(path.join(root, 'tests')).filter(name => /\.test\.(?:mjs|ts)$/.test(name)).sort();
const databaseFiles = all.filter(name => {
  const source = fs.readFileSync(path.join(root, 'tests', name), 'utf8');
  return /process\.env\.(?:FAIRGROUND_TEST_DB_URL|[A-Z_]+_TEST_DATABASE_URL)/.test(source) || name === 'security-db-remediation.test.mjs';
});
const requested = option('--files')?.split(',');
const excluded = option('--exclude')?.split(',') ?? [];
for (const name of [...(requested ?? []), ...excluded]) assert.ok(databaseFiles.includes(name), `Unknown database test: ${name}`);
const selected = (requested ?? databaseFiles).filter(name => !excluded.includes(name));
assert.ok(selected.length, 'No database tests selected.');
const admin = new pg.Client({ connectionString: url.href });
const databases = new Set();
const results = [];
const baseEnvironment = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  !/^(?:PG|SUPABASE|NEXT_PUBLIC_|VERCEL|FAIRGROUND|FESTIVAL_SURVEY|FUTSAL_QUIZ|OPENROUTER)/.test(key)));
baseEnvironment.PATH = '/opt/homebrew/opt/postgresql@17/bin:' + (baseEnvironment.PATH ?? '');
baseEnvironment.PGOPTIONS = '-c statement_timeout=30000 -c lock_timeout=10000';
baseEnvironment.NEXT_TELEMETRY_DISABLED = '1';

const execute = (filename, environment) => new Promise(resolve => {
  const child = spawn(process.execPath, ['--experimental-strip-types', '--test', '--test-concurrency=1', path.join('tests', filename)], {
    cwd: root, env: environment, stdio: 'inherit',
  });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, 180_000);
  child.once('error', error => { clearTimeout(timer); resolve({ code: 1, error: error.message }); });
  child.once('exit', (code, signal) => { clearTimeout(timer); resolve({ code: code ?? 1, signal, timedOut }); });
});

try {
  await admin.connect();
  const server = (await admin.query("select host(inet_server_addr()) host, current_user actor, current_setting('server_version_num')::int version")).rows[0];
  assert.equal(server.host, '127.0.0.1');
  assert.equal(server.actor, 'postgres');
  assert.ok(server.version >= 170000 && server.version < 180000, 'Use the PostgreSQL 17 rehearsal cluster.');
  const templateUrl = new URL(url); templateUrl.pathname = '/' + template;
  const verify = new pg.Client({ connectionString: templateUrl.href });
  try {
    await verify.connect();
    const tables = (await verify.query("select schemaname,tablename from pg_tables where schemaname in ('public','auth','storage') order by 1,2")).rows;
    assert.ok(tables.some(row => row.schemaname === 'public' && row.tablename === 'profiles'), 'Template must contain the restored application schema.');
    for (const table of tables) {
      const identity = quote(table.schemaname) + '.' + quote(table.tablename);
      assert.equal((await verify.query(`select exists(select 1 from ${identity} limit 1) present`)).rows[0].present,
        false, `Template must be schema-only; ${identity} contains rows.`);
    }
  } finally { await verify.end(); }
  console.log(JSON.stringify({ databaseTestFiles: databaseFiles.length, selected: selected.length, excluded, template, target: 'isolated-localhost' }));
  for (const filename of selected) {
    const database = 'fg_test_run_' + randomBytes(8).toString('hex');
    const sourceTemplate = ['portrait-consent-database.test.mjs', 'futsal-quiz-database.test.mjs', 'site-consent-database.test.mjs', 'entry-fee-retention-database.test.mjs'].includes(filename) ? 'template0' : template;
    await admin.query(`create database ${quote(database)} template ${quote(sourceTemplate)}`);
    databases.add(database);
    const testUrl = new URL(url); testUrl.pathname = '/' + database;
    const environment = { ...baseEnvironment, FAIRGROUND_TEST_DB_URL: testUrl.href };
    if (filename === 'festival-survey-database.test.mjs') {
      environment.FESTIVAL_SURVEY_TEST_DATABASE_URL = testUrl.href;
      environment.FESTIVAL_SURVEY_TEST_MIGRATION_APPLIED = '1';
    } else if (filename === 'festival-survey-results-database.test.mjs') {
      environment.FESTIVAL_SURVEY_RESULTS_TEST_DATABASE_URL = testUrl.href;
      environment.FESTIVAL_SURVEY_RESULTS_TEST_MIGRATION_APPLIED = '1';
    } else if (filename === 'futsal-quiz-database.test.mjs') {
      environment.FUTSAL_QUIZ_TEST_DATABASE_URL = testUrl.href;
    }
    console.log(`Running isolated database suite: ${filename}`);
    const result = { file: filename, ...await execute(filename, environment) };
    results.push(result);
    await admin.query(`drop database ${quote(database)} with (force)`);
    databases.delete(database);
    console.log(JSON.stringify(result));
  }
  console.log(JSON.stringify({ databaseResults: results, passed: results.filter(result => result.code === 0).length, failed: results.filter(result => result.code !== 0).length }));
  if (results.some(result => result.code !== 0)) process.exitCode = 1;
} finally {
  for (const database of databases) await admin.query(`drop database ${quote(database)} with (force)`).catch(() => {});
  await admin.end();
}
