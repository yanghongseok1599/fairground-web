import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

// 동의 기록 + 초상 홍보 동의 철회. 빈 로컬 DB 에 최소 스키마를 만들고 실제 마이그레이션을 순서대로 올린다.
const url = process.env.FAIRGROUND_TEST_DB_URL;
if (!url || !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname)) {
  throw new Error('FAIRGROUND_TEST_DB_URL must be an isolated LOCAL PostgreSQL database.');
}
const sql = (file) => readFileSync(`supabase/migrations/${file}`, 'utf8');
const db = new pg.Client({ connectionString: url }); await db.connect();
const clients = [];
async function actor(id) {
  const c = new pg.Client({ connectionString: url }); await c.connect(); clients.push(c);
  await c.query('set role authenticated');
  await c.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
  return c;
}
const V = '2026-10-15';
const required = [{ kind: 'age14', version: V, granted: true }, { kind: 'terms', version: V, granted: true }, { kind: 'privacy', version: '2026-10-15.2', granted: true }];
const portrait = (granted) => ({ kind: 'portrait', version: V, granted });
const signup = async (meta) => {
  const id = randomUUID();
  await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)', [id, `${id}@synthetic.invalid`, meta]);
  return id;
};
const consentAt = async (id) => (await db.query('select portrait_consent_at from profiles where id=$1', [id])).rows[0]?.portrait_consent_at ?? null;
const records = async (id) => (await db.query('select kind, granted, source from consent_records where user_id=$1 order by created_at, kind', [id])).rows;

