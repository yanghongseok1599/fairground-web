import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

// Synthetic fixtures commit to exercise real API roles and concurrent row
// locks. Run only on a disposable, restored local schema with the new SQL.
const url = process.env.FAIRGROUND_TEST_DB_URL;
if (!url || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)) {
  throw new Error('An isolated local database is required');
}
const clients = [];
async function connect(actor, role = 'authenticated') {
  const client = new pg.Client({ connectionString: url, ssl: false, statement_timeout: 10000 });
  await client.connect();
  clients.push(client);
  if (actor !== undefined) {
    await client.query(`set session authorization ${role}`);
    await client.query("select set_config('request.jwt.claim.sub', $1, false)", [actor ?? '']);
    assert.equal((await client.query('select current_user')).rows[0].current_user, role);
  }
  return client;
}
const db = await connect();
const label = `합성 다음 경기 알림 ${randomUUID().slice(0, 8)}`;
const actors = { referee: randomUUID(), admin: randomUUID(), unapproved: randomUUID(), player: randomUUID() };

async function addProfile({ id = randomUUID(), role = 'player', approved = true, team = null } = {}) {
  await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)', [
    id, `${id}@synthetic.invalid`, { name: label, portrait_consent: true },
  ]);
  await db.query('update public.profiles set role=$1,is_approved=$2,team_id=$3 where id=$4', [role, approved, team, id]);
  return id;
}

async function fixture({ last = false, nextOnly = false, venueWait = false, unapprovedAway = false, unapprovedLaterAway = false } = {}) {
  const f = { tournament: randomUUID(), current: randomUUID(), next: last ? null : randomUUID(), later: last || nextOnly ? null : randomUUID(), teams: Array.from({ length: 6 }, () => randomUUID()), recipients: [], excluded: [], venueRecipients: [], venueExcluded: [] };
  await db.query('begin');
  try {
    await db.query("select set_config('app.in_end_match','1',true)");
    for (const [index, team] of f.teams.entries()) {
      await db.query('insert into public.teams(id,name,is_approved,season_stats) values($1,$2,$3,$4)', [team, `${label} 팀 ${team}`, !(unapprovedAway && index === 3) && !(unapprovedLaterAway && index === 5), {}]);
    }
    await db.query('insert into public.tournaments(id,name) values($1,$2)', [f.tournament, label]);
    for (const [index, match] of [f.current, f.next, f.later].filter(Boolean).entries()) {
      await db.query(`insert into public.matches(id,tournament_id,home_team_id,away_team_id,
        home_team_name,away_team_name,status,scheduled_at,round)
        values($1,$2,$3,$4,$5,$6,'scheduled',$7,$8)`, [
        match, f.tournament, f.teams[index * 2], f.teams[index * 2 + 1],
        `${label} 홈 ${index}`, `${label} 원정 ${index}`, new Date(Date.UTC(2030, 0, 1, 0, index * 20)), index + 1,
      ]);
    }
    for (const [role, team, approved] of [
      ['player', f.teams[2], true], ['captain', f.teams[2], true],
      ['player', f.teams[3], true], ['captain', f.teams[3], true],
      ['referee', f.teams[2], true], ['admin', f.teams[3], true],
      ['player', f.teams[2], false], ['player', f.teams[0], true],
    ]) {
      const id = await addProfile({ role, team, approved });
      if (approved && ['player', 'captain'].includes(role) && [f.teams[2], f.teams[3]].includes(team)
        && !(unapprovedAway && team === f.teams[3])) f.recipients.push(id);
      else f.excluded.push(id);
    }
    if (venueWait && f.later) {
      for (const [role, team, approved] of [
        ['player', f.teams[4], true], ['player', f.teams[4], true], ['captain', f.teams[4], true],
        ['player', f.teams[5], true], ['player', f.teams[5], true], ['captain', f.teams[5], true],
        ['referee', f.teams[4], true], ['admin', f.teams[5], true], ['player', f.teams[4], false],
      ]) {
        const id = await addProfile({ role, team, approved });
        if (approved && ['player', 'captain'].includes(role) && !(unapprovedLaterAway && team === f.teams[5])) f.venueRecipients.push(id);
        else f.venueExcluded.push(id);
      }
    }
    await db.query('commit');
    return f;
  } catch (error) {
    await db.query('rollback');
    throw error;
  }
}

