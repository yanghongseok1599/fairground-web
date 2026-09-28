import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { deleteApprovedScheduledFixtures } from '../scripts/ops/delete-scheduled-fixtures.mjs';

const url = process.env.FAIRGROUND_TEST_DB_URL;
if (!url || new URL(url).hostname !== '127.0.0.1') throw Error('Disposable local DB required');

async function fixture(t) {
  const db = new pg.Client({ connectionString: url });
  await db.connect(); await db.query('begin');
  t.after(async () => { await db.query('rollback'); await db.end(); });
  const [admin, home, away, tournament, match, other] = Array.from({ length: 6 }, randomUUID);
  await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)',
    [admin, `${admin}@synthetic.invalid`, { name: '검수 관리자', portrait_consent: true }]);
  await db.query("select set_config('app.in_end_match','1',true)");
  await db.query("update public.profiles set role='admin',is_approved=true where id=$1", [admin]);
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [admin]);
  for (const [id, name] of [[home, '검수 A'], [away, '검수 B']]) {
    await db.query('insert into public.teams(id,name,is_approved,captain_id,portrait_consent_at) values($1,$2,true,$3,now())', [id, name, admin]);
  }
  await db.query('update public.profiles set team_id=$2 where id=$1', [admin, home]);
  await db.query("insert into public.tournaments(id,name) values($1,'합성 대회')", [tournament]);
  for (const id of [match, other]) {
    await db.query("insert into public.matches(id,tournament_id,home_team_id,away_team_id,home_team_name,away_team_name) values($1,$2,$3,$4,'검수 A','검수 B')", [id, tournament, home, away]);
  }
  return { db, admin, home, tournament, match, other };
}

test('확인한 예정 경기만 삭제하고 선수·팀·대회·다른 대진을 보존한다', async t => {
  const f = await fixture(t);
  const before = {};
  for (const table of ['profiles', 'teams', 'tournaments']) before[table] = (await f.db.query(`select to_jsonb(t) row from public.${table} t order by to_jsonb(t)::text`)).rows;
  const other = (await f.db.query('select * from public.matches where id=$1', [f.other])).rows;
  assert.equal((await deleteApprovedScheduledFixtures(f.db, [f.match])).deleted, 1);
  assert.deepEqual((await f.db.query('select * from public.matches where id=$1', [f.other])).rows, other);
  for (const table of Object.keys(before)) assert.deepEqual((await f.db.query(`select to_jsonb(t) row from public.${table} t order by to_jsonb(t)::text`)).rows, before[table]);
});

test('진행된 경기 또는 변경된 삭제 범위는 거절한다', async t => {
  const f = await fixture(t);
  await assert.rejects(deleteApprovedScheduledFixtures(f.db, [f.match, randomUUID()]), /scope changed/);
  await f.db.query('select public.start_match($1)', [f.match]);
  await assert.rejects(deleteApprovedScheduledFixtures(f.db, [f.match]), /started/);
  assert.equal((await f.db.query('select 1 from public.matches where id=$1', [f.match])).rowCount, 1);
});

test('연결 기록을 연쇄 삭제하지 않고 중단한다', async t => {
  const f = await fixture(t);
  await f.db.query('select public.start_match($1)', [f.match]);
  await f.db.query('select public.add_match_event($1,$2,$3,$4,$5)', [f.match, 'foul', f.admin, '검수 관리자', f.home]);
  await f.db.query("update public.matches set status='scheduled',is_running=false,elapsed_seconds=0 where id=$1", [f.match]);
  await assert.rejects(deleteApprovedScheduledFixtures(f.db, [f.match]), /Linked data/);
});

test('삭제 후 오류가 나면 트랜잭션에서 대진을 복구한다', async t => {
  const f = await fixture(t);
  const before = (await f.db.query('select * from public.matches where id=$1', [f.match])).rows;
  await f.db.query('savepoint before_delete');
  await deleteApprovedScheduledFixtures(f.db, [f.match]);
  await f.db.query('rollback to savepoint before_delete');
  assert.deepEqual((await f.db.query('select * from public.matches where id=$1', [f.match])).rows, before);
});
