import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { assertLocalDatabaseUrl } from '../scripts/testing/local-database-url.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const rejected = value => assert.throws(() => assertLocalDatabaseUrl(value), {
  code: 'ERR_UNSAFE_TEST_DATABASE_URL',
});

test('local PostgreSQL URLs retain host, port, credentials and database without connecting', () => {
  for (const [url, host, database] of [
    ['postgresql://postgres@127.0.0.1:55432/fg_test_dev', '127.0.0.1', 'fg_test_dev'],
    ['postgres://member:s3cr%40t%3F%23@localhost:55433/fg%20test', 'localhost', 'fg test'],
    ['postgresql://postgres@[::1]:55434/fg_test_ipv6', '[::1]', 'fg_test_ipv6'],
    ['postgres://postgres@localhost/fg_test_default', 'localhost', 'fg_test_default'],
  ]) {
    const parsed = assertLocalDatabaseUrl(url);
    const connection = new pg.Client({ connectionString: url }).connectionParameters;
    assert.equal(parsed.hostname, host);
    assert.equal(connection.host, host);
    assert.equal(connection.database, database);
    assert.equal(connection.user, decodeURIComponent(parsed.username));
    if (parsed.password) assert.equal(connection.password, decodeURIComponent(parsed.password));
    if (parsed.port) assert.equal(connection.port, Number(parsed.port));
  }
});

test('query host overrides accepted by pg are rejected before client construction', () => {
  const url = 'postgres://postgres@127.0.0.1:55432/fg_test_dev?host=remote.invalid&port=6432';
  assert.equal(new URL(url).hostname, '127.0.0.1', 'the former hostname-only check accepted this');
  const connection = new pg.Client({ connectionString: url }).connectionParameters;
  assert.equal(connection.host, 'remote.invalid');
  assert.equal(connection.port, 6432);
  rejected(url);
});

test('parser overrides and ambiguous URLs fail closed without disclosing credentials', () => {
  for (const value of [
    undefined, null, '', new URL('postgres://localhost/db'),
    'postgres://remote.invalid/db', 'postgres://[::2]/db',
    'https://localhost/db', 'socket://localhost/tmp/socket', 'postgres:localhost/db',
    'postgres://localhost/db?host=remote.invalid',
    'postgres://localhost/db?%68ost=remote.invalid&%70ort=6432',
    'postgres://localhost/db?host=%72%65mote.invalid',
    'postgres://localhost/db?sslmode=require',
    'postgres://localhost/db?sslkey=/not-read/private-key',
    'postgres://localhost/db?options=-c%20search_path=other',
    'postgres://localhost/db?', 'postgres://localhost/db#',
    'postgres://localhost/db#?host=remote.invalid',
    ' postgres://localhost/db', 'postgres://local\thost/db',
    'postgres://local\nhost/db', 'postgres://localhost/db\u0000',
    'postgres://localhost/db\\other', 'postgres://%31%32%37.0.0.1/db',
    'postgres://postgres:secret%00@localhost/db', 'postgres://localhost/db%0a',
    'postgres://postgres:bad%xx@localhost/db',
  ]) rejected(value);
  assert.throws(() => assertLocalDatabaseUrl('postgres://postgres:unique-secret@remote.invalid/db'),
    error => !error.message.includes('unique-secret') && !error.message.includes('remote.invalid'));
});

const entries = fs.readdirSync(new URL('.', import.meta.url)).filter(name => name.endsWith('.test.mjs'))
  .map(name => ({ name, source: fs.readFileSync(new URL(name, import.meta.url), 'utf8') }))
  .map(({ name, source }) => ({ name, environment: source.match(/process\.env\.((?:FAIRGROUND_TEST_DB_URL|[A-Z_]+_TEST_DATABASE_URL))/)?.[1] }))
  .filter(({ environment }) => environment);

const childScript = `
  import pg from 'pg';
  pg.Client.prototype.connect = () => { throw new Error('UNEXPECTED_DATABASE_CONNECTION'); };
  try {
    await import(process.argv[1]);
    throw new Error('MISSING_DATABASE_URL_GUARD');
  } catch (error) {
    if (error.code !== 'ERR_UNSAFE_TEST_DATABASE_URL') throw error;
    process.stdout.write('guard-rejected');
  }
`;

test('every URL-driven DB suite rejects an override before attempting a connection', async t => {
  assert.ok(entries.some(({ name }) => name === 'next-match-ready-database.test.mjs'));
  assert.ok(!entries.some(({ name }) => name === 'local-database-url.test.mjs'), 'this remains a non-DB test');
  for (const { name, environment } of entries) await t.test(name, () => {
    for (const suffix of ['?host=remote.invalid&port=6432', '?%68ost=remote.invalid&sslmode=require', '#fragment']) {
      const result = spawnSync(process.execPath, ['--input-type=module', '-e', childScript, new URL(name, import.meta.url).href], {
        cwd: root, env: { [environment]: 'postgres://postgres@127.0.0.1:55432/fg_test_dev' + suffix },
        encoding: 'utf8', timeout: 10_000,
      });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout, 'guard-rejected');
    }
  });
});