try {
  await db.query(`do $$ begin
      if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
      if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
      if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
    end $$;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create type team_type_t as enum ('community');
    create table profiles(id uuid primary key, name text, phone text, email text, gender text, birth_date date,
      has_player_experience boolean, team_id uuid, card_skin text, number int default 0, number_label text,
      position text default 'ALA', photo_url text default '', profile_photo_url text default '', photo_scale numeric default 1,
      portrait_consent_at timestamptz);
    create table teams(id uuid primary key, captain_id uuid, name text, portrait_consent_at timestamptz);
    grant usage on schema public, auth to authenticated;
    grant select, update on profiles to authenticated;`);
  for (const file of ['20260615000000_handle_new_user_profile_trigger.sql', '20260829010000_support_kakao_oauth_profiles.sql',
    '20260915010000_portrait_consent_enforcement.sql', '20261003010000_inline_photo_compaction.sql']) await db.query(sql(file));
  // registration_integrity 는 다른 테이블이 많아 통째로 올릴 수 없다. 이 테스트가 다루는 트리거만 원문에서 잘라 쓴다.
  const integrity = sql('20260908030000_registration_integrity.sql');
  const preserve = integrity.slice(integrity.indexOf('create or replace function public.preserve_registration_consent'), integrity.indexOf('create table public.registration_history'));
  assert.match(preserve, /create trigger preserve_registration_consent before update on public.teams/);
  await db.query(preserve);
  await db.query(sql('20261015010000_consent_records.sql'));
  await db.query(sql('20261015020000_portrait_consent_optional.sql'));
  await db.query(sql('20261015040000_consent_privacy_document.sql'));

  await test('email signup records consents in the same transaction, with the optional item as given', async () => {
    const id = await signup({ name: '합성 회원', consents: [...required, portrait(false)] });
    assert.deepEqual((await records(id)).map((r) => `${r.kind}:${r.granted}:${r.source}`).sort(),
      ['age14:true:signup', 'portrait:false:signup', 'privacy:true:signup', 'terms:true:signup']);
    assert.equal(await consentAt(id), null);
  });
  await test('optional portrait consent at signup sets the profile from the server clock', async () => {
    const id = await signup({ name: '합성 회원', consents: [...required, portrait(true)] });
    assert.ok(Math.abs(Date.now() - (await consentAt(id)).getTime()) < 5000);
  });
  await test('signup with a broken consent bundle fails as a whole (no account without evidence)', async () => {
    for (const consents of [[required[0], required[1]], [...required.slice(0, 2), { kind: 'privacy', version: V, granted: false }],
      [...required, { kind: 'terms', version: '1999-01-01', granted: true }], [{ kind: 'age14', version: V, granted: 'yes' }]]) {
      const id = randomUUID();
      await assert.rejects(db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)', [id, { consents }]));
      assert.equal((await db.query('select count(*)::int n from profiles where id=$1', [id])).rows[0].n, 0);
    }
  });
  await test('under-14 email signup is blocked by the database; 14th birthday passes', async () => {
    const kst = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
    const [y, m, d] = kst.split('-').map(Number);
    const iso = (yy, mm, dd) => `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    const tomorrow14 = new Date(Date.UTC(y - 14, m - 1, d + 1));
    await assert.rejects(db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',
      [randomUUID(), { birth_date: tomorrow14.toISOString().slice(0, 10), consents: required }]), /under_14/);
    if (!(m === 2 && d === 29)) await signup({ birth_date: iso(y - 14, m, d), consents: required });
  });
  await test('legacy metadata (no consents array) is not blocked and records nothing', async () => {
    const id = await signup({ name: '이전 화면 가입', portrait_consent: true });
    assert.deepEqual(await records(id), []);
    assert.ok(await consentAt(id), 'cached pre-release screens keep working');
  });

  const member = await signup({ name: '소셜 회원' });
  const other = await signup({ name: '다른 회원' });
  const me = await actor(member);
  await test('card writes no longer require promotional consent', async () => {
    await me.query("update profiles set number=7, photo_url='photo' where id=$1", [member]);
    assert.equal(await consentAt(member), null);
  });
  await test('social completion records the required bundle once; partial or refused bundles are rejected', async () => {
    await assert.rejects(me.query("select record_my_consents('oauth_complete', 'ua', $1)", [JSON.stringify(required.slice(1))]), /required_consent_missing/);
    await assert.rejects(me.query("select record_my_consents('signup', 'ua', $1)", [JSON.stringify(required)]), /invalid_source/);
    assert.equal((await me.query("select record_my_consents('oauth_complete', 'ua', $1) n", [JSON.stringify([...required, portrait(false)])])).rows[0].n, 4);
    const kinds = (await me.query('select kind from my_consent_history() where granted')).rows.map((r) => r.kind).sort();
    assert.deepEqual(kinds, ['age14', 'privacy', 'terms']);
  });
  await test('consent is granted and withdrawn only through records; direct withdrawal is ignored', async () => {
    await me.query("select record_my_consents('mypage', null, $1)", [JSON.stringify([portrait(true)])]);
    const granted = await consentAt(member);
    assert.ok(granted);
    await me.query('update profiles set portrait_consent_at=null where id=$1', [member]);
    assert.equal((await consentAt(member)).getTime(), granted.getTime());
    await me.query("select record_my_consents('mypage', null, $1)", [JSON.stringify([portrait(false)])]);
    assert.equal(await consentAt(member), null);
    assert.deepEqual((await records(member)).filter((r) => r.kind === 'portrait').map((r) => r.granted), [false, true, false]);
    await me.query("update profiles set number=9 where id=$1", [member]);
  });
  await test('records are private, append-only and keep the account from cascading away', async () => {
    await assert.rejects(me.query('select * from consent_records'), /permission denied/);
    await assert.rejects(me.query("select insert_consent_items($1,'signup',null,$2)", [other, JSON.stringify(required)]), /permission denied/);
    await assert.rejects(db.query('update consent_records set granted=true'), /append-only/);
    await assert.rejects(db.query('delete from consent_records'), /purge_expired/);
    await assert.rejects(db.query('delete from auth.users where id=$1', [member]), /foreign key/);
    await assert.rejects(db.query("select purge_expired_consent_records(interval '30 days')"), /too_short/);
  });
  await test('purge keeps the latest row per kind even when it is old', async () => {
    await db.query("set session_replication_role = replica"); // 테스트 전용: guard 트리거를 끄고 시각만 과거로
    await db.query("update consent_records set created_at = created_at - interval '5 years' where user_id=$1", [member]);
    await db.query("set session_replication_role = origin");
    await db.query("select purge_expired_consent_records(interval '3 years')");
    const left = await records(member);
    assert.deepEqual(left.filter((r) => r.kind === 'portrait').map((r) => r.granted), [false]);
    assert.equal(left.filter((r) => r.kind === 'terms').length, 1);
  });
  await test('anonymous callers cannot record consents', async () => {
    const anon = new pg.Client({ connectionString: url }); await anon.connect(); clients.push(anon);
    await anon.query('set role anon');
    await assert.rejects(anon.query("select record_my_consents('mypage', null, $1)", [JSON.stringify([portrait(true)])]), /permission denied/);
  });
} finally {
  for (const c of clients) await c.end();
  await db.end();
}