const start = (actor, f) => actor.query('select public.start_match($1)', [f.current]);
const timer = (actor, f, seconds) => actor.query('select public.update_match_timer($1,$2,1)', [f.current, seconds]);
const dispatch = actor => actor.query('select public.dispatch_due_next_match_ready()');
const noticeRows = async (f, match = f.next) => (await db.query(`select user_id,ready_stage,title,snippet,match_id,team_id
  from public.notifications where kind='match_ready' and match_id=$1 order by user_id,ready_stage`, [match])).rows;
async function assertStage(f, stage, expected = (stage === 'venue_wait' ? f.venueRecipients : f.recipients).length) {
  const recipients = stage === 'venue_wait' ? f.venueRecipients : f.recipients;
  const match = stage === 'venue_wait' ? f.later : f.next;
  const rows = (await noticeRows(f, match)).filter(row => row.ready_stage === stage);
  assert.equal(rows.length, expected);
  if (expected === recipients.length) assert.deepEqual(rows.map(row => row.user_id).sort(), [...recipients].sort());
  assert.ok(rows.every(row => row.match_id === match && ![...f.excluded, ...f.venueExcluded].includes(row.user_id)));
  return rows;
}
async function ageClock(f, seconds) {
  await db.query("update public.match_recording_state set clock_saved_at=clock_timestamp()-make_interval(secs=>$2) where match_id=$1", [f.current, seconds]);
}
async function captured(f) {
  return (await db.query(`select to_jsonb(m) match,to_jsonb(s) clock,
    coalesce((select jsonb_agg(to_jsonb(e) order by e.id) from public.match_events e where e.match_id=m.id),'[]'::jsonb) events,
    coalesce((select jsonb_agg(to_jsonb(r) order by r.operation_id) from public.match_recording_receipts r where r.match_id=m.id),'[]'::jsonb) receipts
    from public.matches m left join public.match_recording_state s on s.match_id=m.id where m.id=$1`, [f.current])).rows[0];
}
async function quiesce(f) {
  // Local fixture housekeeping only, without calling result finalization.
  await db.query("update public.matches set status='cancelled',is_running=false where id=$1", [f.current]);
}

