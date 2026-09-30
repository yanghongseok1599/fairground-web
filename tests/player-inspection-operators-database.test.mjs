// Synthetic data only, in a restored local database. The whole test rolls back.
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const url = process.env.FAIRGROUND_TEST_DB_URL;
if (!url || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)) throw Error('Local synthetic DB required');
const db = new pg.Client({ connectionString: url });
await db.connect();
await db.query('begin');
const [operator, player, admin, team, event] = Array.from({ length: 5 }, randomUUID);
const asUser = async (id, role = 'authenticated') => {
  await db.query('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, true)", [id ?? '']);
  await db.query(`set local role ${role}`);
};
const denied = async (sql, args = [], pattern = /permission denied|privileged (?:profile )?columns|관리자|권한|허용/) => {
  await db.query('savepoint denied');
  try { await assert.rejects(db.query(sql, args), pattern); }
  finally { await db.query('rollback to savepoint denied'); }
};
try {
  for (const id of [operator, player, admin]) {
    await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)', [id, `${id}@example.invalid`, { name: '검인 권한 합성 사용자', portrait_consent: true }]);
  }
  await db.query("select set_config('app.in_end_match','1',true)");
  await db.query('update profiles set is_approved=true where id=any($1::uuid[])', [[operator, player, admin]]);
  await db.query("update profiles set role='admin' where id=$1", [admin]);
  await db.query("insert into teams(id,name,is_approved) values($1,'합성 검인팀',true)", [team]);
  await db.query('update profiles set team_id=$1 where id=any($2::uuid[])', [team, [player, operator]]);
  await db.query("insert into tournaments(id,name,groups) values($1,'합성 권한 대회',$2)", [event, JSON.stringify([{ teamIds: [team] }])]);
  await db.query('insert into player_inspection_operators(profile_id,granted_by) values($1,$2)', [operator, admin]);
  await db.query("select set_config('app.in_end_match','0',true)");

  await test('only admin and explicitly assigned operator have inspection access', async () => {
    for (const [id, allowed] of [[admin, true], [operator, true], [player, false]]) {
      await asUser(id);
      assert.equal((await db.query('select can_manage_player_inspections() allowed')).rows[0].allowed, allowed);
    }
    await asUser(null, 'anon');
    await denied('select can_manage_player_inspections()');
  });
  await test('operator can read, complete and cancel; participant status follows', async () => {
    await asUser(operator);
    assert.equal((await db.query('select * from get_admin_player_inspections($1)', [event])).rowCount, 2);
    assert.equal((await db.query('select set_player_inspection($1,$2,true,0) revision', [event, player])).rows[0].revision, 1);
    await asUser(player);
    assert.ok((await db.query('select checked_at from get_my_player_inspections() where tournament_id=$1', [event])).rows[0].checked_at);
    await asUser(operator);
    assert.equal((await db.query('select set_player_inspection($1,$2,false,1) revision', [event, player])).rows[0].revision, 2);
    await asUser(player);
    assert.equal((await db.query('select checked_at from get_my_player_inspections() where tournament_id=$1', [event])).rows[0].checked_at, null);
  });
  await test('operator remains a participant and gains no general admin permission', async () => {
    await asUser(operator);
    assert.equal((await db.query('select is_admin() allowed')).rows[0].allowed, false);
    await denied('select * from get_admin_profiles()');
    await denied("update profiles set role='admin' where id=$1", [operator]);
    assert.equal((await db.query("update profiles set is_approved=false where id=$1", [player])).rowCount, 0);
    await db.query('reset role');
    const row = (await db.query('select role,team_id from profiles where id=$1', [operator])).rows[0];
    assert.equal(row.role, 'player'); assert.equal(row.team_id, team);
  });
  await test('clients cannot inspect assignments, self-grant, or write inspection rows directly', async () => {
    for (const id of [player, operator, admin]) {
      await asUser(id);
      await denied('select * from player_inspection_operators');
      await denied('insert into player_inspection_operators(profile_id) values($1)', [player]);
      await denied('delete from player_inspection_operators where profile_id=$1', [operator]);
      await denied('update player_inspections set checked_at=now()');
    }
  });
  await test('revoking assignment immediately denies the next roster read and mutation', async () => {
    await db.query('reset role');
    await db.query('delete from player_inspection_operators where profile_id=$1', [operator]);
    await asUser(operator);
    assert.equal((await db.query('select can_manage_player_inspections() allowed')).rows[0].allowed, false);
    await denied('select * from get_admin_player_inspections($1)', [event]);
    await denied('select set_player_inspection($1,$2,true,2)', [event, player]);
    await asUser(admin);
    assert.equal((await db.query('select * from get_admin_player_inspections($1)', [event])).rowCount, 2);
  });
} finally { await db.query('rollback'); await db.end(); }
