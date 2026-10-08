import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

// This suite never loads application secrets and refuses all hosted DB targets.
const url = process.env.FESTIVAL_SURVEY_TEST_DATABASE_URL;
if (!url || !["127.0.0.1", "localhost"].includes(new URL(url).hostname)) {
  throw new Error("FESTIVAL_SURVEY_TEST_DATABASE_URL must point to an isolated localhost database.");
}
const client = new Client({ connectionString: url });
const responseIds = [];
const nextId = () => { const id = randomUUID(); responseIds.push(id); return id; };
const answer = () => ({ role: "captain", overallSatisfaction: 5, recommendation: 0, returnIntent: "probably",
  categoryRatings: { referee: 5, safety: 4, schedule: 3, facilities: 2, communication: 1, program: 5 },
  rulesOpinion: "appropriate", matchDuration: "appropriate", entryFee: "appropriate",
  bestMoment: "  즐거운 경기  ", improvement: "\u00a0없음\n", safetyIncident: "", suggestions: "" });
const submit = (id, answers) => client.query("select public.submit_festival_survey($1::uuid,$2::jsonb) as accepted", [id, JSON.stringify(answers)]);
let assertions = 0;
const rejects = async (run, pattern = /survey|category/i) => { await assert.rejects(run, pattern); assertions++; };