try {
  await db.query('begin');
  await db.query("select set_config('app.in_end_match','1',true)");
  for (const [name, id] of Object.entries(actors)) {
    await addProfile({ id, role: name === 'admin' ? 'admin' : name === 'player' ? 'player' : 'referee', approved: name !== 'unapproved' });
  }
  await db.query('commit');
  const referee = await connect(actors.referee);
  const refereeRetry = await connect(actors.referee);
  const admin = await connect(actors.admin);
  const unapproved = await connect(actors.unapproved);
  const player = await connect(actors.player);
  const missing = await connect(randomUUID());
  const anon = await connect(null, 'anon');
  const cron = await connect();
  const cronRetry = await connect();

  await test('kickoff sends one start notice only to approved next-team players/captains', async () => {
    const f = await fixture({ venueWait: true });
    await start(referee, f);
    const rows = await assertStage(f, 'start');
    assert.ok(rows.every(row => row.title === '다음 경기 준비 안내' && row.snippet.includes('현재 경기가 시작되었습니다.') && row.snippet.includes('홈 1') && row.snippet.includes('원정 1')));
    await assertStage(f, 'five_minutes', 0);
    await assertStage(f, 'venue_wait', 0);
    assert.equal((await referee.query('select public.notify_next_match_ready($1) n', [f.current])).rows[0].n, 0);
    await start(refereeRetry, f);
    await assertStage(f, 'start');
    await quiesce(f);
  });

  await test('419 seconds does not notify; 420 and skipped/repeated timer saves send exactly one reminder', async () => {
    const f = await fixture({ venueWait: true });
    await start(referee, f);
    await timer(referee, f, 419);
    await assertStage(f, 'five_minutes', 0);
    await assertStage(f, 'venue_wait', 0);
    await timer(referee, f, 420);
    const rows = await assertStage(f, 'five_minutes');
    assert.ok(rows.every(row => row.title === '경기 종료 5분 전 · 다음 팀 준비' && row.snippet.includes('5분 이내')));
    const venueRows = await assertStage(f, 'venue_wait');
    assert.equal(venueRows.length, 6);
    assert.ok(venueRows.every(row => row.title === '다다음 경기 팀 · 구장 대기'
      && row.snippet === `현재 경기 종료까지 5분 이내입니다. 다다음 경기 ${label} 홈 2 vs ${label} 원정 2 선수들은 지금 구장 앞으로 이동해 대기해주세요.`));
    await timer(referee, f, 421);
    await dispatch(cron);
    await assertStage(f, 'five_minutes');
    await assertStage(f, 'venue_wait');
    await quiesce(f);
    const jumped = await fixture({ venueWait: true });
    await start(referee, jumped);
    await timer(referee, jumped, 419);
    await timer(referee, jumped, 425);
    await assertStage(jumped, 'five_minutes');
    await assertStage(jumped, 'venue_wait');
    await quiesce(jumped);
  });

  await test('paused 399 seconds does not advance; resumed server clock sends a browser-independent reminder', async () => {
    const f = await fixture({ venueWait: true });
    await start(referee, f);
    await timer(referee, f, 399);
    await referee.query('select public.pause_match($1)', [f.current]);
    await ageClock(f, 300);
    const before = await captured(f);
    await dispatch(cron);
    assert.deepEqual(await captured(f), before);
    await assertStage(f, 'five_minutes', 0);
    await assertStage(f, 'venue_wait', 0);
    await referee.query('select public.resume_match($1)', [f.current]);
    await ageClock(f, 22);
    const resumed = await captured(f);
    await dispatch(cron);
    await assertStage(f, 'five_minutes');
    await assertStage(f, 'venue_wait');
    assert.deepEqual(await captured(f), resumed, 'notice dispatch must not mutate the score, clock, events or receipts');
    await quiesce(f);
    const pausedAtThreshold = await fixture({ venueWait: true });
    await start(referee, pausedAtThreshold);
    await timer(referee, pausedAtThreshold, 399);
    // A pause may save the final observed second before changing is_running.
    await db.query('update public.matches set elapsed_seconds=420,is_running=false where id=$1', [pausedAtThreshold.current]);
    await assertStage(pausedAtThreshold, 'five_minutes');
    await assertStage(pausedAtThreshold, 'venue_wait');
    await quiesce(pausedAtThreshold);
  });

  await test('concurrent timer and scheduled checks never duplicate either stage', async () => {
    const f = await fixture({ venueWait: true });
    await start(referee, f);
    await timer(referee, f, 419);
    await ageClock(f, 2);
    await Promise.all([timer(referee, f, 421), dispatch(cron), dispatch(cronRetry), refereeRetry.query('select public.notify_next_match_ready($1)', [f.current])]);
    await assertStage(f, 'start');
    await assertStage(f, 'five_minutes');
    await assertStage(f, 'venue_wait');
    await quiesce(f);
  });

  await test('scheduler skips locked matches and retries after the clock transaction commits', async () => {
    const f = await fixture();
    await start(referee, f);
    await timer(referee, f, 419);
    await ageClock(f, 2);
    await db.query('begin');
    try {
      await db.query('select id from public.matches where id=$1 for update', [f.current]);
      await cron.query("set statement_timeout='1000ms'");
      await dispatch(cron);
      await assertStage(f, 'five_minutes', 0);
    } finally {
      await db.query('rollback');
      await cron.query("set statement_timeout='10000ms'");
    }
    await dispatch(cron);
    await assertStage(f, 'five_minutes');
    await quiesce(f);
  });

  await test('legacy NULL-stage readiness is preserved and counts as the first stage', async () => {
    const f = await fixture({ venueWait: true });
    await db.query(`insert into public.notifications(user_id,kind,title,snippet,match_id,ready_stage)
      values($1,'match_ready','기존 안내','기존 문구',$2,null)`, [f.recipients[0], f.next]);
    await start(referee, f);
    const startRows = (await noticeRows(f)).filter(row => row.ready_stage === 'start' || row.ready_stage === null);
    assert.equal(startRows.length, f.recipients.length);
    assert.deepEqual(startRows.find(row => row.user_id === f.recipients[0]), {
      user_id: f.recipients[0], ready_stage: null, title: '기존 안내', snippet: '기존 문구', match_id: f.next, team_id: null,
    });
    await timer(referee, f, 420);
    await assertStage(f, 'five_minutes');
    await assertStage(f, 'venue_wait');
    await quiesce(f);
  });

  await test('only approved referee/admin may use compatibility RPC; internal functions are not API-executable', async () => {
    const f = await fixture();
    assert.equal((await admin.query('select public.notify_next_match_ready($1) n', [f.current])).rows[0].n, 0, 'scheduled matches cannot be manually announced');
    for (const actor of [unapproved, player, missing, anon]) {
      await assert.rejects(actor.query('select public.notify_next_match_ready($1)', [f.current]), error => error.code === '42501');
    }
    for (const role of ['anon', 'authenticated', 'service_role']) {
      for (const signature of ['public.emit_next_match_ready(uuid,text)', 'public.notify_next_match_ready_on_clock()', 'public.dispatch_due_next_match_ready()']) {
        assert.equal((await db.query('select has_function_privilege($1,$2,\'EXECUTE\') allowed', [role, signature])).rows[0].allowed, false, `${role} ${signature}`);
      }
    }
    await assert.rejects(referee.query('select public.dispatch_due_next_match_ready()'), error => error.code === '42501');
    await assert.rejects(referee.query("select public.emit_next_match_ready($1,'five_minutes')", [f.current]), error => error.code === '42501');
    await assert.rejects(referee.query("select public.emit_next_match_ready($1,'venue_wait')", [f.current]), error => error.code === '42501');
    await start(admin, f);
    await assertStage(f, 'start');
    await quiesce(f);
  });

  await test('last fixture, unrelated teams and unapproved next team do not receive invented notices', async () => {
    const f = await fixture({ last: true });
    await start(referee, f);
    await timer(referee, f, 420);
    await dispatch(cron);
    assert.equal((await db.query("select count(*)::integer n from notifications where kind='match_ready' and user_id=any($1::uuid[])", [[...f.recipients, ...f.excluded]])).rows[0].n, 0);
    await quiesce(f);
    const unapprovedTeam = await fixture({ unapprovedAway: true });
    await start(referee, unapprovedTeam);
    await assertStage(unapprovedTeam, 'start', 2);
    await timer(referee, unapprovedTeam, 420);
    await assertStage(unapprovedTeam, 'five_minutes', 2);
    await quiesce(unapprovedTeam);
  });

  await test('fixture ordering skips stale/cancelled games and preserves rounds when start times are missing', async () => {
    const f = await fixture();
    await db.query(`update public.matches set scheduled_at=null,created_at='2030-01-01T00:00:00Z'
      where tournament_id=$1`, [f.tournament]);
    for (const [status, createdAt] of [['scheduled', '2029-12-31T23:59:00Z'], ['cancelled', '2030-01-01T00:00:00Z']]) {
      await db.query(`insert into public.matches(id,tournament_id,home_team_id,away_team_id,
        home_team_name,away_team_name,status,scheduled_at,created_at,round)
        values($1,$2,$3,$4,'선택 제외 홈','선택 제외 원정',$5,null,$6,1)`, [
        randomUUID(), f.tournament, f.teams[0], f.teams[1], status, createdAt,
      ]);
    }
    await start(referee, f);
    await assertStage(f, 'start');
    assert.equal((await db.query("select count(*)::integer n from public.notifications where kind='match_ready' and match_id=$1", [f.later])).rows[0].n, 0);
    await quiesce(f);
  });

  await test('finished, cancelled, saved 720 and server-estimated 720 clocks do not send reminders', async () => {
    for (const state of ['finished', 'cancelled', 'saved_limit', 'estimated_limit']) {
      const f = await fixture({ venueWait: true });
      await start(referee, f);
      if (state === 'finished' || state === 'cancelled') {
        await db.query('update public.matches set status=$2,is_running=false where id=$1', [f.current, state]);
        await ageClock(f, 600);
      } else if (state === 'saved_limit') {
        await timer(referee, f, 720);
      } else {
        await timer(referee, f, 419);
        await ageClock(f, 302);
      }
      await dispatch(cron);
      await assertStage(f, 'five_minutes', 0);
      await assertStage(f, 'venue_wait', 0);
      await quiesce(f);
    }
  });

  await test('shared recording start retry and independent legacy start share one notification stage', async () => {
    const f = await fixture();
    const operation = randomUUID();
    const payload = { _clockVersion: 0, _deviceId: 'synthetic-notice-device' };
    const call = actor => actor.query("select public.apply_match_recording_operation($1,$2,'start',$3)", [operation, f.current, payload]);
    await Promise.all([call(referee), call(refereeRetry)]);
    await call(referee);
    await start(refereeRetry, f);
    await assertStage(f, 'start');
    assert.equal((await db.query('select count(*)::integer n from public.match_recording_receipts where operation_id=$1', [operation])).rows[0].n, 1);
    await quiesce(f);
  });

  await test('shared end saves 420/719 observed seconds without notifying after finalization', async () => {
    for (const seconds of [420, 719]) {
      const f = await fixture({ venueWait: true });
      const started = (await referee.query("select public.apply_match_recording_operation($1,$2,'start',$3) result", [
        randomUUID(), f.current, { _clockVersion: 0, _deviceId: 'synthetic-finalization-device' },
      ])).rows[0].result;
      await assertStage(f, 'start');
      await timer(referee, f, 300);
      const result = (await referee.query("select public.apply_match_recording_operation($1,$2,'end',$3) result", [
        randomUUID(), f.current, { _clockVersion: started.clock.version, _deviceId: 'synthetic-finalization-device', _elapsedSeconds: seconds, _half: 1 },
      ])).rows[0].result;
      assert.equal(result.match.status, 'finished');
      assert.equal(result.match.elapsed_seconds, seconds);
      await assertStage(f, 'five_minutes', 0);
      await assertStage(f, 'venue_wait', 0);
      await dispatch(cron);
      await assertStage(f, 'five_minutes', 0);
      await assertStage(f, 'venue_wait', 0);
    }
  });

  await test('start/end in one transaction produce no notification for a match already finished at commit', async () => {
    const f = await fixture({ venueWait: true });
    const trigger = (await db.query(`select tgdeferrable,tginitdeferred from pg_trigger
      where tgrelid='public.matches'::regclass and tgname='next_match_ready_after_clock'`)).rows[0];
    assert.deepEqual(trigger, { tgdeferrable: true, tginitdeferred: true });
    await referee.query('begin');
    try {
      const started = (await referee.query("select public.apply_match_recording_operation($1,$2,'start',$3) result", [
        randomUUID(), f.current, { _clockVersion: 0, _deviceId: 'synthetic-batch-device' },
      ])).rows[0].result;
      assert.deepEqual(await noticeRows(f), [], 'a pending transaction cannot send kickoff notices');
      await referee.query("select public.apply_match_recording_operation($1,$2,'end',$3)", [
        randomUUID(), f.current, { _clockVersion: started.clock.version, _deviceId: 'synthetic-batch-device', _elapsedSeconds: 450, _half: 1 },
      ]);
      await referee.query('commit');
    } catch (error) {
      await referee.query('rollback');
      throw error;
    }
    assert.equal((await captured(f)).match.status, 'finished');
    assert.deepEqual(await noticeRows(f), []);
    assert.deepEqual(await noticeRows(f, f.later), []);
  });

  await test('temporary notice failure cannot reject kickoff and scheduled retry restores the missing notice', async () => {
    const f = await fixture();
    const functionName = `synthetic_notice_fail_${randomUUID().replaceAll('-', '')}`;
    await db.query(`create function public.${functionName}() returns trigger language plpgsql as $$
      begin if new.match_id='${f.next}'::uuid and new.ready_stage='start' then raise exception 'synthetic notice outage'; end if; return new; end $$`);
    await db.query(`create trigger ${functionName} before insert on public.notifications for each row execute function public.${functionName}()`);
    try {
      await start(referee, f);
      assert.equal((await captured(f)).match.status, 'live');
      await assertStage(f, 'start', 0);
    } finally {
      await db.query(`drop trigger ${functionName} on public.notifications`);
      await db.query(`drop function public.${functionName}()`);
    }
    const before = await captured(f);
    await dispatch(cron);
    await assertStage(f, 'start');
    assert.deepEqual(await captured(f), before);
    await quiesce(f);
  });

  await test('failed second-stage batch rolls back both inserts and reports no accepted notices', async () => {
    const f = await fixture();
    await start(referee, f);
    await timer(referee, f, 419);
    await ageClock(f, 2);
    await db.query("delete from public.notifications where match_id=$1 and kind='match_ready'", [f.next]);
    const functionName = `synthetic_notice_fail_${randomUUID().replaceAll('-', '')}`;
    await db.query(`create function public.${functionName}() returns trigger language plpgsql as $$
      begin if new.match_id='${f.next}'::uuid and new.ready_stage='five_minutes' then raise exception 'synthetic reminder outage'; end if; return new; end $$`);
    await db.query(`create trigger ${functionName} before insert on public.notifications for each row execute function public.${functionName}()`);
    try {
      assert.equal((await cron.query('select public.dispatch_due_next_match_ready() n')).rows[0].n, 0);
      assert.deepEqual(await noticeRows(f), []);
    } finally {
      await db.query(`drop trigger ${functionName} on public.notifications`);
      await db.query(`drop function public.${functionName}()`);
    }
    assert.equal((await cron.query('select public.dispatch_due_next_match_ready() n')).rows[0].n, f.recipients.length * 2);
    await assertStage(f, 'start');
    await assertStage(f, 'five_minutes');
    await quiesce(f);
  });

  await test('one remaining scheduled fixture still receives its reminder without inventing a venue-wait target', async () => {
    const f = await fixture({ nextOnly: true, venueWait: true });
    await start(referee, f);
    await timer(referee, f, 420);
    await dispatch(cron);
    await assertStage(f, 'start');
    await assertStage(f, 'five_minutes');
    await assertStage(f, 'venue_wait', 0);
    assert.equal((await db.query(`select count(*)::integer n from public.notifications
      where ready_stage='venue_wait' and user_id=any($1::uuid[])`, [[...f.recipients, ...f.excluded]])).rows[0].n, 0);
    await quiesce(f);
  });

  await test('venue-wait selects the second later scheduled fixture after excluding other statuses and tournaments', async () => {
    const f = await fixture({ venueWait: true });
    const excludedMatches = [];
    for (const [status, minutes] of [['scheduled', -1], ['cancelled', 10], ['finished', 25], ['live', 30]]) {
      const match = randomUUID();
      excludedMatches.push(match);
      await db.query(`insert into public.matches(id,tournament_id,home_team_id,away_team_id,
        home_team_name,away_team_name,status,scheduled_at,round,elapsed_seconds,is_running)
        values($1,$2,$3,$4,'제외 홈','제외 원정',$5,$6,1,$7,false)`, [
        match, f.tournament, f.teams[0], f.teams[1], status,
        new Date(Date.UTC(2030, 0, 1, 0, minutes)), status === 'live' ? 720 : 0,
      ]);
    }
    const otherTournament = randomUUID();
    const otherMatch = randomUUID();
    excludedMatches.push(otherMatch);
    await db.query('insert into public.tournaments(id,name) values($1,$2)', [otherTournament, `${label} 별도 대회`]);
    await db.query(`insert into public.matches(id,tournament_id,home_team_id,away_team_id,
      home_team_name,away_team_name,status,scheduled_at,round)
      values($1,$2,$3,$4,'다른 대회 홈','다른 대회 원정','scheduled','2030-01-01T00:25:00Z',1)`, [
      otherMatch, otherTournament, f.teams[4], f.teams[5],
    ]);
    await start(referee, f);
    await timer(referee, f, 420);
    await dispatch(cron);
    await assertStage(f, 'five_minutes');
    const venueRows = await assertStage(f, 'venue_wait');
    assert.ok(venueRows.every(row => row.snippet.includes(`${label} 홈 2 vs ${label} 원정 2`)));
    assert.equal((await db.query(`select count(*)::integer n from public.notifications
      where kind='match_ready' and match_id=any($1::uuid[])`, [excludedMatches])).rows[0].n, 0);
    await quiesce(f);
  });

  await test('unapproved teams and players and non-participant roles are excluded from venue-wait delivery', async () => {
    const f = await fixture({ venueWait: true, unapprovedLaterAway: true });
    await start(referee, f);
    await timer(referee, f, 420);
    await assertStage(f, 'five_minutes');
    const rows = await assertStage(f, 'venue_wait');
    assert.equal(rows.length, 3);
    assert.ok(rows.every(row => row.team_id === f.teams[4]));
    await quiesce(f);
  });

  await test('a team appearing in both future fixtures receives distinct match-specific preparation and venue messages', async () => {
    const f = await fixture({ venueWait: true });
    await db.query("update public.matches set home_team_id=$2,home_team_name='합성 공유팀' where id=$1", [f.later, f.teams[2]]);
    f.venueRecipients = (await db.query(`select id from public.profiles where is_approved=true
      and role in ('player','captain') and team_id=any($1::uuid[])`, [[f.teams[2], f.teams[5]]])).rows.map(row => row.id);
    await start(referee, f);
    await timer(referee, f, 420);
    const readyRows = await assertStage(f, 'five_minutes');
    const venueRows = await assertStage(f, 'venue_wait');
    const sharedPlayers = f.recipients.filter(id => f.venueRecipients.includes(id));
    assert.equal(sharedPlayers.length, 2);
    assert.equal(venueRows.length, 5);
    assert.ok(readyRows.every(row => row.snippet.includes(`${label} 홈 1 vs ${label} 원정 1`)));
    assert.ok(venueRows.every(row => row.snippet.includes(`합성 공유팀 vs ${label} 원정 2`)));
    for (const user of sharedPlayers) {
      assert.equal(readyRows.filter(row => row.user_id === user && row.match_id === f.next).length, 1);
      assert.equal(venueRows.filter(row => row.user_id === user && row.match_id === f.later).length, 1);
    }
    assert.equal((await cron.query('select public.dispatch_due_next_match_ready() n')).rows[0].n, 0);
    await quiesce(f);
  });

  await test('venue-wait insertion failure preserves the clock and retries the entire three-stage batch atomically', async () => {
    const f = await fixture({ venueWait: true });
    await start(referee, f);
    await timer(referee, f, 419);
    const functionName = `synthetic_venue_fail_${randomUUID().replaceAll('-', '')}`;
    await db.query(`create function public.${functionName}() returns trigger language plpgsql as $$
      begin if new.match_id='${f.later}'::uuid and new.ready_stage='venue_wait' then raise exception 'synthetic venue outage'; end if; return new; end $$`);
    await db.query(`create trigger ${functionName} before insert on public.notifications for each row execute function public.${functionName}()`);
    const beforeRecovery = async () => {
      assert.deepEqual(await noticeRows(f), []);
      assert.deepEqual(await noticeRows(f, f.later), []);
    };
    let saved;
    try {
      await timer(referee, f, 420);
      assert.equal((await captured(f)).match.elapsed_seconds, 420, 'notice errors must not reject a valid clock save');
      await assertStage(f, 'start');
      await assertStage(f, 'five_minutes', 0);
      await assertStage(f, 'venue_wait', 0);
      await db.query("delete from public.notifications where match_id=any($1::uuid[]) and kind='match_ready'", [[f.next, f.later]]);
      saved = await captured(f);
      assert.equal((await cron.query('select public.dispatch_due_next_match_ready() n')).rows[0].n, 0);
      await beforeRecovery();
      assert.deepEqual(await captured(f), saved);
    } finally {
      await db.query(`drop trigger ${functionName} on public.notifications`);
      await db.query(`drop function public.${functionName}()`);
    }
    assert.equal((await cron.query('select public.dispatch_due_next_match_ready() n')).rows[0].n, f.recipients.length * 2 + f.venueRecipients.length);
    await assertStage(f, 'start');
    await assertStage(f, 'five_minutes');
    await assertStage(f, 'venue_wait');
    assert.deepEqual(await captured(f), saved);
    assert.equal((await cron.query('select public.dispatch_due_next_match_ready() n')).rows[0].n, 0);
    await quiesce(f);
  });
} finally {
  await Promise.allSettled(clients.map(client => client.end()));
}
