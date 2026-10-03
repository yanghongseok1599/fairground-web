import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import pg from 'pg';

const url = process.env.FAIRGROUND_TEST_DB_URL;
if (!url || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)) throw new Error('An isolated local database is required');
const db = new pg.Client({ connectionString: url });
await db.connect();
const members = [randomUUID(), randomUUID()];
const clients = [];
async function actor(id, role = 'authenticated') {
  const client = new pg.Client({ connectionString: url });
  await client.connect(); clients.push(client);
  await client.query(`set session authorization ${role}`);
  await client.query("select set_config('request.jwt.claim.sub', $1, false)", [id ?? '']);
  return client;
}
try {
  for (const id of members) await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)', [id, `${id}@synthetic.invalid`, { name: '합성 서약 회원', portrait_consent: true }]);
  const self = await actor(members[0]), other = await actor(members[1]), anon = await actor(null, 'anon');
  let receipt;
  await test('anonymous API cannot read or sign', async () => {
    await assert.rejects(anon.query('select get_my_glasses_waiver()'), /permission denied/);
    await assert.rejects(anon.query("select sign_glasses_waiver('합성 서약 회원',true)"), /permission denied/);
  });
  await test('explicit consent and matching account name are required', async () => {
    await assert.rejects(self.query("select sign_glasses_waiver('다른 이름',true)"), /Signer/);
    await assert.rejects(self.query("select sign_glasses_waiver('합성 서약 회원',false)"), /Consent/);
    await assert.rejects(self.query("select sign_glasses_waiver('합성 서약 회원',null)"), /Consent/);
    assert.equal((await self.query('select get_my_glasses_waiver() value')).rows[0].value, null);
  });
  await test('receipt binds account and immutable document to server timestamp', async () => {
    receipt = (await self.query("select sign_glasses_waiver('합성 서약 회원',true) value")).rows[0].value;
    assert.equal(receipt.signer_name, '합성 서약 회원');
    assert.equal(receipt.version, '2026-10-03-v1');
    assert.ok(Math.abs(Date.now() - Date.parse(receipt.signed_at)) < 5000);
    assert.equal(receipt.player_id, undefined);
    const source = readFileSync('src/features/glasses-waiver/policy.ts', 'utf8');
    assert.deepEqual(receipt.document, [...source.matchAll(/^  "(.*)",$/gm)].map((match) => match[1]));
  });
  await test('retry and concurrent submissions preserve first signature', async () => {
    const concurrent = await actor(members[0]);
    const results = await Promise.all([self, concurrent].map((client) => client.query("select sign_glasses_waiver('합성 서약 회원',true) value")));
    for (const result of results) assert.deepEqual(result.rows[0].value, receipt);
    assert.equal((await db.query('select count(*)::int n from glasses_waivers where player_id=$1', [members[0]])).rows[0].n, 1);
  });
  await test('other account cannot retrieve signature and direct mutation is denied', async () => {
    assert.equal((await other.query('select get_my_glasses_waiver() value')).rows[0].value, null);
    for (const query of ['select * from glasses_waivers', "update glasses_waivers set signer_name='위조'", 'delete from glasses_waivers', "insert into glasses_waivers(player_id,signer_name,version,document) values(gen_random_uuid(),'위조','v1','[]')"]) {
      await assert.rejects(self.query(query), /permission denied/);
    }
    assert.deepEqual((await self.query('select get_my_glasses_waiver() value')).rows[0].value, receipt);
  });
  await test('receipt survives account name changes', async () => {
    await db.query("update profiles set name='변경된 이름' where id=$1", [members[0]]);
    assert.deepEqual((await self.query('select get_my_glasses_waiver() value')).rows[0].value, receipt);
  });
} finally {
  for (const client of clients) await client.end();
  await db.query('delete from glasses_waivers where player_id=any($1::uuid[])', [members]);
  await db.query('delete from auth.users where id=any($1::uuid[])', [members]);
  await db.end();
}