await client.connect();
try {
  const applied = process.env.FESTIVAL_SURVEY_TEST_MIGRATION_APPLIED === "1";
  const existing = (await client.query("select to_regclass('public.festival_survey_responses') as existing")).rows[0].existing;
  if (applied) assert.ok(existing, "Rehearsal must apply the exact survey migration first.");
  else {
    assert.equal(existing, null, "Use a fresh isolated database.");
    await client.query(`do $$ begin
      if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
      if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
      if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
    end $$;`);
    await client.query(await fs.readFile(new URL("../supabase/migrations/20261008010000_festival_survey.sql", import.meta.url), "utf8"));
  }
  assert.equal((await client.query("select count(*)::integer as count from public.festival_survey_responses")).rows[0].count, 0, "Survey tests use an empty synthetic survey table.");
  assert.deepEqual((await client.query("select column_name from information_schema.columns where table_schema='public' and table_name='festival_survey_responses' order by ordinal_position")).rows.map(row => row.column_name), ["response_id", "answers", "created_at"]);
  assert.equal((await client.query("select relrowsecurity from pg_class where oid='public.festival_survey_responses'::regclass")).rows[0].relrowsecurity, true);
  assert.equal((await client.query("select count(*)::integer as count from pg_policies where schemaname='public' and tablename='festival_survey_responses'")).rows[0].count, 0);

  for (const role of ["anon", "authenticated", "service_role"]) {
    const available = (await client.query("select exists(select 1 from pg_roles where rolname=$1) as present", [role])).rows[0].present;
    if (!available) continue;
    await client.query(`set role ${role}`);
    for (const sql of [
      "select * from public.festival_survey_responses",
      "insert into public.festival_survey_responses(response_id,answers) values (gen_random_uuid(),'{}'::jsonb)",
      "update public.festival_survey_responses set answers='{}'::jsonb",
      "delete from public.festival_survey_responses",
    ]) await rejects(() => client.query(sql), /permission denied/);
    if (role === "service_role") await rejects(() => submit(nextId(), answer()), /permission denied/);
    await client.query("reset role");
  }
  assertions += 5;

  await client.query("set role anon");
  const id = nextId();
  assert.equal((await submit(id, answer())).rows[0].accepted, true); assertions++;
  assert.equal((await submit(id, { ...answer(), bestMoment: "즐거운 경기", improvement: "없음" })).rows[0].accepted, true); assertions++;
  await rejects(() => submit(id, { ...answer(), recommendation: 10 }), /different answers/);
  const withoutOptional = answer(); delete withoutOptional.safetyIncident; delete withoutOptional.suggestions;
  const optionalId = nextId();
  assert.equal((await submit(optionalId, withoutOptional)).rows[0].accepted, true); assertions++;
  assert.equal((await submit(optionalId, { ...withoutOptional, safetyIncident: "", suggestions: "" })).rows[0].accepted, true); assertions++;
  await rejects(() => submit(null, answer()));
  await rejects(() => submit("00000000-0000-0000-0000-000000000000", answer()));
  for (const invalid of [null, [], "answers", {}]) await rejects(() => submit(nextId(), invalid));
  for (const key of ["role", "overallSatisfaction", "recommendation", "returnIntent", "categoryRatings", "rulesOpinion", "matchDuration", "entryFee", "bestMoment", "improvement"]) {
    const missing = answer(); delete missing[key]; await rejects(() => submit(nextId(), missing));
  }
  for (const key of ["role", "returnIntent", "rulesOpinion", "matchDuration", "entryFee"]) {
    for (const invalid of ["unknown", null, 1]) await rejects(() => submit(nextId(), { ...answer(), [key]: invalid }));
  }
  for (const invalid of [0, 6, 1.5, "5", null]) await rejects(() => submit(nextId(), { ...answer(), overallSatisfaction: invalid }));
  for (const invalid of [-1, 11, 0.5, "0", null]) await rejects(() => submit(nextId(), { ...answer(), recommendation: invalid }));
  for (const key of Object.keys(answer().categoryRatings)) {
    const missing = answer(); delete missing.categoryRatings[key]; await rejects(() => submit(nextId(), missing));
    for (const invalid of [0, 6, 1.5, "5", null]) {
      const answers = answer(); answers.categoryRatings[key] = invalid; await rejects(() => submit(nextId(), answers));
    }
  }
  for (const invalid of [null, [], "5"]) await rejects(() => submit(nextId(), { ...answer(), categoryRatings: invalid }));
  for (const invalid of ["", " \t\r\n", "\u00a0\u3000\ufeff", null, 1, "x".repeat(3001), "😀".repeat(1501)]) {
    await rejects(() => submit(nextId(), { ...answer(), bestMoment: invalid }));
  }
  for (const invalid of [null, 1, "x".repeat(3001)]) await rejects(() => submit(nextId(), { ...answer(), suggestions: invalid }));
  for (const key of ["name", "teamId", "userId", "ip", "toString"]) await rejects(() => submit(nextId(), { ...answer(), [key]: "private" }));
  await rejects(() => submit(nextId(), { ...answer(), categoryRatings: { ...answer().categoryRatings, userId: "private" } }));
  const boundId = nextId();
  assert.equal((await submit(boundId, { ...answer(), bestMoment: "😀".repeat(1500), recommendation: 10 })).rows[0].accepted, true); assertions++;

  await client.query("set role authenticated");
  assert.equal((await submit(nextId(), { ...answer(), role: "player" })).rows[0].accepted, true); assertions++;
  await client.query("reset role");
  const stored = (await client.query("select answers,created_at from public.festival_survey_responses where response_id=$1", [id])).rows[0];
  assert.equal(stored.answers.bestMoment, "즐거운 경기");
  assert.equal(stored.answers.recommendation, 0);
  assert.equal(Object.keys(stored.answers).length, 12);
  assert.equal((await client.query("select count(*)::integer as count from public.festival_survey_responses where response_id=$1", [id])).rows[0].count, 1);
  await client.query("set role anon"); await submit(id, answer()); await client.query("reset role");
  const unchanged = (await client.query("select answers,created_at from public.festival_survey_responses where response_id=$1", [id])).rows[0];
  assert.deepEqual(unchanged, stored); assertions += 5;

  // Independent network requests with the same UUID serialize to one immutable row.
  const concurrentId = nextId();
  const connections = [new Client({ connectionString: url }), new Client({ connectionString: url })];
  try {
    await Promise.all(connections.map(async connection => { await connection.connect(); await connection.query("set role anon"); }));
    const replies = await Promise.all(connections.map(connection => connection.query("select public.submit_festival_survey($1::uuid,$2::jsonb) as accepted", [concurrentId, JSON.stringify(answer())])));
    assert.ok(replies.every(reply => reply.rows[0].accepted === true));
    assert.equal((await client.query("select count(*)::integer as count from public.festival_survey_responses where response_id=$1", [concurrentId])).rows[0].count, 1);
    assertions += 2;
  } finally { await Promise.all(connections.map(connection => connection.end())); }
  console.log(`Festival survey database: ${assertions} checks passed (anonymous grants, validation, private storage, canonical retries, concurrency).`);
} finally {
  // Only synthetic IDs generated by this suite, on the verified isolated local target.
  await client.query("rollback");
  await client.query("reset role");
  if (responseIds.length && (await client.query("select to_regclass('public.festival_survey_responses') as present")).rows[0].present) {
    await client.query("delete from public.festival_survey_responses where response_id=any($1::uuid[])", [responseIds]);
  }
  await client.end();
}
