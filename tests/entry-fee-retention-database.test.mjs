import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

// 팀·대회·참가비를 지워도 납부 기록은 5년 보관함에 남는다 (전자상거래법 시행령 제6조).
// 빈 로컬 DB 에 최소 스키마를 만들고 실제 마이그레이션을 올린다. 운영·개발 DB 금지.
const url = process.env.FAIRGROUND_TEST_DB_URL;
if (!url || !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname)) {
  throw new Error('FAIRGROUND_TEST_DB_URL must be an isolated LOCAL PostgreSQL database.');
}
const sql = (file) => readFileSync(`supabase/migrations/${file}`, 'utf8');
const db = new pg.Client({ connectionString: url }); await db.connect();
const clients = [];
const as = async (role, sub = '') => {
  const c = new pg.Client({ connectionString: url }); await c.connect(); clients.push(c);
  await c.query(`set role ${role}`);
  await c.query("select set_config('request.jwt.claim.sub', $1, false)", [sub]);
  return c;
};
const kept = async (feeId) => (await db.query('select * from entry_fee_payment_records where fee_id=$1', [feeId])).rows;

try {
  await db.query(`do $$ begin
      if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
      if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
      if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
    end $$;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
    create table profiles(id uuid primary key, name text, role text default 'player');
    create table teams(id uuid primary key, name text, captain_id uuid);
    create table tournaments(id uuid primary key, name text);`);
  for (const f of ['20260827020000_tournament_entry_fees.sql', '20261015010000_consent_records.sql', '20261015030000_entry_fee_payment_retention.sql']) await db.query(sql(f));

  const admin = randomUUID(), captain = randomUUID();
  await db.query("insert into profiles(id,name,role) values($1,'운영자','admin'),($2,'김대표','player')", [admin, captain]);
  const team = async (name) => { const id = randomUUID(); await db.query('insert into teams(id,name,captain_id) values($1,$2,$3)', [id, name, captain]); return id; };
  const cup = async (name) => { const id = randomUUID(); await db.query('insert into tournaments(id,name) values($1,$2)', [id, name]); return id; };
  const fee = async (t, tm, status, paidAt = null, memo = null) => (await db.query(
    'insert into tournament_entry_fees(tournament_id,team_id,amount,status,paid_at,memo) values($1,$2,400000,$3,$4,$5) returning id',
    [t, tm, status, paidAt, memo])).rows[0].id;
  const adminDb = await as('authenticated', admin);
  await adminDb.query('grant usage on schema public to authenticated').catch(() => {});
  await db.query('grant select, delete on teams, tournaments, tournament_entry_fees to authenticated; grant select on profiles to authenticated');

  await test('deleting a team keeps its paid fee with names, while the team and fee rows are gone', async () => {
    const t = await cup('2026 혼성풋살대회'), tm = await team('합성FC');
    const paid = await fee(t, tm, 'paid', '2026-09-01T10:00:00Z', '입금자 김대표');
    const unpaid = await fee(await cup('다른 대회'), tm, 'unpaid');
    await adminDb.query('delete from teams where id=$1', [tm]);
    assert.equal((await db.query('select count(*)::int n from tournament_entry_fees where team_id=$1', [tm])).rows[0].n, 0);
    const [row] = await kept(paid);
    assert.equal(row.team_name, '합성FC'); assert.equal(row.tournament_name, '2026 혼성풋살대회'); assert.equal(row.payer_name, '김대표');
    assert.equal(row.amount, 400000); assert.equal(row.memo, '입금자 김대표'); assert.equal(row.cause, 'team_deleted');
    assert.equal(row.deleted_by, admin);
    assert.equal(row.purge_after.toISOString(), '2031-09-01T10:00:00.000Z');
    assert.deepEqual(await kept(unpaid), [], 'unpaid fees are not transactions');
  });
  await test('deleting a tournament keeps partial payments with names', async () => {
    const t = await cup('가을 리그'), tm = await team('남는팀');
    const partial = await fee(t, tm, 'partial');
    await adminDb.query('delete from tournaments where id=$1', [t]);
    const [row] = await kept(partial);
    assert.equal(row.tournament_name, '가을 리그'); assert.equal(row.team_name, '남는팀'); assert.equal(row.cause, 'tournament_deleted');
  });
  await test('a direct fee delete is retained exactly once', async () => {
    const t = await cup('직접 삭제 대회'), tm = await team('직접팀');
    const id = await fee(t, tm, 'unpaid', '2026-08-01T00:00:00Z');
    await adminDb.query('delete from tournament_entry_fees where id=$1', [id]);
    assert.equal((await kept(id)).length, 1);
    assert.equal((await kept(id))[0].cause, 'fee_deleted');
    await adminDb.query('delete from teams where id=$1', [tm]);
    assert.equal((await db.query('select count(*)::int n from entry_fee_payment_records where fee_id=$1', [id])).rows[0].n, 1);
  });
  await test('purge removes only records past purge_after', async () => {
    const t = await cup('옛 대회'), tm = await team('옛팀');
    const old = await fee(t, tm, 'paid', '2019-01-01T00:00:00Z');
    const recent = await fee(await cup('최근 대회'), tm, 'paid', '2026-01-01T00:00:00Z');
    await db.query('delete from teams where id=$1', [tm]);
    const service = await as('service_role');
    assert.equal((await service.query('select purge_expired_entry_fee_records() n')).rows[0].n, 1);
    assert.deepEqual(await kept(old), []);
    assert.equal((await kept(recent)).length, 1);
  });
  await test('anon and authenticated (even admins) cannot read or purge retained records', async () => {
    const anon = await as('anon');
    for (const c of [anon, adminDb]) {
      await assert.rejects(c.query('select * from entry_fee_payment_records'), /permission denied/);
      await assert.rejects(c.query('select purge_expired_entry_fee_records()'), /permission denied/);
      await assert.rejects(c.query("select retain_entry_fee_payments('team', gen_random_uuid())"), /permission denied/);
    }
  });
} finally {
  for (const c of clients) await c.end();
  await db.end();
}
