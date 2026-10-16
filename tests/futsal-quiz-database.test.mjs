import { assertLocalDatabaseUrl } from '../scripts/testing/local-database-url.mjs';
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

// Explicit local-only test target. Never load application env or connect to a remote DB.
const url = process.env.FUTSAL_QUIZ_TEST_DATABASE_URL;
assertLocalDatabaseUrl(url);
const client = new Client({ connectionString: url, statement_timeout: 10000 });
const attemptIds = [];
const nextId = () => { const id = randomUUID(); attemptIds.push(id); return id; };
let checks = 0;
const equal = (...args) => { assert.equal(...args); checks++; };
const deepEqual = (...args) => { assert.deepEqual(...args); checks++; };
const ok = (...args) => { assert.ok(...args); checks++; };
const rejects = async (run, expected) => { await assert.rejects(run, expected); checks++; };
const invalid = (message) => (error) => error.code === "22023" && message.test(error.message);
const submitSql = "select * from public.register_futsal_quiz_result($1,$2,$3,$4)";
const key = [1, 2, 0, 3, 1, 0, 2, 3, 1, 2];
const wrong = key.map((answer) => (answer + 1) % 4);
const submit = (id, name, answers, version = "2026-01") => client.query(submitSql, [id, name, answers, version]);

await client.connect();
try {
  const applied = process.env.FUTSAL_QUIZ_TEST_MIGRATION_APPLIED === "1";
  const existing = (await client.query("select to_regclass('public.futsal_quiz_results') as existing")).rows[0].existing;
  if (applied) ok(existing, "Rehearsal must apply the exact quiz migration first.");
  else {
    equal(existing, null, "Use a fresh disposable database or explicit applied-migration mode.");
    await client.query(`do $$ begin
      if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
      if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
    end $$;`);
    await client.query(await fs.readFile(new URL("../supabase/migrations/20260911000000_futsal_quiz.sql", import.meta.url), "utf8"));
  }
  equal((await client.query("select count(*)::integer as count from public.futsal_quiz_results")).rows[0].count, 0,
    "Quiz tests require an empty synthetic results table, including in applied-migration mode.");
  equal((await client.query("select relrowsecurity from pg_class where oid='public.futsal_quiz_results'::regclass")).rows[0].relrowsecurity, true);
  equal((await client.query("select count(*)::integer as count from pg_policies where schemaname='public' and tablename='futsal_quiz_results'")).rows[0].count, 0);
  equal((await client.query(`select count(*)::integer as count from pg_class c,
    lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
    where c.oid='public.futsal_quiz_results'::regclass and a.grantee=0`)).rows[0].count, 0,
  "PUBLIC must not inherit table access from default privileges.");
  for (const signature of ["public.get_futsal_quiz_leaderboard(text)", "public.register_futsal_quiz_result(uuid,text,integer[],text)"]) {
    equal((await client.query(`select count(*)::integer as count from pg_proc p,
      lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      where p.oid=$1::regprocedure and a.grantee=0`, [signature])).rows[0].count, 0);
    for (const role of ["anon", "authenticated"]) {
      equal((await client.query("select has_function_privilege($1,$2,'EXECUTE') allowed", [role, signature])).rows[0].allowed, true);
    }
  }

  for (const role of ["anon", "authenticated"]) {
    await client.query(`set role ${role}`);
    for (const sql of [
      "select * from public.futsal_quiz_results",
      "insert into public.futsal_quiz_results values (gen_random_uuid(),'2026-01','위조',array[0,0,0,0,0,0,0,0,0,0],10,now())",
      "update public.futsal_quiz_results set correct_count=10",
      "delete from public.futsal_quiz_results",
      "truncate public.futsal_quiz_results",
    ]) await rejects(() => client.query(sql), (error) => error.code === "42501");
    await client.query("reset role");
  }

  await client.query("set role anon");
  equal((await submit(nextId(), "유망주", wrong)).rows[0].correct_count, 0);
  const firstId = nextId();
  equal((await submit(firstId, "테스트왕", key)).rows[0].correct_count, 10);
  await submit(nextId(), "동점선수", key);
  await submit(firstId, "테스트왕", key); // Network retries remain idempotent.
  let ranking = (await client.query("select * from public.get_futsal_quiz_leaderboard('2026-01')")).rows;
  equal(ranking.length, 3);
  deepEqual(ranking.map((row) => Number(row.rank)), [1, 1, 3]);
  ok(ranking.every((row) => Number(row.total_records) === 3));
  deepEqual(Object.keys(ranking[0]).sort(), ["correct_count", "id", "nickname", "rank", "total_records"]);
  await rejects(() => submit(firstId, "바꾼이름", wrong), invalid(/already registered/));
  for (const answers of [null, [], [1], [...key, 0], [null, ...key.slice(1)], [4, ...key.slice(1)], [-1, ...key.slice(1)], [key.slice(0, 5), key.slice(5)]]) {
    await rejects(() => submit(nextId(), "검증선수", answers), invalid(/valid answers/));
  }
  await rejects(() => client.query("select * from public.register_futsal_quiz_result($1,'검증선수','[0:9]={1,2,0,3,1,0,2,3,1,2}'::integer[],'2026-01')", [nextId()]), invalid(/valid answers/));
  await rejects(() => submit(nextId(), "정상선수", key, "old"), invalid(/version/));
  await rejects(() => submit(nextId(), "정상선수", key, null), invalid(/version/));
  await rejects(() => submit(null, "정상선수", key), invalid(/attempt/));
  for (const name of [null, "", " ", "A", "<script>", "가".repeat(13)]) {
    await rejects(() => submit(nextId(), name, key), invalid(/nickname/));
  }
  equal((await client.query("select * from public.get_futsal_quiz_leaderboard('unknown')")).rows.length, 0);
  await client.query("set role authenticated");
  equal((await submit(nextId(), "로그인선수", key)).rows[0].correct_count, 10);
  ranking = (await client.query("select * from public.get_futsal_quiz_leaderboard('2026-01')")).rows;
  deepEqual(ranking.map((row) => Number(row.rank)), [1, 1, 1, 4]);
  await client.query("reset role");

  const original = (await client.query("select * from public.futsal_quiz_results where id=$1", [firstId])).rows[0];
  await client.query("set role anon");
  await submit(firstId, "  테스트왕  ", key);
  await client.query("reset role");
  deepEqual((await client.query("select * from public.futsal_quiz_results where id=$1", [firstId])).rows[0], original);

  // Independent requests with the same UUID serialize to one immutable result.
  const connections = [new Client({ connectionString: url, statement_timeout: 10000 }), new Client({ connectionString: url, statement_timeout: 10000 })];
  try {
    await Promise.all(connections.map(async connection => { await connection.connect(); await connection.query("set role anon"); }));
    const concurrentId = nextId();
    const replies = await Promise.all(connections.map(connection => connection.query(submitSql, [concurrentId, "동시요청", key, "2026-01"])));
    ok(replies.every(reply => reply.rows[0].id === concurrentId && reply.rows[0].correct_count === 10));
    equal((await client.query("select count(*)::integer as count from public.futsal_quiz_results where id=$1", [concurrentId])).rows[0].count, 1);
    const conflictingId = nextId();
    const conflicts = await Promise.allSettled(connections.map((connection, i) => connection.query(submitSql, [conflictingId, "충돌요청", i === 0 ? key : wrong, "2026-01"])));
    equal(conflicts.filter(reply => reply.status === "fulfilled").length, 1);
    const rejected = conflicts.find(reply => reply.status === "rejected");
    ok(rejected && invalid(/already registered/)(rejected.reason));
    const saved = (await client.query("select answers,correct_count from public.futsal_quiz_results where id=$1", [conflictingId])).rows;
    equal(saved.length, 1);
    const accepted = conflicts.find(reply => reply.status === "fulfilled").value.rows[0];
    equal(saved[0].correct_count, accepted.correct_count);
    deepEqual(saved[0].answers, accepted.correct_count === 10 ? key : wrong);
  } finally { await Promise.all(connections.map(connection => connection.end())); }
  console.log(`Quiz database: ${checks} checks passed (RPC grants, private storage, scoring, ties, immutable retries, malformed inputs and concurrency).`);
} finally {
  await client.query("reset role");
  // Delete only this suite's synthetic IDs; never reset a table or existing records.
  if (attemptIds.length) await client.query("delete from public.futsal_quiz_results where id=any($1::uuid[])", [attemptIds]);
  await client.end();
}
